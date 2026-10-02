# Total Import Energy: Zero-Value Bug and Safeguards

## Problem

SmartEVSE sometimes published a **0** value for **EV Import Active Energy** (and similarly for Mains Import Active Energy) over MQTT and the REST API. In Home Assistant this sensor is `state_class: total_increasing`. A single 0 value can corrupt HA’s long-term statistics (resets or invalid slopes).

This happened rarely (e.g. 2–3 times per year), which points to a race or one-off glitch rather than a constant bug.

## Root Cause (Research)

1. **Initialization**  
   `EVMeter.Import_active_energy` and `MainsMeter.Import_active_energy` are set to **0** in the `Meter` constructor (`meter.cpp`). They only get a real value when:
   - A Modbus response is received for the energy register (`meter.cpp` `ResponseToMeasurement()`), or
   - For EM_API, when an MQTT or REST payload provides the energy value.

2. **Publish before first read**  
   - MQTT publishes every 10 seconds (`lastMqttUpdate >= 10` in the 1s timer).  
   - REST returns current state on every GET.  
   If the first publish or first REST GET happens **before** the first successful meter read (slow Modbus, bus busy, or EV meter not yet polled), the device sends **0**.

3. **Rare 0 after boot**  
   A transient 0 could also occur if:
   - A Modbus read returns 0 due to a comm glitch, or  
   - Some code path overwrites the value before a valid reading is stored.

So the bug is a **race between “first (or next) valid meter read” and “publish / REST response”**, plus possible rare bad readings.

## Safeguards Implemented

1. **Never send less than last known good**  
   For **EV Import Active Energy** and **Mains Import Active Energy**:
   - The device keeps a **last known good** value (in RAM and NVS).
   - Whenever we publish (MQTT or REST), we send **max(current_reading, last_known)**.
   - If `last_known > 0` and the current reading is **less** than `last_known` (e.g. 0 or a glitch), we send `last_known` instead of the current value.
   - When the current reading is **greater or equal** to `last_known`, we send it and update `last_known` (and persist to NVS when settings are written).

2. **Persistence**  
   Last known values are stored in NVS (`LastEVImpWh`, `LastMainsImpWh`) and loaded at boot. So after a restart we still never send a value lower than the last one we had before reboot.

3. **REST POST (EM_API) and MQTT Set**  
   When the EV meter value is **set** via REST or MQTT (e.g. external energy source), we update the last known value if the new value is greater, so we never later “step back” because of an older meter reading.

4. **Applied everywhere the value is exposed**  
   The same logic is used in:
   - MQTT: `EVImportActiveEnergy`, `MainsImportActiveEnergy` (and SmartEVSE server MQTT)
   - REST GET: `ev_meter.import_active_energy`, `mains_meter.import_active_energy`
   - REST POST (EM_API) and MQTT Set: update last known when a higher value is pushed.

## Code References

- **Helper:** `energyValueToPublish(currentWh, lastKnownWh)` in `esp32.cpp`  
- **State:** `settingsCache.lastKnownEVImportWh`, `settingsCache.lastKnownMainsImportWh`  
- **NVS keys:** `LastEVImpWh`, `LastMainsImpWh`  
- **Publish paths:** `mqttPublishData()`, `mqttSmartEVSEPublishData()`, REST status handler, REST POST EM_API and MQTT callback when setting EV energy.

## Behaviour Summary

- **New device / first run:** Last known = 0, so we send whatever the meter reports (including 0 until first valid read). No change for “brand new” meters.
- **After at least one valid reading:** We never send a value lower than the last one we sent. A stray 0 or glitch is replaced by the last known good value.
- **Reboot:** Last known is loaded from NVS, so we still never decrease the reported total import energy.

This keeps `total_increasing` semantics for HA and avoids statistics corruption from rare 0 or too-low values.
