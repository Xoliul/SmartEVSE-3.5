# Fix: Total Import Energy Zero-Value Safeguard

## Problem

SmartEVSE occasionally published a **0** value for **EV Import Active Energy** (and Mains Import Active Energy) over MQTT and the REST API. In Home Assistant this sensor uses `state_class: total_increasing`. A single 0 value corrupts HA statistics (resets or invalid slopes). The bug occurred rarely (e.g. 2–3 times per year).

## Root Cause

1. **Initialization**: `EVMeter.Import_active_energy` and `MainsMeter.Import_active_energy` are initialized to 0 in the `Meter` constructor. They only receive a real value when:
   - A Modbus response is received for the energy register (`meter.cpp` `ResponseToMeasurement()`), or
   - For EM_API, when MQTT/REST provides the value.

2. **Publish before first read**: MQTT publishes every 10 seconds; REST returns current state on every GET. If the first publish or REST GET happens before the first successful meter read (slow Modbus, bus busy, EV meter not yet polled), the device sends 0.

3. **Rare glitches**: A bad Modbus read or transient overwrite could occasionally set the value to 0 even after it was valid.

## What the Fix Entailed

### 1. Last-known-good state

- Added `lastKnownEVImportWh` and `lastKnownMainsImportWh` to `SettingsCache` in `esp32.cpp`.
- These values are stored in NVS under keys `LastEVImpWh` and `LastMainsImpWh`.
- Loaded at boot in `read_settings()`; saved in `write_settings()` when values change.

### 2. Helper function

```cpp
static int32_t energyValueToPublish(int32_t currentWh, int32_t &lastKnownWh)
```

- Returns the value to publish for a `total_increasing` energy (Wh).
- If `lastKnownWh > 0` and `currentWh < lastKnownWh`, returns `lastKnownWh` (avoids sending a lower value).
- Otherwise returns `currentWh` and, if `currentWh > lastKnownWh`, updates `lastKnownWh` and calls `request_write_settings()` to persist.

### 3. PREFS macro for int32_t

- Added `PREFS_PUT_LONG_IF_CHANGED` for storing `int32_t` values in NVS (available for future use; energy values use direct `putLong` in `write_settings()`).

### 4. Publish paths updated

| Location | Change |
|----------|--------|
| `mqttPublishData()` | `MainsImportActiveEnergy` and `EVImportActiveEnergy` use `energyValueToPublish()` |
| `mqttSmartEVSEPublishData()` | `EVImportActiveEnergy` uses `energyValueToPublish()` |
| REST GET status handler | `ev_meter.import_active_energy` and `mains_meter.import_active_energy` use `energyValueToPublish()` |
| REST POST (EM_API) | When setting `import_active_energy`, update `lastKnownEVImportWh` if new value is greater |
| MQTT callback (EM_API) | When receiving energy via MQTT, update `lastKnownEVImportWh` if new value is greater |

### 5. Behaviour

- **First run / new device**: Last known = 0, so we send whatever the meter reports (including 0 until first valid read).
- **After at least one valid reading**: We never send a value lower than the last one sent. A stray 0 or glitch is replaced by the last known good value.
- **Reboot**: Last known is loaded from NVS, so we still never decrease the reported total import energy.

## Files Modified

- `SmartEVSE-3/src/esp32.cpp`: `SettingsCache` struct, NVS load/save, `energyValueToPublish()`, all MQTT and REST publish paths for EV/Mains import energy.
