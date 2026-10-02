# Pulling Values from an External API (e.g. Home Assistant)

This document describes a design for SmartEVSE **reading** values (meter data, battery current, and more) from an external HTTP API—e.g. Home Assistant—instead of only receiving pushes via MQTT. The design is kept generic so you can add more value types and sources later.

---

## 1. Current situation

- **Mains / EV meter (API mode):** Data is **pushed** to the device via MQTT (`Set/MainsMeter`, `Set/EVMeter`) or, in the future, REST POST. The device does not initiate the request.
- **Home battery current:** Same idea—pushed via MQTT `Set/HomeBatteryCurrent` or REST.
- **HomeWizard P1:** The only “pull” today: SmartEVSE **calls** the meter’s HTTP API (`/api/v1/data`) and parses JSON. So the pattern “device polls an HTTP API and updates internal state” already exists in the codebase.

Goal: support one or more **pull sources** (e.g. Home Assistant, or any REST/JSON API) that the device polls on an interval, then map the returned values into the same internal variables that MQTT/API meter and battery current use today. That way you can add more values over time (tariff, limits, mode hints, etc.) without changing the overall architecture.

---

## 2. Generic model: “pull source” and “value mappings”

Think of it in two parts:

1. **Pull source** – A single HTTP endpoint (or a small set of endpoints) the device calls periodically. It has:
   - Base URL (e.g. `http://homeassistant.local:8123`)
   - Optional auth (e.g. Bearer token for HA Long-Lived Access Token)
   - Poll interval (e.g. 5–15 s)
   - Optional: list of entity IDs or paths to request (for HA: one GET per entity; for a custom API: one GET that returns a JSON object with many keys).

2. **Value mappings** – A table of “logical value” → “where to read it” and “where to write it” inside the firmware:
   - **Source**: entity ID (HA) or JSON key (generic API).
   - **Destination**: which global or structure to update (e.g. `MainsMeter.Irms[0]`, `homeBatteryCurrent`, future `TariffCheap`, etc.).
   - **Transform**: unit conversion (e.g. A → deci-amps, W → int, optional scaling).

So the device doesn’t hard-code “Home Assistant” everywhere; it has a **generic pull client** that fetches from a configured URL (and optional per-value paths/keys), then a **mapping layer** that says “this key/entity → this internal variable”. HA is one possible backend that fits this model.

---

## 3. Possible backends

### 3.1 Home Assistant REST API

- **Endpoint per value:** `GET /api/states/<entity_id>`
- **Auth:** `Authorization: Bearer <Long-Lived Access Token>`
- **Response:** JSON with `state` (string, often numeric) and optional `attributes.unit_of_measurement`.
- **Usage:** For each mapped value, one GET; parse `state` (and unit if needed), convert, write to the destination. Easy to add new values: add a new entity ID and a new mapping.

### 3.2 Home Assistant: single “template” or REST sensor

- HA exposes one REST sensor or template sensor that returns a JSON object, e.g. `{"mains_l1": 12.5, "mains_l2": 11, "mains_l3": 10, "battery": -5, "tariff_cheap": true}`.
- **Endpoint:** One GET to that sensor’s REST or template endpoint (or a custom HA script that returns JSON).
- **Parsing:** One request, one JSON object, multiple keys → multiple internal values. Fewer HTTP calls, more flexible for future keys.

### 3.3 Custom / generic JSON API

- Your own server or another system exposes e.g. `GET /api/smartevse` returning `{"mains_l1": 12.5, "ev_power": 7400, "battery_current": -10, ...}`.
- Same mapping layer: key → destination + transform. No HA-specific code in the firmware beyond “optional HA-style auth and entity path”.

So the doc and design stay **global** (pull source + mappings); HA is the main example, but the same mechanism can feed from any JSON API.

---

## 4. Values worth pulling (and where they go today)

| Logical value | Internal destination | Unit / format today | Notes |
|---------------|----------------------|----------------------|--------|
| Mains L1/L2/L3 | `MainsMeter.Irms[0..2]` | deci-amps (int) | Then `CalcIsum()`, `MainsMeter.setTimeout(COMM_TIMEOUT)` (and v4: `@Irms:...` to CH32). |
| EV meter L1/L2/L3 | `EVMeter.Irms[0..2]` | deci-amps | Then `EVMeter.CalcImeasured()`, timeout; v4: `@Irms:...`. |
| EV meter power | `EVMeter.PowerMeasured` | W (int) | v4: `@PowerMeasured:...`. |
| EV meter energy | `EVMeter.Import_active_energy` (Wh) | Wh (int) | `EVMeter.UpdateEnergies()`. |
| Home battery current | `homeBatteryCurrent` | deci-amps (int), sign = charge/discharge | `homeBatteryLastUpdate = time(NULL)`; v4: `SEND_TO_CH32(homeBatteryCurrent)`. |
| (Future) Tariff / “cheap” flag | New global or existing override logic | bool or enum | Could drive max current or mode. |
| (Future) Max current override | `OverrideCurrent` or similar | deci-amps | Already exists; could be set from API instead of only MQTT/UI. |
| (Future) Other limits or mode hints | New or existing globals | As needed | Design allows adding more mappings without new “sources”. |

Meter-related updates should only run when the corresponding meter type is “API” (or a new “pull” type); battery current and other globals can always be updated from the pull source if configured.

---

## 5. Configuration (stored and UI)

Keep it source-agnostic where possible.

- **Enable pull source:** e.g. “External API” or “Pull from HA” on/off (or a new meter type like `EM_HA_PULL` for mains/EV if you want it separate from EM_API).
- **Base URL:** e.g. `http://192.168.1.10:8123` or `https://ha.example.com`.
- **Auth:** Optional. For HA: Long-Lived Access Token (Bearer). For generic API: Bearer or API key header, or none.
- **Poll interval (s):** e.g. 5–30. Same interval can serve all values, or you could define per-group later.
- **Value mappings:** For each value you want to pull:
  - **Key:** Logical name (e.g. `mains_l1`, `ev_power`, `battery_current`, `tariff_cheap`). In HA entity mode this could be the entity ID; in generic JSON mode this is the key in the response.
  - **Source type:** “HA entity” (one GET per entity) or “JSON key” (single GET, then read key from body). Optional: path/entity ID per value.
  - **Destination:** Which internal variable (from the table above or a new one).
  - **Transform:** e.g. “float A → deci-amps (×10)”, “int W”, “bool → 0/1”.

Storage: same as other settings (NVS/Preferences). Web UI: form for base URL, token, interval, and a list or table of “value → entity or key” so users can add/remove mappings without reflashing.

---

## 6. Implementation outline

- **New module or section** (e.g. `api_pull.cpp` / `api_pull.h` or under `network_common`) that:
  - Holds config (URL, auth, interval, list of mappings).
  - Uses the existing HTTP client (or a dedicated one) to perform GET requests.
  - Parses JSON (ArduinoJson already used elsewhere).
  - For each mapping: get number/bool from response (either from one multi-key JSON or from per-entity HA response), apply transform, write to the destination (same assignments as MQTT handlers: `MainsMeter.Irms[]`, `CalcIsum()`, `EVMeter.*`, `homeBatteryCurrent`, etc.). Respect meter type (only update mains/EV if type is API or pull).
- **Timer / loop:** From the main loop or a timer task, call “run pull” every N seconds if the pull source is enabled. If a request fails, optionally retry and/or keep previous values and set a timeout like other meters.
- **Config load/save:** Read/write URL, token, interval, and mappings from NVS; expose in GET/POST `/settings` (and optionally a dedicated “API pull” section in the web UI).
- **Extending:** To add a new value (e.g. tariff), add a destination global (or reuse one), add a mapping entry (key + transform + destination), and document the key/entity in the UI. No change to the pull HTTP logic if you use a single JSON response; for HA per-entity you add one more GET and mapping.

---

## 7. Home Assistant specifics (when backend is HA)

- **Long-Lived Access Token:** Create under HA Profile → Long-Lived Access Tokens. Store in device config (same security considerations as MQTT password).
- **Entity IDs:** Use existing sensors (e.g. from your energy meter, CT clamps, or utility meter). For a single combined feed, use a REST sensor or a template that outputs JSON (e.g. `template` platform or a small script that returns a JSON body).
- **Units:** HA often returns `state` as string with unit in `attributes.unit_of_measurement`. Parser should handle "12.5", "12.5 A", or numeric and convert to deci-amps/W/Wh as needed.
- **Staleness:** Optionally use `last_updated` from the HA state; if older than a threshold, treat as stale and don’t update (or clear) that value. Same idea as existing `homeBatteryLastUpdate` timeout.

---

## 8. Summary

- **Concept:** SmartEVSE periodically **pulls** from an external HTTP API (e.g. HA) using a **generic “pull source”** and a **mapping table** (key/entity → internal variable + transform). No need to push from HA over MQTT for those values.
- **Scope:** Start with mains L1/L2/L3, EV L1/L2/L3/W/WH, and home battery current; design the config and code so **more values** (tariff, overrides, mode hints, etc.) are just new mappings and optional new globals.
- **Backends:** Home Assistant (per-entity GET or single JSON sensor) and any custom JSON API fit the same model; keep the firmware layer “URL + auth + list of mappings” rather than HA-only.
- **Code:** Reuse existing HTTP client and JSON parsing; add a small pull loop and mapping layer that writes into the same variables the MQTT/API meter and battery logic already use; persist and expose config via existing settings and web UI patterns.

This gives you a single, extensible way to “read from HA (or any API)” without pushing via MQTT, and room to add more values over time.
