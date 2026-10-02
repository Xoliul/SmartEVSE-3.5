# Logic Flow Visualisation – Technical Specification

**Purpose:** Detail how the Logic Flow page should visualise the internal C++ codepaths, decision points, and computed values for Smart/Solar modes. Includes the planned optional solar meter ("chasing zero") mode.

**Related:** `UI_Redesign_Spec.md` (Logic Flow page overview)

---

## 1. Overview

The Logic Flow page shows a **live diagram** of how the firmware decides the charge current. It maps the `CalcBalancedCurrent()` flow in `main.cpp` and related functions, with real values overlaid from `GET /settings`.

**Design goals:**
- Diagram reflects actual C++ control flow
- Live values shown at each step (from API)
- Highlight active path based on `mode_id`
- Support future solar meter mode (chasing zero)

---

## 2. Data Sources (GET /settings)

All values for the diagram come from the existing REST API. No new endpoints required.

| JSON Path | Variable in C++ | Unit | Description |
|-----------|----------------|------|--------------|
| `mode` | Mode | — | NORMAL, SMART, SOLAR, OFF, PAUSE |
| `mode_id` | — | — | 0=OFF, 1=NORMAL, 2=SOLAR, 3=SMART, 4=PAUSE |
| `evse.state` | State | — | A, B1, B2, C1, C2, etc. |
| `evse.state_id` | State | — | Numeric state |
| `evse.pwm` | CurrentPWM | 0–1024 | Duty cycle → charge current |
| `settings.charge_current` | Balanced[0] | deci-amps | Actual charge current sent to EV |
| `settings.current_min` | MinCurrent | A | Minimum per-EVSE current |
| `settings.current_max` | MaxCurrent | A | Max current setting |
| `settings.solar_start_current` | StartCurrent | A | Solar start threshold |
| `settings.solar_max_import` | ImportCurrent | A | Max grid import when solar charging |
| `settings.solar_stop_time` | StopTime | min | Solar stop timer duration |
| `evse.solar_stop_timer` | SolarStopTimer | s | Countdown to stop |
| `phase_currents.L1/L2/L3/TOTAL` | MainsMeter.Irms | deci-amps | Mains currents (after battery adj) |
| `phase_currents.original_data.*` | IrmsOriginal | deci-amps | Raw mains before battery |
| `ev_meter.currents.*` | EVMeter.Irms | deci-amps | EV meter currents |
| `home_battery.current` | homeBatteryCurrent | deci-amps | Battery current |
| `solar_meter_value` | SolarMeterValue | deci-amps | Solar production (future) |
| `solar_meter_source` | SolarMeterSource | — | 0=Disabled, 1=MQTT, 2=HA |

**Derived values** (computed in UI for display, or exposed later):
- `Isum` = L1 + L2 + L3 (after battery subtraction) — **not in API today**; could be added or derived client-side from phase_currents
- `IsumImport` = Isum - (10 × ImportCurrent) — Solar mode only
- `Baseload` = MainsMeter.Imeasured - TotalCurrent
- `Baseload_EV` = EVMeter.Imeasured - TotalCurrent

**Note:** `Isum` is not currently in the GET /settings response. For the diagram to show it, either:
1. Add `phase_currents.isum` to the API (recommended), or
2. Compute client-side: `Isum = L1 + L2 + L3` (works if battery is already factored into phase_currents—currently it is, so this is valid)

---

## 3. Codepath Diagram Structure

### 3.1 Top-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MODE SELECT                                                                 │
│  mode_id: 0=OFF | 1=NORMAL | 2=SOLAR | 3=SMART | 4=PAUSE                    │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ├──► OFF/PAUSE ──► No charging (PWM off or 12V)
         │
         ├──► NORMAL ──► [NORMAL BRANCH] ──► IsetBalanced = ChargeCurrent
         │
         ├──► SMART ──► [SMART BRANCH] ──► IsetBalanced from mains headroom
         │
         └──► SOLAR ──► [SURPLUS SOURCE] ──► [SOLAR BRANCH] ──► IsetBalanced from surplus
```

### 3.2 Surplus Source (Solar Mode Only) – Current vs Future

**Current (grid export):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CalcIsum()                                                                  │
│  IrmsOriginal[x] = MainsMeter.Irms[x] (raw)                                 │
│  MainsMeter.Irms[x] -= batteryPerPhase (or BatteryCurrent on L1)            │
│  Isum = Irms[0] + Irms[1] + Irms[2]                                         │
│                                                                              │
│  Convention: Isum > 0 = importing | Isum < 0 = exporting (surplus)          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │  Display: Isum = -12.3 A  (exporting = surplus)
         ▼
```

**Future (solar meter – chasing zero):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Surplus Source: SolarMeterSource?                                           │
│  0 = Grid export (current) | 1 = MQTT | 2 = Home Assistant                  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ├──► Disabled ──► Use Isum (grid export) as today
         │
         └──► MQTT/HA ──► Use SolarMeterValue (deci-amps) as available solar
                          Surplus = SolarProduction - HouseLoad (or direct solar)
                          "Chasing zero" = charge to keep grid import ≈ 0
```

For the diagram, show both paths with a clear "Current" vs "Future (Solar Meter)" label. The solar meter path uses `SolarMeterValue` directly when configured.

---

## 3.3 NORMAL Mode Branch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NORMAL MODE                                                                 │
│  ChargeCurrent = OverrideCurrent ? OverrideCurrent : MaxCurrent×10           │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ├──► LoadBl == 1 (Master): IsetBalanced = (MaxCircuit×10) - Baseload_EV
         │
         └──► Else: IsetBalanced = ChargeCurrent
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Output: IsetBalanced → SetCurrent() → PWM → EV                              │
│  Display: charge_current, pwm, duty %                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Values to show:**
- ChargeCurrent (from override or MaxCurrent)
- Baseload_EV (if EV meter)
- IsetBalanced
- PWM (evse.pwm)
- Duty % = pwm × 100 / 1024

---

## 3.4 SMART Mode Branch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SMART MODE                                                                  │
│  Inputs: MainsMeter.Imeasured, MaxMains, MaxCircuit, EVMeter, MaxSumMains    │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Idifference = (MaxMains×10) - MainsMeter.Imeasured                         │
│  If EVMeter + (LoadBl|!LoadBl): min with (MaxCircuit×10) - EVMeter.Imeasured│
│  If MaxSumMains: Idifference = (MaxSumMains×10) - Isum                       │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Ramp (only when phasesLastUpdateFlag):                                      │
│  Idifference > 0: IsetBalanced += Idifference/4   (slow increase)            │
│  Idifference < 0: IsetBalanced += Idifference     (fast decrease)            │
│  Clamp: 0 ≤ IsetBalanced ≤ 800 (80A)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  New EVSE (mod=1): IsetBalanced = min(MaxMains-Baseload, MaxCircuit-Baseload_EV) │
│  If MaxSumMains: min with ((MaxSumMains×10)-Isum)/3                          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Guards: min(IsetBalanced, MaxMains-Baseload, MaxCircuit-Baseload_EV,        │
│              GridRelayMaxSumMains/Phases)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Values to show:**
- MainsMeter.Imeasured (or phase_currents.TOTAL)
- MaxMains, MaxCircuit, MaxSumMains
- Baseload, Baseload_EV
- Idifference
- IsetBalanced
- LimitedByMaxSumMains (if applicable) — *not in API; could add*

---

## 3.5 SOLAR Mode Branch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SOLAR MODE                                                                  │
│  Surplus: Isum (grid export, negative = surplus)                             │
│  Future: SolarMeterValue when SolarMeterSource != 0                          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  IsCurrentAvailable() – Can we start/continue?                               │
│  • Start: ActiveEVSE==0 && Isum >= -StartCurrent×10                          │
│  • Continue: Isum <= ImportCurrent×10 + TotalCurrent - ActiveEVSE×MinCurrent×10 │
│  • MaxMains, MaxCircuit, MaxSumMains checks                                   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  State B: 1P vs 3P choice (EnableC2=AUTO)                                    │
│  -Isum >= 30×MinCurrent+30 → 3P                                               │
│  Else → 1P                                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Idifference (same as Smart) for MaxMains/MaxCircuit headroom                │
│  Ramp down when Idifference < 0: IsetBalanced += Idifference                 │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  IsumImport = Isum - (10 × ImportCurrent)                                    │
│  Allows grid import up to ImportCurrent when solar charging                   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Solar ramp (when ActiveEVSE>0, Idifference>0, phasesLastUpdateFlag):        │
│  IsumImport < 0 (surplus):                                                    │
│    IsumImport < -10 && Idifference>10: IsetBalanced += 5  (0.5A)             │
│    Else: IsetBalanced += 1  (0.1A)                                           │
│  IsumImport > 0 (using grid):                                                 │
│    > 20: IsetBalanced -= IsumImport/2                                        │
│    > 10: IsetBalanced -= 5                                                    │
│    > 3:  IsetBalanced -= 1                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Shortage: IsetBalanced < ActiveEVSE×MinCurrent×10                           │
│  → SolarStopTimer logic (StopTime min or 30s for 3P→1P)                      │
│  → 1P→3P switch when -Isum > spareCurrent, IsetBalanced near max             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Values to show:**
- Isum (or SolarMeterValue when solar meter mode)
- StartCurrent, ImportCurrent, StopTime
- IsumImport
- SolarStopTimer
- Switching_Phases_C2 (1P/3P) — *not in API; state implies it*
- Idifference, IsetBalanced

---

## 4. Output Stage (Common)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Distribute IsetBalanced over EVSEs (load balancing)                         │
│  Average = MaxBalanced / ActiveEVSE                                           │
│  Per-node caps: BalancedMax[n], MinCurrent                                   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SetCurrent(Balanced[0]) → SetCPDuty() → PWM → Control Pilot → EV            │
│  Display: charge_current (Balanced[0]/10) A, pwm, duty %                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Diagram Layout Suggestions

### 5.1 Visual Structure

- **Vertical flow** – top to bottom, with branches splitting left/right for mode
- **Boxes** – one per logical step (CalcIsum, Idifference, Ramp, Guards, etc.)
- **Arrows** – show data flow and decision branches
- **Live values** – inside or next to each box, e.g. `Isum = -12.3 A`
- **Highlight** – active path in bold/colour based on `mode_id`

### 5.2 Sections

1. **Inputs** – Mains meter, EV meter, battery, solar meter (future), config
2. **Surplus / Isum** – CalcIsum or SolarMeterValue
3. **Mode branch** – NORMAL | SMART | SOLAR
4. **Ramp / limits** – Idifference, IsumImport, guards
5. **Output** – IsetBalanced → PWM → charge_current

### 5.3 Conditional Visibility

- **Solar-only** – IsumImport, StartCurrent, ImportCurrent, SolarStopTimer, 1P/3P logic
- **Smart-only** – Idifference ramp, MaxSumMains
- **Solar meter** – Show SolarMeterValue path when `solar_meter_source != 0`
- **Load balancing** – Show multi-EVSE distribution when `loadbl > 0`

---

## 6. API Additions (Optional, for Full Fidelity)

To show the diagram without client-side derivation, consider adding to GET /settings:

| New key | Type | Description |
|---------|------|-------------|
| `phase_currents.isum` | int | L1+L2+L3 (deci-amps), after battery adjustment |
| `calc.isum_import` | int | IsumImport (Solar mode only) |
| `calc.idifference` | int | Idifference (Smart/Solar) |
| `calc.baseload` | int | Baseload (deci-amps) |
| `calc.baseload_ev` | int | Baseload_EV (deci-amps) |
| `calc.limited_by_max_sum_mains` | bool | MaxSumMains is the active limit |

These are computed in CalcBalancedCurrent / CalcIsum and could be exposed for debugging and the Logic Flow page.

---

## 7. Solar Meter "Chasing Zero" – Future Mode

### 7.1 Concept

**Current:** Surplus = negative grid current (Isum < 0 when exporting). We charge when exporting.

**Future (solar meter):** Surplus = solar production (SolarMeterValue). "Chasing zero" = charge so that grid import stays near 0, using solar directly.

### 7.2 Logic (Proposed)

When `SolarMeterSource != 0` and solar meter is configured:

```
AvailableSolar = SolarMeterValue  (deci-amps, from MQTT/HA)
HouseLoad = MainsMeter.Imeasured (or similar)
Surplus = AvailableSolar - HouseLoad  (simplified; sign convention TBD)

Or simpler: Use SolarMeterValue as the cap for charge current.
  IsetBalanced = min(IsetBalanced, SolarMeterValue/10)  when in solar meter mode
```

### 7.3 Diagram Addition

Add a parallel path in the Surplus Source box:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Surplus Source                                                              │
│  ┌─────────────────────┐  ┌─────────────────────────────────────────────┐  │
│  │ Grid export (current)│  │ Solar meter (future)                        │  │
│  │ Isum = L1+L2+L3      │  │ Surplus = SolarMeterValue (or derived)      │  │
│  │ Negative = surplus   │  │ Chasing zero: charge from solar only        │  │
│  └─────────────────────┘  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

Show which path is active based on `solar_meter_source`.

---

## 8. Implementation Notes

1. **Polling** – Use same 5 s poll as Home page; no new endpoints.
2. **Fallbacks** – If a value is missing (e.g. no EV meter), show "N/A" or hide that branch.
3. **Code references** – Optionally link boxes to `main.cpp` line numbers or function names for developers.
4. **Static + dynamic** – The diagram structure can be static SVG/HTML; JS fills in values from the API.
5. **Mobile** – Collapsible sections or horizontal scroll for smaller screens.

---

## 9. File References

| Logic | File | Function / Area |
|-------|------|-----------------|
| CalcIsum | main.cpp | CalcIsum() |
| IsCurrentAvailable | main.cpp | IsCurrentAvailable() |
| CalcBalancedCurrent | main.cpp | CalcBalancedCurrent() |
| SetCurrent / SetCPDuty | main.cpp | SetCurrent(), SetCPDuty() |
| Solar meter config | esp32.cpp | SolarMeterSource, SolarMeterValue |
| GET /settings | esp32.cpp | JSON serialisation |

---

*End of spec. The diagram should mirror these codepaths so users and developers can see exactly how charge current is determined.*
