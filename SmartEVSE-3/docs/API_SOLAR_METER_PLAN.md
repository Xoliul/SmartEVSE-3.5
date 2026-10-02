# Optional API Solar Meter – Plan

This document describes a clean, optional way to add an **API solar meter** so Solar mode can use **feed-forward** from solar production instead of only reacting to grid export (mains meter). When disabled, behavior stays unchanged.

---

## 1. Goal

- **Current behavior:** Solar mode infers “excess solar” only from **negative Isum** (grid export). That is reactive and can oscillate or lag (“chasing zero”).
- **With API solar meter:** When configured, use **solar production** as a **feed-forward setpoint** and keep using the **mains meter as trim** (reduce charge current when grid shows import). Result: faster, more stable solar charging; optional.

---

## 2. Design principles

- **Optional:** Off by default. When disabled or timed out, logic is identical to today (mains-only).
- **Minimal surface:** No new Modbus meter type, no new entries in the mains/EV meter picker. Solar is a separate, simple “solar production source” with one input path (API).
- **Same patterns:** Reuse MQTT/REST patterns from existing API mains/EV meter (topics, params, validation, timeout).
- **Extensible:** Structure allows later adding e.g. “house consumption” meter for surplus = solar − house.

---

## 3. Data model

Introduce a **solar production state** (no full `Meter` class, no Modbus):

| Symbol / concept        | Type     | Meaning |
|-------------------------|----------|--------|
| `solarCurrentDeciA`     | int16_t  | Solar production as current, deci-amps (e.g. 50 = 5 A). Same resolution as `Irms`. |
| `solarLastUpdate`      | time_t   | Last time a value was received (for timeout). |
| `solarTimeout`         | uint8_t  | Seconds without update after which solar is treated invalid (e.g. 60–120 s). |
| **Solar meter enabled**| config   | 0 = Off, 1 = API. Stored in NVS; no “solar meter type” in the mains/EV meter list. |

**Alternative:** Accept **power (W)** from the API and convert to current using a fixed voltage (e.g. 230 V) or configurable voltage: `solarCurrentDeciA = (solarPowerW * 10) / voltage`. For simplicity, v1 can accept **current only** (deci-amps); power-based input can be a later extension.

**When solar is “valid”:**  
`(solar meter enabled) && (now - solarLastUpdate < solarTimeout)`.

---

## 4. API input (MQTT + REST)

### 4.1 MQTT

- **Topic (example):** `Set/SolarMeter` (same prefix as existing API meter).
- **Payload:** Single value, deci-amps (e.g. `"50"` = 5 A). Optional: two values `"current_deciA:power_W"` for future power fallback; v1 only parses first.
- **Validation:** Same style as mains: bounds e.g. 0–1000 (0–100 A). Ignore if solar meter not enabled.
- **On accept:** Set `solarCurrentDeciA`, `solarLastUpdate = time(NULL)`, and optionally call a small “solar timeout” setter (so CH32/ESP32 get a timeout if used).

### 4.2 REST

- **Endpoint:** Existing settings/status POST (e.g. same handler as `L1`/`L2`/`L3` for mains).
- **Parameter:** e.g. `solar_current` (int, deci-amps). Same validation and update as MQTT.

### 4.3 Status / GET

- Expose read-only: `solar_meter.enabled`, `solar_meter.current` (deci-amps), `solar_meter.last_update`, `solar_meter.valid` (derived from timeout), so UIs and HA can show state.

---

## 5. Config and storage

- **New settings (e.g. in NVS / menu):**
  - **Solar meter:** Off | API (0 / 1). Default Off.
  - **Solar meter timeout (s):** e.g. 60–300, default 120.
- **Storage:** Same mechanism as other menu/settings (e.g. `getItemValue`/`setItemValue` if a MENU_* is added, or a dedicated pref). No new meter type in `EMConfig[]`; this is not a “third meter” in the Modbus/meter list sense.
- **Web UI:** Optional: toggle “Solar meter: Off / API” and timeout; show current and “valid” in status. Can be added in a later phase.

---

## 6. Solar mode logic changes

All changes are **inside Solar mode** and **guarded by “solar meter valid”**.

### 6.1 When solar meter is **invalid** (disabled or timed out)

- No change: use **only** mains `Isum` as today. Start when `-Isum >= StartCurrent`; adjust `IsetBalanced` from `IsumImport` (increase when export, decrease when import).

### 6.2 When solar meter is **valid**

- **Feed-forward:** Treat **solar current** as the available surplus for the EV (up to other limits). So a first-cut **target** for charge current is  
  `solarTarget = min(solarCurrentDeciA, MaxCurrent*10, (MaxMains*10 - Baseload), ...)`  
  (same caps as today: MaxMains, MaxCircuit, MaxSumMains, etc.).
- **Trim with grid:** Keep existing **grid trim**: if `IsumImport > 0` (we’re importing), **reduce** `IsetBalanced` as today (e.g. step down). So solar sets the “ceiling”; grid import pulls it down. No need to “chase” export; we only correct when we see import.
- **Start condition:** When solar meter is valid, allow **starting** when `solarCurrentDeciA >= StartCurrent*10` (and other existing checks), even if mains hasn’t yet shown export. Optionally still require `Isum` not heavily positive to avoid starting during clear import.
- **Ramp-up:** When increasing, can use solar as target: e.g. ramp `IsetBalanced` toward `min(solarCurrentDeciA, ...)` faster than the current “+0.1 A / +0.5 A per update”, because we have a direct surplus signal. Exact step size can stay conservative to avoid overshoot.

No change to Smart mode (no solar setpoint). No change to Normal mode.

---

## 7. Code touch points (summary)

| Area | Change |
|------|--------|
| **main.h / config** | Add symbols for solar enabled, timeout, `solarCurrentDeciA`, `solarLastUpdate`; optional MENU_* for “Solar meter” and “Solar timeout”. |
| **main.cpp** | In `CalcBalancedCurrent()`, MODE_SOLAR: if solar valid, compute solar target and use it as feed-forward; keep grid trim (IsumImport) as is. Start condition: when solar valid, allow start from solar current. |
| **esp32.cpp** | MQTT handler for `Set/SolarMeter`: parse payload, validate, set solar current and last update. REST: handle `solar_current` param. Status JSON: add `solar_meter.*`. |
| **NVS / settings** | Load/save solar enabled and solar timeout. |
| **Web UI (optional)** | Form fields for “Solar meter” and timeout; show solar current and valid in status. |

No changes to: Modbus, `EMConfig[]`, meter type enums, EV meter or mains meter selection.

---

## 8. Extension: house consumption meter later

If later a **house consumption** source is added (also API or future pull):

- **Surplus** can be defined as **solar − house** (both in current or power with same voltage).
- Solar mode would then use **surplus = solar − house** as the feed-forward setpoint instead of raw solar, with grid still as trim. The same “solar production” variable could become “surplus” or we add `houseCurrentDeciA` and compute surplus in one place. This plan does not implement that; the current design only adds “solar production” and uses it as the feed-forward source.

---

## 9. Testing and fallback

- **Solar meter Off:** Behavior must match current firmware (mains-only).
- **Solar meter On, no updates:** After timeout, treat as invalid and fall back to mains-only for that run.
- **Solar meter On, valid:** Start and ramp should be quicker and more stable; grid import should still trim down.
- **Invalid payload / out of range:** Ignore update; do not change `solarCurrentDeciA` or `solarLastUpdate`.

---

## 10. Summary

| Item | Content |
|------|--------|
| **What** | Optional “API solar meter”: single value (current in deci-amps) via MQTT and REST. |
| **Where** | New state vars + config (enabled, timeout); no new meter type in meter list. |
| **Solar mode** | When valid: feed-forward setpoint from solar; grid (IsumImport) only trims when importing. When invalid: unchanged mains-only behavior. |
| **Risk** | Low: optional, fallback to current behavior, same API style as existing API meters. |
| **Later** | Can add house consumption and use surplus = solar − house with same pattern. |

This gives a clean, optional API solar meter and a clear path to “solar + house” later without redesign.
