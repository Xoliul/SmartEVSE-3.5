# Fix: Solar Mode Surplus Cap

## Problem

In Solar mode with a solar meter configured, the EVSE could charge at circuit maximum (e.g. 18A) instead of limiting to the available solar surplus (e.g. 8.4A for 2kW solar). The charge current would ramp up to MaxCircuit and stay there, causing significant grid import instead of solar-only charging.

## How StartCurrent and ImportCurrent Are Used

The original design *does* use these settings, but only for **gating** (start/stop) and **target** (chase point), not as a hard cap:

- **StartCurrent** (default 4A): Minimum surplus required to *start* charging. In `IsCurrentAvailable()`: charging only starts when `effectiveIsum < -StartCurrent` (surplus > StartCurrent).

- **ImportCurrent** (default 0A): "Allow grid power when solar charging". Shifts the chase target: `IsumImport = effectiveIsum - (10*ImportCurrent)`. With ImportCurrent=2A, the system chases ~2A grid import instead of zero. So the intended max charge = surplus + ImportCurrent.

The regulation logic ramps up/down based on `IsumImport`, but there was **no cap** enforcing that max. The ramp could overshoot to MaxCircuit before the feedback loop corrected.

## Root Cause

The solar regulation logic in `CalcBalancedCurrent()` uses a "chase zero" (or chase ImportCurrent) approach:
- When `IsumImport < 0` (surplus): increase charge current
- When `IsumImport > 0` (importing): decrease charge current

There was **no upper bound** on charge current based on the available surplus. The code only applied guards for MaxMains, MaxCircuit, and GridRelay. When the solar meter reported surplus (e.g. 8.4A), the logic kept incrementing `IsetBalanced` until it hit MaxCircuit (18A), because:
1. `Idifference > 0` (room under circuit limit)
2. `IsumImport < 0` (surplus reported)
3. No cap prevented exceeding surplus + ImportCurrent

## What the Fix Entailed

Added a **solar surplus cap** in the boundary guards section of `CalcBalancedCurrent()`:

```cpp
// guard solar surplus: only when SolarMeterSource != 0 (see comment in code for grid-mode rationale)
if (Mode == MODE_SOLAR && SolarMeterSource != 0 && effectiveIsum < 0) {
    int allowedTotal = (-effectiveIsum) + (10 * ImportCurrent);  // surplus + allowed grid import
    int allowedPerPhase = allowedTotal / Nr_Of_Phases_Charging;
    IsetBalanced = min((int) IsetBalanced, allowedPerPhase);
}
```

- `effectiveIsum` is negative when surplus is available (from solar meter or mains meter export)
- `-effectiveIsum` = total surplus in deci-amps
- `allowedTotal` = surplus + ImportCurrent (respects the "allow grid power" setting)
- For 1-phase: max charge = surplus + ImportCurrent
- For 3-phase: max charge per phase = (surplus + ImportCurrent) / 3

**Important:** The cap is only applied when `SolarMeterSource != 0` (solar meter enabled). When using grid chasing zero (solar meter disabled), `effectiveIsum = Isum` (grid export/import). When exporting, `-Isum` is the export amount, i.e. "could add X more" — capping at that would wrongly force a reduction and cause oscillation. So the cap is skipped for grid-only mode.

**3-phase + low surplus:** When on 3-phase, surplus is divided by 3 (per-phase). If that gives < MinCurrent (e.g. 12.4A/3 = 4.1A < 6A), the shortage branch would bump to MinCurrent (6A/phase = 18A total), overcharging. A separate fix triggers a switch to 1-phase when surplus/3 < MinCurrent, so the full surplus (e.g. 12.4A) can be used on one phase.

## House Load When Exporting (Grid Leak Fix)

### Problem

With 14+ A solar and 3 A leaking to grid export, the EVSE was undercharging instead of using the surplus. The surplus calculation was wrong when exporting.

### Root Cause

1. **Wrong variable:** `MainsMeter.Imeasured` is the *max* of phase currents. With L1=-4.3A, L2=L3=0, Imeasured=0 (max of -43,0,0). So houseLoad = 0 - TotalCurrent was wrong.
2. **Use Isum:** Isum = sum of phases (grid flow; negative = export). For houseLoad we need Isum, not Imeasured.

### Fix

Use `Isum` (grid flow) instead of `MainsMeter.Imeasured` for houseLoad. When exporting (`houseLoad < 0`), use `houseLoad = SolarMeterValue + Isum - TotalCurrent` to derive House from `House = Solar - EV - Export`.

## Surplus < MinCurrent, No Import Allowed

**Rule:** EV cannot charge below 6 A (MinCurrent). If surplus < MinCurrent and ImportCurrent = 0, stop charging (0 A) instead of bumping to MinCurrent (which would import from grid).

- When surplus < MinCurrent and ImportCurrent = 0: set `IsetBalanced = 0`, trigger hard shortage (NoCurrent).
- When surplus < MinCurrent and ImportCurrent > 0: bump to MinCurrent (allow grid import).

## Files Modified

- `src/main.cpp`: Added solar surplus guard in `CalcBalancedCurrent()` boundary section; skip MinCurrent bump when surplus-limited; cap solar-start current when surplus-limited
