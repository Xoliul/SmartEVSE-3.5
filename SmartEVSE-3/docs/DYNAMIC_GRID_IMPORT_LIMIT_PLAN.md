# Dynamic Grid Import Limit (Belgium “Peak Limit”) – Plan

This document plans an optional **dynamic grid import limit** (e.g. Belgium’s capacity/peak limit in kW), fed via MQTT or pull (e.g. from Home Assistant), so the EVSE keeps **grid import** under a changing cap. It clarifies how this relates to existing limits and what behaviour might need to change.

---

## 1. Goal and context

- **Belgium (and similar):** Capacity/peak tariff where the DSO (or a service) defines a **maximum grid import** (often in **kW**) that must not be exceeded (e.g. per 15‑minute window). The limit can be **dynamic** (changes over the day or when the DSO sends a new cap).
- **User need:** Feed the SmartEVSE a **number in kW** (dynamic), via **MQTT** or **pull from HA**, and have it limit charging so that **grid import** stays under that value.
- **Important distinction:** The limit must apply to **grid import** (current/power at the mains meter), not to “total EVSE circuit consumption” or a fixed per‑phase mains cap. The firmware already has a limit that is grid-based (**MaxSumMains**); the new part is making that limit **dynamic** and **in kW**.

---

## 2. Current limits (what they actually limit)

From the codebase:

| Setting | What it limits | Compared to | Unit | Fixed/Dynamic |
|--------|-----------------|-------------|------|----------------|
| **MaxMains** | Per‑phase current at the **mains** (grid) connection | `MainsMeter.Imeasured`, Baseload | A (per phase) | Fixed (menu/NVS) |
| **MaxSumMains** | **Sum of phase currents** at the mains = **grid total** | **Isum** (from MainsMeter) | A (sum L1+L2+L3) | Fixed (menu/NVS) |
| **MaxCircuit** | Total current on the **EV circuit** (EV subpanel) | `EVMeter.Imeasured`, Baseload_EV | A | Fixed (menu/NVS) |
| **GridRelayMaxSumMains** | Sum when grid relay is open (DSO‑controlled) | Isum (indirect) | A | Fixed |

So:

- **MaxSumMains** is already a **grid import** limit (cap on **Isum**). It is used for “EU capacity rate” and is exactly the right **concept** for a peak/capacity limit.
- **MaxCircuit** is **not** grid import; it’s the EV circuit (total consumption of the EVSE side). So the user is correct: “max” today can mean different things; the one that matches “peak limit” is **MaxSumMains** (grid sum), not MaxCircuit.
- **MaxMains** is grid but **per phase** (physical connection limit). It stays as is.

The gap: MaxSumMains is **static**. We need a **dynamic** grid import limit (optionally in **kW**) that can **override or substitute** the value used in the same logic as MaxSumMains.

---

## 3. Proposed design: “Dynamic grid import limit”

### 3.1 Concept

- Add an optional **dynamic grid import limit** that the firmware uses **in place of** (or **capped by**) the static **MaxSumMains** when deciding how much headroom there is for charging.
- **Semantics:** “Stay under X kW (or X A) **grid import**.” So the quantity being limited is still **Isum** (grid current sum). The only change is where the limit value comes from (external, dynamic) and that it can be expressed in **kW**.
- **When dynamic limit is not available or invalid:** Use only the static **MaxSumMains** (current behaviour). So behaviour is unchanged if the feature is off or the source fails.

### 3.2 Value and unit

- **Primary:** Limit in **kW** (grid power). Firmware converts to an equivalent **current sum** for comparison with **Isum**.
- **Conversion:** For 3‑phase, approximate relationship often used for capacity:  
  `P ≈ U_phase × (I1 + I2 + I3)` ⇒ **I_sum_A = P_W / U_phase**.  
  So: **I_sum_limit_A = (P_limit_kW × 1000) / U**. Use a **configured voltage** (e.g. 230 V, or per‑phase voltage). So we need a setting like “Grid voltage (V)” for conversion, or a fixed 230 V in v1.
- **Alternative:** Allow the external system to send the limit already in **amps (sum)** (e.g. MQTT payload `"25"` = 25 A sum). Then no conversion; use directly like MaxSumMains. So support both:
  - **kW** + configured voltage → convert to A sum internally.
  - **A (sum)** → use directly (optional payload format or separate topic/param).

### 3.3 Effective limit and safety

- **Effective grid import limit** used in logic:
  - If dynamic limit is **enabled and valid** (recent value, not timed out):  
    **effective_limit_A = min(static MaxSumMains, dynamic_limit_A)**  
    So the **static MaxSumMains** remains the **absolute safety cap** (e.g. connection capacity). The dynamic value can only **tighten** the limit, never exceed MaxSumMains.
  - If dynamic limit is **disabled or invalid** (no value, timeout, or error):  
    **effective_limit_A = MaxSumMains** (current behaviour).
- All existing comparisons that today use **MaxSumMains** would use **effective_limit** instead (see below). So:
  - `IsCurrentAvailable`: `(Phases*ActiveEVSE*MinCurrent*10) + Isum > effective_limit*10` → no current.
  - `CalcBalancedCurrent`: `ExcessMaxSumMains = (effective_limit*10) - Isum`; guards and timers (MaxSumMainsTimer, LimitedByMaxSumMains) stay, but their **limit value** is effective_limit.
- **MaxMains** and **MaxCircuit** are **unchanged**: they stay as separate guards (per‑phase mains and EV circuit). So we are only making the **grid sum** limit dynamic; we are not overloading MaxMains or MaxCircuit with “peak limit” semantics.

### 3.4 Interaction with other limits

- **MaxMains:** Still applies. It’s a per‑phase cap at the grid. No change.
- **MaxSumMains:** Becomes the **upper bound** for the effective limit when dynamic is on. So set MaxSumMains to your physical/contractual maximum; the dynamic value can lower the cap for the capacity tariff.
- **MaxSumMainsTime:** Still used: when **effective** limit is exceeded, the same “soft” timer runs; when it expires, charging stops. So dynamic limit uses the same timer behaviour as today.
- **MaxCircuit:** Unchanged; still limits by EV circuit, not grid.

---

## 4. Data model and source

### 4.1 State

- **Dynamic limit value:** Either stored as **kW** (float) and converted each time using voltage, or stored as **A (sum)** after conversion (int16 or uint16, deci‑amps or whole amps to match Isum). Prefer storing **kW** + **voltage** and converting so we can expose kW in status.
- **Valid / timeout:** Same idea as API solar meter: **last_update** timestamp; if `now - last_update > timeout_seconds`, treat as invalid and fall back to MaxSumMains. Configurable timeout (e.g. 5–30 minutes for a 15‑min DSO window).
- **Enable:** Config “Dynamic grid limit: Off | MQTT | MQTT+Pull” or “Dynamic grid limit: Off | On”. When Off, never use dynamic value.

### 4.2 Input: MQTT

- **Topic (example):** `Set/GridImportLimit` or `Set/PeakLimit` (same prefix as other API settings).
- **Payload:**  
  - Option A: **kW** as number, e.g. `"4.6"` (4.6 kW). Firmware converts using configured voltage.  
  - Option B: **A (sum)** as integer, e.g. `"20"` (20 A sum). No conversion.  
  - Option C: Both, e.g. `"4.6"` (kW) or `"20A"` (amps) with a convention.  
  Prefer **kW** as default; optional param or second topic for “in amps”.
- On accept: update limit value, last_update, and optionally publish an ack or status.

### 4.3 Input: Pull (e.g. Home Assistant)

- Reuse the same “pull source” idea as in **PULL_FROM_EXTERNAL_API.md** / **HOME_ASSISTANT_PULL_INTEGRATION**: periodic GET (or WebSocket) to HA (or any API) that returns a number (kW or A). Map that to “dynamic grid import limit” and write into the same state (limit value + last_update).
- So the **value** can come from MQTT (push) or from pull (HA/API). When both are configured, “last write wins” or define priority (e.g. MQTT overrides pull). Simplest: one value, two possible sources; most recent valid update wins.

### 4.4 Config

- **Dynamic grid limit:** Off | On (or Off | MQTT | Pull).
- **Limit in:** kW | A (so we know how to interpret incoming value, or whether to convert before store).
- **Grid voltage (V):** For kW→A conversion (e.g. 230). Used only when limit is in kW.
- **Timeout (s):** After which dynamic value is invalid and we fall back to MaxSumMains (e.g. 600–1800 s for 15‑min DSO updates).

Storage: NVS/settings like other options; optional MENU_* or web-only.

---

## 5. Code touch points (summary)

| Area | Change |
|------|--------|
| **main.h / config** | Add: dynamic limit enable, limit value (kW or A), voltage (if kW), last_update, timeout. Optional MENU_* or prefs keys. |
| **main.cpp** | Introduce **effective_grid_limit_A** (or equivalent): if dynamic valid then min(MaxSumMains, dynamic_A), else MaxSumMains. Replace every use of **MaxSumMains** in **IsCurrentAvailable** and **CalcBalancedCurrent** that is meant to cap **grid** by this effective value. Do **not** change the meaning of MaxMains or MaxCircuit. |
| **esp32.cpp** | MQTT handler for `Set/GridImportLimit` (or chosen name): parse kW or A, validate, convert kW→A if needed, set limit and last_update. REST param for same. Status JSON: e.g. `dynamic_grid_limit_kw`, `dynamic_grid_limit_valid`, `effective_grid_limit_A`. |
| **Pull integration** | If/when pull-from-HA exists: add a mapping “entity or key → dynamic grid limit (kW or A)” and write into the same state; same timeout rules. |
| **NVS / settings** | Save/load enable, voltage, timeout, and optionally last known limit (for display). |

No change to: Modbus meter logic, MaxMains/MaxCircuit semantics, or Normal mode. Only Smart/Solar and any mode that already uses MaxSumMains.

---

## 6. Behaviour changes and risks

- **Risk 1 – Confusion between limits:** Document clearly: **MaxMains** = per‑phase connection limit; **MaxSumMains** = static cap on grid sum (safety); **Dynamic limit** = current cap on grid sum (e.g. Belgium peak). Effective = min(MaxSumMains, dynamic) when dynamic valid.
- **Risk 2 – Unit errors:** If value is in kW and voltage is wrong, conversion is wrong. Provide sensible default (230 V), validate range (e.g. 200–250 V), and optionally expose “effective limit in A” in status for debugging.
- **Risk 3 – Stale value:** If DSO sends a new cap every 15 min and timeout is 10 min, we might fall back to static. So timeout should be ≥ typical update interval (e.g. 15–30 min) or the source should push frequently.
- **Risk 4 – MaxSumMains = 0:** Today when MaxSumMains is 0 it often means “disabled”. When dynamic is on, we still need a **safety cap**; so if MaxSumMains is 0, either treat dynamic as “effective” only when MaxSumMains > 0, or allow a separate “absolute cap” (e.g. 80 A) when dynamic is on. Prefer: require MaxSumMains > 0 when dynamic is on, so effective is always min(MaxSumMains, dynamic).

---

## 7. Summary

| Item | Content |
|------|--------|
| **What** | Optional **dynamic grid import limit** (kW or A sum), same semantics as MaxSumMains but **grid import only**, value from MQTT or pull (e.g. HA). |
| **Where it applies** | Replaces the **value** used for the existing MaxSumMains-style logic (cap on **Isum**); effective = min(MaxSumMains, dynamic). |
| **Units** | Prefer **kW** with configured voltage for conversion to A sum; optional **A (sum)** directly. |
| **Other limits** | MaxMains and MaxCircuit unchanged. MaxSumMains becomes the safety ceiling when dynamic is on. |
| **Fallback** | When dynamic is off or invalid, use only MaxSumMains (current behaviour). |

This gives a clean way to feed a Belgium-style “peak limit” in kW (or A) dynamically via MQTT or HA, keep grid import under that limit, and avoid overloading the meaning of MaxMains/MaxCircuit.
