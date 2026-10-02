# Power-Based Input (Watts + Voltage) Instead of Amps per Phase

You have 3-phase (delta, no neutral), can't get amps per phase, but you **can** get:
- Total watts imported (grid)
- Total watts used (or similar)
- Solar generated (watts)
- Voltage per phase (optional)

You'd prefer to pass **voltages, P_import, P_solar** (and maybe P_house) and do **all balancing in power (watts)**, instead of reconstructing amps per phase.

This note says: **yes, it can work**, and outlines two design options and how much they diverge from the current amp-based internals.

---

## 1. The one hard constraint: EV expects current (amps)

The EV communicates via the **pilot (CP)**:
- The pilot encodes **allowed current** (amps), not power.
- So the **output** of the EVSE to the car is always: “you may draw up to **I** amps.”
- Therefore we **must** convert to amps at some point: **I_ev = P_ev / V** (with a suitable voltage) before we set the pilot / `IsetBalanced`.

So we **cannot** avoid amps entirely—only **where** we do the conversion: at the **input** (power → current, then keep current everywhere) or only at the **output** (keep power inside, convert to amps only for the EV).

---

## 2. Two design approaches

### Option A: Convert at input only (minimal change)

**Idea:** Keep the **entire** internal model in **amps** as today. You send **power and voltage**; we convert once at the edge into an “equivalent” current sum (and optionally fake per-phase currents) and feed the existing logic.

- **Input (API/MQTT):**  
  `P_import` (W), `P_solar` (W), and either one voltage (e.g. line or phase) or V1,V2,V3.
- **Conversion:**  
  - For 3-phase (balanced): `P = √3 × V_line × I_line` ⇒ `I_line = P / (√3 × V_line)`.  
  - We need “sum” for the firmware: e.g. `Isum` equivalent from total power. For balanced 3P, one common convention is `I_sum_equiv = P_import / (V_phase)` (single-phase equivalent) or use `√3×V` so that `Isum`-like value matches. Exact formula depends how the meter defines “total watts” (sum of phase powers vs. √3×V×I).  
  - Set `Isum` (and optionally `Irms[0..2]` if we fake per-phase from total P and V’s) from these conversions.
- **Rest of firmware:** Unchanged. All limits (MaxSumMains, dynamic limit), solar surplus, and `IsetBalanced` stay in amps.

**Pros:** Small change set; reuses all existing logic.  
**Cons:** You’re still “fitting” your power data into an amp model; per-phase is fake when you don’t have real amps per phase; conversion formula and “equivalent” current can feel like a workaround.

---

### Option B: Power-native path (balance in watts, convert only at EV)

**Idea:** Introduce a **power-based** data path. You send **P_import, P_solar**, and voltages. Internally we do **limits and surplus in watts**; we only convert **P_ev → I_ev** when setting the EV.

- **Input:**  
  `P_import` (W), `P_solar` (W), voltages (V1,V2,V3 or V_line, or single V for EV). Optionally `P_house` (house consumption) if you have it.
- **Internal (new path):**  
  - Grid headroom: `P_headroom = P_limit_import - P_import` (with dynamic/static limit in kW).  
  - Solar surplus: e.g. `P_surplus = P_solar - P_house`, or when you don’t have P_house, use “export” from meter (negative P_import) as surplus.  
  - EV setpoint in watts: `P_ev_setpoint = min(P_headroom, P_surplus, P_charger_max)` (and any other caps you want).  
  - Convert for the pilot: `I_ev = P_ev_setpoint / V_ev` (V_ev = nominal 230 V or average of phase voltages).  
  - Set `IsetBalanced = I_ev` (in deci-amps) and send to EV as today.
- **Rest of firmware:**  
  - Amp-based logic (Isum, Irms[], MaxMains, MaxCircuit, etc.) can stay for **other** meter types and for display/Modbus.  
  - When “power-based mains source” is enabled, we **don’t** drive `Isum`/`Irms[]` from this path (or we optionally backfill them from P/V for UI only). Balancing for the EV is done from P_import, P_solar, limits in kW, and P_ev → I_ev at the end.

**Pros:** Matches your data (watts, no fake per-phase amps); no need to derive amps per phase; limits and surplus are in the units you care about.  
**Cons:** New code path; some duplication or branching (e.g. “if power-based mains then … else existing Isum logic”); display/status may still show “current” derived from P/V for compatibility.

---

## 3. Do you stray “very far” from the current amp-based code?

- **Option A:** You barely stray. Internally everything stays amps; you only add an **input adapter** (P + V → Isum and maybe Irms[]).  
- **Option B:** You add a **parallel** path: “power-based” input and power-based balancing, then a single conversion to amps at the EV. The **existing** amp-based path remains for hardware meters and other modes; we don’t rewrite the whole codebase—we gate the power path behind “mains source = power API” (or similar). So we don’t tear out Isum/Irms everywhere; we just don’t use them for **this** source’s balancing.

So: **it can work**, and you don’t have to rewrite the entire firmware. Option B is the one that truly “does balancing based on watts” and only uses amps at the EV.

---

## 4. What you’d pass in (concrete)

- **P_import** (W): grid import (positive = drawing from grid). Optional: allow negative for export.  
- **P_solar** (W): solar generation.  
- **V** (V): for EV current conversion (`I_ev = P_ev / V`). Could be one nominal (230 V), or average of V1,V2,V3, or per-phase if you want to be precise.  
- **V1, V2, V3** (optional): if you want to convert something to per-phase current for display or for future use.  
- **P_house** (optional): house consumption; then surplus = P_solar - P_house. If omitted, surplus can be inferred from export (e.g. -P_import when P_import < 0) or from “available for EV” logic.  
- **P_limit** (optional): dynamic grid limit in W (or kW); same idea as dynamic grid import limit doc.

Then:
- Headroom = P_limit - P_import (when P_limit is set).  
- Surplus = P_solar - P_house, or from export.  
- EV power setpoint = min(headroom, surplus, charger max power, …).  
- I_ev = P_ev_setpoint / V → feed into existing `IsetBalanced` → pilot.

---

## 5. Summary

| Question | Answer |
|----------|--------|
| Can balancing be done from total watts + voltages instead of amps per phase? | **Yes.** |
| Do we ever need amps? | **Yes, at the EV** (pilot is current). So at least **I_ev = P_ev / V** at the output. |
| Minimal change (Option A)? | Convert P_import, P_solar, V to “equivalent” Isum (and maybe Irms[]) at input; keep all internals in amps. |
| Power-native (Option B)? | New path: limits and surplus in watts; compute P_ev; convert to I_ev only for the pilot. Rest of amp-based code stays for other meters/modes. |
| Straying far? | Option A: no. Option B: new path and a few branches, but not a full rewrite—amps remain for EV output and for other meter types. |

So you can design around **voltages + total imported watts + solar watts** and do the meaningful balancing in power; the only non-negotiable is converting that to **amps at the EV**.
