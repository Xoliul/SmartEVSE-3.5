# SmartEVSE Current Limits Reference

This note documents the current firmware semantics around current limits, meter
values, MQTT, and Home Assistant inputs. It is intended as a quick reference for
future agents before changing the charging logic.

The important naming trap: **MaxCurrent is the charger/EVSE output cap, not a
grid import cap**. Grid limits use MaxMains or MaxSumMains.

## Final Charging Path

The final pilot current is based on `Balanced[0]` / `ChargeCurrent`.

- `CalcBalancedCurrent()` computes `ChargeCurrent`, `IsetBalanced`, and the
  per-EVSE `Balanced[]` values.
- `SetCurrent(Balanced[0])` eventually applies the PWM/pilot current for the
  master.
- Values are commonly stored in deci-amps internally (`A * 10`), except some
  configuration values such as `MaxCurrent`, `MaxMains`, and `MaxCircuit` are
  stored as whole amps and multiplied when used in calculations.

Main code paths:

- `src/main.cpp`: `CalcBalancedCurrent()`
- `src/main.cpp`: `IsCurrentAvailable()`
- `src/main.cpp`: `SetCurrent()`
- `src/esp32.cpp`: MQTT, REST, and Home Assistant input handling
- `src/meter.cpp`: meter decoding and `Meter::CalcImeasured()`

## Charge-Side Limits

### MaxCurrent

Names and surfaces:

- Internal: `MaxCurrent`
- UI/API: `current_max`, "Max current"
- MQTT dynamic source: `{prefix}/Set/MaxCurrent` or configured
  `MaxCurrentMQTTTopic`
- Home Assistant dynamic source: `MaxCurrentHAEntity` when
  `MaxCurrentSource == 2`

Meaning:

- Maximum current the EVSE offers to the EV, per phase.
- This is a charger-side output cap.
- It is not a mains/grid import limit.
- It is also bounded by the cable/proximity capacity unless the unit is fixed
  cable/configured accordingly.

Where it affects charging:

- `CalcBalancedCurrent()` starts by setting `ChargeCurrent` to either
  `MaxCurrent * 10` or the cable/proximity cap.
- `BalancedMax[0]` is updated from `ChargeCurrent`.
- Distribution logic prevents an EVSE from receiving more than its
  `BalancedMax[n]`.

Important implication:

- If MQTT or Home Assistant updates "MaxCurrent", it changes the maximum charge
  current offered to the car. It does not mean "maximum current from the grid".

### MaxCircuit

Names and surfaces:

- Internal: `MaxCircuit`
- UI/API: `current_max_circuit`, "EVSE circuit max"
- MQTT: `{prefix}/Set/CurrentMaxCircuit`

Meaning:

- Limit for the EVSE circuit / EV feeder side.
- Compared against the EV meter (`EVMeter.Imeasured`) when an EV meter is
  configured, or in load-balancing Master mode.
- This is not the house/grid import limit.

Where it affects charging:

- In Smart/Solar, `Idifference` may be limited by
  `(MaxCircuit * 10) - EVMeter.Imeasured`.
- Guard logic also caps `IsetBalanced` by
  `(MaxCircuit * 10) - Baseload_EV`.

### OverrideCurrent

Names and surfaces:

- Internal: `OverrideCurrent`
- UI/API: `override_current`
- MQTT: `{prefix}/Set/CurrentOverride`

Meaning:

- Temporary charger output cap.
- Only accepted on master/non-slave in Normal or Smart mode.
- Must be 0, or between `MinCurrent * 10` and `MaxCurrent * 10`.
- Overrides `ChargeCurrent` when non-zero.

## Grid / Mains Limits

### MaxMains

Names and surfaces:

- Internal: `MaxMains`
- UI/API: `current_main`, "Mains max"
- MQTT: `{prefix}/Set/CurrentMain`

Meaning:

- Per-phase grid/mains connection limit in amps.
- This is the main "do not trip the grid/main fuse per phase" setting.
- Applies in Smart/Solar modes when a mains meter is present.

Meter value used:

- Uses `MainsMeter.Imeasured`, which is the maximum of
  `MainsMeter.Irms[0..2]`.
- In calculations it often uses `Baseload = MainsMeter.Imeasured - TotalCurrent`
  to estimate non-EV load and then caps charging by
  `(MaxMains * 10) - Baseload`.

Where it affects charging:

- `IsCurrentAvailable()` refuses a new EVSE if minimum charging current plus
  baseload would exceed `MaxMains`.
- `CalcBalancedCurrent()` computes grid headroom from
  `(MaxMains * 10) - MainsMeter.Imeasured`.
- Guard logic caps `IsetBalanced` by `(MaxMains * 10) - Baseload`.

### MaxSumMains

Names and surfaces:

- Internal: `MaxSumMains`
- API: `current_max_sum_mains`
- MQTT: `{prefix}/Set/CurrentMaxSumMains`

Meaning:

- Sum-of-phases grid/mains import limit.
- Intended for total/capacity-style limits, not per-phase fuse protection.
- Value is in amps summed across L1 + L2 + L3.
- `0` disables this limit.

Meter value used:

- Uses `Isum`, the sum of adjusted `MainsMeter.Irms[0..2]`.
- Because it uses the phase sum, it is the closest existing concept to a grid
  import / capacity tariff limit.

Where it affects charging:

- `IsCurrentAvailable()` checks whether adding minimum current would put
  `Isum` above `MaxSumMains`.
- `CalcBalancedCurrent()` sets `ExcessMaxSumMains =
  (MaxSumMains * 10) - Isum`.
- If enabled, it can override `Idifference` and drive the same shortage/timer
  path as other limits.
- `MaxSumMainsTime` controls whether exceeding it becomes a soft timed stop or
  an immediate hard shortage.

Important implication:

- If implementing a dynamic grid import limit, prefer building on this concept
  rather than overloading `MaxCurrent`.

### DynamicGridImportLimit

Names and surfaces:

- Internal: `DynamicGridImportLimit`
- API: `dynamic_grid_import_limit`
- MQTT: `{prefix}/Set/GridImportLimit`
- Status MQTT: `{prefix}/GridImportLimit`
- Status MQTT: `{prefix}/EffectiveGridImportLimit`

Meaning:

- MQTT/API-fed dynamic peak/grid import cap using the same summed-current
  semantics as `MaxSumMains`.
- `0` disables the dynamic cap.
- When both `MaxSumMains` and `DynamicGridImportLimit` are set, the firmware
  uses the lower of the two. This keeps `MaxSumMains` as the static/hardware
  ceiling and lets the dynamic cap tighten it.
- When only one is set, that value is the effective summed-grid limit.

Input format:

- `10A` means 10 A summed current.
- `2500W` means 2500 W converted to summed amps using the configured mains
  voltage (`MainsHAVoltage`, default/fallback 230 V).
- `2.5kW` means 2500 W with the same conversion.
- Bare values above 600 are treated as watts so a Home Assistant power sensor
  can publish `2500`.
- Bare values up to 600 are treated as amps.
- Watt/kW conversion floors to whole amps so the EVSE stays under the peak
  rather than slightly exceeding it.

Single-phase note:

- In single-phase charging, summed current is effectively the L1 current, so
  `DynamicGridImportLimit` and `MaxSumMains` directly cap grid draw on that
  one phase.

### ImportCurrent

Names and surfaces:

- Internal: `ImportCurrent`
- UI/API: `solar_max_import`, Solar "Max Import"

Meaning:

- Solar-mode grid import allowance.
- It is not a general grid fuse/capacity limit.
- It allows solar charging to import up to this current instead of strictly
  chasing zero import.

Where it affects charging:

- Solar mode computes `IsumImport = effectiveIsum - (10 * ImportCurrent)`.
- The solar regulation then increases/decreases `IsetBalanced` based on whether
  `IsumImport` indicates surplus or excess import.
- It also affects stop/timer behavior when there is not enough surplus.

### StartCurrent

Names and surfaces:

- Internal: `StartCurrent`
- UI/API: `solar_start_current`, Solar "Start Current"

Meaning:

- Solar start threshold.
- Export/surplus is represented as negative current internally, but this setting
  is stored as a positive amps value.

## Meter Values

### MainsMeter.Irms[0..2]

Meaning:

- Live mains current per phase, in deci-amps.
- Positive means import/load.
- Negative means export/surplus.

Sources:

- Hardware mains meters via Modbus/Sensorbox/HomeWizard paths.
- MQTT API source: `{prefix}/Set/MainsMeter` with `L1:L2:L3`.
- REST API current feed when `MainsMeter.Type == EM_API`.
- Home Assistant pull when HA is enabled, `MainsMeter.Type == EM_API`, and
  `MainsMeterAPISource == 1`.

MQTT/API input format:

- Integers are treated as deci-amps: `45:32:21` means 4.5 A, 3.2 A, 2.1 A.
- Decimal payloads are treated as amps: `4.5:3.2:2.1`.
- Values are constrained to roughly -200 A .. +200 A per phase.

### MainsMeter.Imeasured

Meaning:

- Highest phase current from `MainsMeter.Irms[0..2]`.
- Computed by `Meter::CalcImeasured()`.
- Used by `MaxMains` per-phase grid limit logic.

### Isum

Meaning:

- Sum of adjusted `MainsMeter.Irms[0..2]`.
- Computed in `CalcIsum()`.
- Used by solar/export logic and `MaxSumMains`.

Adjustment details:

- Home battery current can be subtracted in Solar mode before `Isum` is
  computed.
- `IrmsOriginal[]` stores the pre-adjustment mains values for status/UI.

### EVMeter.Imeasured

Meaning:

- Highest phase current on the EV meter side.
- Used for `MaxCircuit` / EV feeder constraints.

### SolarMeterValue

Names and surfaces:

- Internal: `SolarMeterValue`, `SolarMeterLastUpdate`
- MQTT: configured solar meter topic or `{prefix}/Set/SolarMeter`
- Home Assistant: `SolarMeterHAEntity` when `SolarMeterSource == 2`

Meaning:

- Optional solar production value in deci-amps after unit conversion.
- Used only in Solar mode.
- If valid and fresh, solar logic derives `effectiveIsum` from solar production
  and house load.
- If invalid or stale, solar mode falls back to grid export / chasing zero using
  `Isum`.

## MQTT and Home Assistant Source Summary

### MaxCurrent Source

`MaxCurrentSource`:

- `0`: static configured `MaxCurrent`
- `1`: MQTT updates `MaxCurrent`
- `2`: Home Assistant pulls `MaxCurrentHAEntity`

This affects the charger-side output cap only.

### Mains Meter API Source

`MainsMeterAPISource` when `MainsMeter.Type == EM_API`:

- `0`: MQTT/REST pushes per-phase mains current
- `1`: Home Assistant pulls L1/L2/L3 entities

This feeds `MainsMeter.Irms[]`, which then feeds both `MainsMeter.Imeasured`
and `Isum`.

### Solar Meter Source

`SolarMeterSource`:

- `0`: disabled
- `1`: MQTT solar meter input
- `2`: Home Assistant solar meter entity

This feeds optional solar-production-based surplus logic, not the general mains
meter.

## Choosing the Right Setting

Use this mapping before changing logic:

| Goal | Existing value to use |
| ---- | --------------------- |
| Limit what the EVSE offers to the car | `MaxCurrent` |
| Temporarily cap output in Normal/Smart | `OverrideCurrent` |
| Protect the EVSE feeder/circuit | `MaxCircuit` plus `EVMeter.Imeasured` |
| Protect the mains/grid connection per phase | `MaxMains` plus `MainsMeter.Imeasured` |
| Limit total grid import / capacity across phases | `MaxSumMains` plus `Isum` |
| Feed a dynamic peak/grid import limit | `DynamicGridImportLimit` / `{prefix}/Set/GridImportLimit` |
| Allow some grid import while solar charging | `ImportCurrent` |
| Start solar charging only above surplus threshold | `StartCurrent` |

## Related Planning Docs

- `docs/DYNAMIC_GRID_IMPORT_LIMIT_PLAN.md`
- `docs/HA_MAINS_METER_AND_DYNAMIC_MAXMAINS_PLAN.md`
- `docs/POWER_BASED_INPUT_DESIGN.md`
- `docs/API_SOLAR_METER_PLAN.md`
