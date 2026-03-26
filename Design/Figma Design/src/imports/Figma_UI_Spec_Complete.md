# SmartEVSE Web UI – Complete Figma Specification

**Version:** 1.0  
**Purpose:** Single source of truth for Figma design handoff. Combines architecture, layout, settings structure, and implementation constraints.  
**Target:** SmartEVSE v3/v4 web interface.

---

## 1. Architecture & Tech Stack

### 1.1 Overview

The SmartEVSE web interface is a **Single Page Application (SPA)** built using **Svelte**.

- **Framework:** Svelte  
- **Build tool:** Vite  
- **Output:** Static bundle (HTML, CSS, JS) served from ESP32 flash (LittleFS/SPIFFS)
- **Runtime:** Browser only – no Node.js on the device

```
Browser
   │ HTTP
   ▼
ESP32 HTTP Server
   ├─ Static UI files (index.html, app.js, app.css, assets/*)
   ├─ REST API (GET/POST /settings)
   └─ WebSocket (optional, for live updates; OCPP uses WS separately)
```

### 1.2 Why Svelte

- Extremely small runtime
- Minimal JavaScript bundle size
- Reactive UI without heavy framework overhead
- Ideal for embedded devices – compiles to vanilla JS

### 1.3 Bundle Size Targets

| Resource   | Limit    | Notes                                      |
|-----------|----------|--------------------------------------------|
| JS bundle | < 150 KB | All web assets must fit in ~576 KB flash   |
| CSS       | < 50 KB  |                                            |
| Total UI  | < 300 KB | Keep single files under ~150 KB            |

### 1.4 Data Flow

- **GET** `http://{device-ip}/settings` → JSON with all state and settings
- **POST** `http://{device-ip}/settings?param=value&...` → Update settings
- **GET** `http://{device-ip}/api/logs?lines=80` → JSON array of log lines
- **Polling:** UI polls `/settings` every 5 seconds for live updates (no WebSocket for UI by default)

---

## 2. Main Layout – Top-Level Navigation

**Four main tabs/buttons at the top** to switch between views:

| Tab        | Route / Section | Purpose                                                                 |
|------------|-----------------|-------------------------------------------------------------------------|
| **Dashboard** | `#dashboard`   | Overview values, mode (changeable), key params per mode (charging, mains, solar) |
| **Settings**  | `#settings`    | All configuration, split into sections (see §3)                        |
| **Log**       | `#log`        | Live log viewer with filtering                                         |
| **Flow**      | `#flow`       | Visual control loop debugger – logic overview (Smart/Solar decision flow) |

### 2.1 Navigation Requirements

- **Persistent navigation** – header or tab bar with: Dashboard | Settings | Log | Flow
- **Mobile-first** – must work on 320px+ screens; consider hamburger on small viewports
- **Single-page** – use hash routing (`#dashboard`, `#settings`, `#log`, `#flow`) or show/hide sections

---

## 3. Dashboard Page

**Purpose:** At-a-glance status, mode, and quick controls. Key numbers for charging, mains, and solar.

### 3.1 Data to Display (from `GET /settings`)

| Data Path                    | Type   | Display        | Notes                          |
|-----------------------------|--------|----------------|--------------------------------|
| `version`                   | string | Header         | e.g. "3.0.12"                  |
| `serialnr`                  | string | Header         | e.g. "SmartEVSE-12345"         |
| `mode`                      | string | **Prominent**  | NORMAL, SMART, SOLAR, OFF, PAUSE |
| `mode_id`                   | int    | For styling     | 0=OFF, 1=NORMAL, 2=SOLAR, 3=SMART, 4=PAUSE |
| `car_connected`             | bool   | Yes/No         | EV plugged in                  |
| `evse.state`                | string | Status         | e.g. "B1", "C2", "B2"          |
| `evse.solar_stop_timer`     | int    | Optional       | "Stopping in Xs" when > 0      |
| `evse.error`                | string | Error banner   | "None" or error text          |
| `evse.temp` / `evse.temp_max` | int  | °C             | EVSE temperature               |
| `evse.pwm`                  | int    | %              | Duty cycle (0–1024 → 0–100%)   |
| `settings.charge_current`   | int    | A (÷10)        | Current charge current         |
| `settings.override_current` | int    | A (÷10)        | Manual override                |
| `phase_currents.L1/L2/L3/TOTAL` | int | A (÷10)        | Mains currents                 |
| `ev_meter.*`                | object | If enabled     | Power, energy, currents       |
| `home_battery.*`            | object | If enabled     | Battery status                 |
| `mqtt.status`                | string | If MQTT        | "Connected"/"Disconnected"      |

### 3.2 Quick Controls (POST /settings)

| Control           | POST param              | Values        | When visible                    |
|-------------------|-------------------------|---------------|---------------------------------|
| Mode buttons      | `mode`                  | 0,1,2,3,4     | Always (slaves: limited)        |
| Override current  | `mode_override_current`  | 0 or 6–80 (A) | Normal/Smart only, not Solar    |
| Solar start current | `solar_start_current` | 0–16          | Solar mode only                 |
| Solar max import  | `solar_max_import`      | 0–16          | Solar mode only                 |
| Solar stop time   | `solar_stop_time`       | minutes       | Solar mode only                 |
| LCD Lock          | `lcdlock`               | 0, 1          | Always                          |
| Cable Lock        | `cablelock`             | 0, 1          | If lock != 0                    |

### 3.3 Mode-Specific Params on Dashboard

- **NORMAL / SMART:** Override current, charge current
- **SOLAR:** Solar start current, max import, stop time, surplus/import numbers
- **OFF / PAUSE:** Minimal controls

---

## 4. Settings Page – Section Structure

Settings is split into **multiple sections** (tabs, accordion, or sub-pages):

### 4.1 Connectivity

| Subsection      | Content                                      | POST params / notes                    |
|-----------------|----------------------------------------------|----------------------------------------|
| **WiFi**        | SSID, password, status                       | WiFi config (device-specific)          |
| **App Server**  | Enable/disable (MQTT-only mode)              | `app_server` 0/1                       |
| **MQTT**        | Host, port, username, password, topic prefix, TLS, CA cert | `mqtt_update=1`, `mqtt_host`, etc. |
| **Home Assistant** | Enabled, URL, port, token, refresh, mains entities, test | `ha_enabled`, `ha_server_url`, etc. |
| **OCPP**        | Enable, backend URL, charge box ID, auth key, auto-auth, idTag | `ocpp_update=1`, `ocpp_mode`, etc. |

### 4.2 Energy

Configures all meters:

| Subsection           | Content                                      | Notes                                  |
|----------------------|----------------------------------------------|----------------------------------------|
| **EV Meter**         | Mode and params                             | Type, address (Modbus), API source     |
| **Mains Meter**      | Mode and params                             | Type, address, HA entities, unit        |
| **Grid**             | 4-wire / 3-wire                             | `grid` 0=4Wire, 1=3Wire (sensorbox/grid config) |
| **Solar Meter**      | Optional – mode and params                  | Source (Disabled/MQTT/HA), topic/entity |

**Field reference (Energy):**

- Mains meter type, address, API source, unit, voltage, L1/L2/L3 entities
- EV meter type, address
- Solar meter source, MQTT topic, HA entity, unit

### 4.3 Hardware (PIN-Protected)

**Critical settings – cannot be changed without entering the correct PIN.**

| Setting              | Param / notes                    | Values / validation     |
|----------------------|----------------------------------|--------------------------|
| Max circuit current  | `current_max_circuit`            | 10–160 A                 |
| Max current          | `current_max`                    | 6–80 A (when source=Static) |
| C2 mode              | Cable/connection mode            | (see firmware options)   |
| RCDMon               | `rcmon`                          | 0/1 (RCD monitoring)     |
| Socket / Fixed       | `config`                         | 0=Socket, 1=Fixed Cable  |
| Solenoid lock        | `lock`                           | 0=Disabled, 1=Solenoid, 2=Motor |
| Switch (SW-Pin)      | `switch`                         | 0–7 (see options)        |
| Load Balancing       | `loadbl`                         | 0–8 (Disabled, Master, Node 1–7) |
| Max CPU temp         | `max_temp`                       | 40–75 °C                 |
| **PIN change**       | Requires original PIN            | New PIN (0–9999)         |

**UI flow:** User must enter current PIN to unlock Hardware section; same flow for changing PIN (current PIN + new PIN).

### 4.4 RFID

| Subsection   | Content                    | Notes                    |
|--------------|----------------------------|--------------------------|
| **RFID mode**| `rfidreader`               | 0–6 (see options)       |
| *(Future)*   | More options to be added   |                          |

---

## 5. Log Page

**Purpose:** Live log viewer with level filtering and text search.

### 5.1 API

- **GET** `/api/logs?lines=80` → `{"total": N, "available": M, "lines": ["[I] msg", ...]}`
- **Polling:** Client polls every 3–60 seconds (user configurable)
- **Log format:** `[LEVEL] message` — LEVEL = A, E, W, I, D, V or other

### 5.2 UI Elements

| Element      | Type        | Notes                              |
|--------------|-------------|------------------------------------|
| Level filter | Checkboxes  | A, E, W, I, D, V, Other, All       |
| Text filter  | Input       | Filter lines by substring          |
| Poll interval| Number      | 1–60 seconds                      |
| Log display  | Scrollable  | Monospace, color by level           |
| Status       | Text        | "Waiting…" / "X lines"              |

---

## 6. Flow Page (Logic Overview)

**Purpose:** Visual control loop debugger – diagram showing how Smart and Solar modes decide charge current.

### 6.1 Content to Illustrate

**Smart Mode:**
- Mains meter (L1+L2+L3) → compute available current
- `IsetBalanced` = min(MaxMains - Baseload, MaxCircuit - Baseload_EV, …)
- Increase slowly (1/4 of difference), decrease immediately

**Solar Mode:**
- Surplus current: `Isum` = grid import (negative = export)
- **Start:** Charging when surplus ≥ StartCurrent
- **During:** Allow grid import up to ImportCurrent
- **Ramp:** +0.5A or +0.1A when surplus; decrease when over
- **Stop:** SolarStopTimer when below min; StopTime minutes

### 6.2 Live Data Overlay (from GET /settings)

| Data                          | Use                          |
|-------------------------------|------------------------------|
| `mode`                        | Highlight active branch      |
| `evse.state`                  | State (A, B, C)              |
| `evse.pwm`                    | Current PWM                  |
| `settings.charge_current`     | Balanced current             |
| `phase_currents.*`           | Mains currents               |
| `settings.solar_start_current`| Start threshold              |
| `settings.solar_max_import`   | Import limit                  |
| `evse.solar_stop_timer`       | Countdown                    |

### 6.3 Design Notes

- Flowchart or diagram – boxes for: Mains Meter → Calc → IsetBalanced → PWM
- Highlight active path based on `mode_id`
- Show live values in diagram (e.g. "Isum = -12.3 A", "StartCurrent = 6 A")

---

## 7. Responsive & Performance

### 7.1 Breakpoints

| Target   | Resolution      | Notes                          |
|----------|-----------------|--------------------------------|
| Mobile   | 320px – 480px   | Primary – phone/tablet to charger |
| Tablet   | 768px – 1024px  |                                |
| Desktop  | 1280px – 1920px |                                |

### 7.2 Constraints

- **Touch-friendly** – large tap targets, clear hierarchy
- **Legibility** – clear numeric readouts, good contrast
- **Avoid:** Large chart libs, heavy animations, large icon packs
- **Prefer:** SVG icons, system fonts, simple CSS animations

### 7.3 Browser Support

- Chrome, Safari, Edge, Firefox, mobile browsers
- ES2020+ JavaScript, CSS Grid, Flexbox
- No legacy browser support

---

## 8. API Reference Summary

### 8.1 GET /settings

Returns JSON. Key top-level keys:

```
version, serialnr, mode, mode_id, car_connected
evse: { temp, temp_max, state, state_id, error, pwm, loadbl, solar_stop_timer, rfid, ... }
settings: { charge_current, override_current, current_min, current_max, ... }
phase_currents: { L1, L2, L3, TOTAL, last_data_update }
ev_meter: { description, type, currents, import_active_power, total_wh, charged_wh, ... }
home_battery: { current, last_update }
mqtt: { host, port, status, tls, ... }
ha: { enabled, server_url, port, token_set, refresh_interval, mains_*, test_result }
ocpp: { mode, backend_url, cb_id, status, auto_auth, auto_auth_idtag }
meter_types: [ "Disabled", "Sensorbox", ... ]
```

### 8.2 POST /settings

Query params. Examples:

```
mode=1
mode_override_current=32
solar_start_current=6
solar_max_import=10
solar_stop_time=5
lcdlock=1
cablelock=0
```

EVSE config: many params; send as single POST with `param1=value1&param2=value2&...`.

### 8.3 GET /api/logs?lines=80

Returns `{"total": N, "available": M, "lines": ["[I] ...", ...]}`.

### 8.4 GET /api/validate_ha_entity?entity_id=sensor.xyz

Returns `{"ok": true}` or `{"ok": false, "error": "not_found"}`. Use for debounced validation (500ms) on HA entity fields.

---

## 9. Design System Guidelines

- **Clean dashboard style** – energy monitoring focus
- **Status cards** – mode, currents, temperature, errors
- **Energy flow** – Solar → House → EV (conceptual)
- **Toggle buttons** – mode selection, locks
- **Configuration panels** – grouped, clear labels
- **Numeric telemetry** – prominent, readable
- **Grid layouts** – consistent spacing, alignment

---

## 10. Implementation Checklist (for Dev Handoff)

1. Map each UI element to a data path (e.g. `charge_current` ← `data.settings.charge_current`)
2. Map each control to a POST param (e.g. mode button → `mode=2`)
3. Respect conditional visibility – `evse.loadbl`, `mode_id`, `data.mqtt`, etc.
4. Preserve form dirty state – don’t overwrite user edits with poll data
5. Use same endpoints – no backend changes for basic redesign
6. Add `data-settings-key` or similar for easier binding
7. Test on real device – verify under 576 KB assets, acceptable load time

---

## 11. File Structure (Target)

```
data/
  index.html      # SPA shell (or Svelte build output)
  app.js          # Bundled JS
  app.css         # Bundled CSS
  assets/*        # Icons, images
  log.html        # Or integrated in SPA
  update2.html    # OTA (separate flow)
```

---

## 12. Appendix: Settings Field Reference (Full)

| Field                | Param                    | Values / validation        |
|----------------------|--------------------------|----------------------------|
| Config               | `config`                 | 0=Socket, 1=Fixed Cable     |
| Lock                 | `lock`                   | 0=Disabled, 1=Solenoid, 2=Motor |
| Max current source   | `max_current_source`     | 0=Static, 1=MQTT, 2=HA     |
| Max current (A)      | `current_max`            | 6–80                       |
| Circuit max (A)      | `current_max_circuit`    | 10–160                     |
| Load balance        | `loadbl`                 | 0–8                        |
| Mains max (A)        | `current_main`           | 10–200                     |
| Grid                 | `grid`                   | 0=4Wire, 1=3Wire           |
| Mains meter type     | `mains_meter_type`       | From `meter_types`         |
| Mains meter address  | `mains_meter_address`    | 10–247 (Modbus)            |
| EV meter type        | `ev_meter_type`          | From `meter_types`         |
| EV meter address     | `ev_meter_address`       | 11–247 (Modbus)            |
| Solar meter source   | `solar_meter_source`     | 0=Disabled, 1=MQTT, 2=HA    |
| Switch (SW-Pin)      | `switch`                 | 0–7                        |
| RCDMon               | `rcmon`                  | 0/1                        |
| RFID reader          | `rfidreader`             | 0–6                        |
| Max temp (°C)        | `max_temp`               | 40–75                      |
| LCD PIN              | `lcd_pin`                | 0–9999                     |

---

*End of specification. For implementation details, refer to `SmartEVSE-3/src/esp32.cpp` (GET/POST handlers), `SmartEVSE-3/src/main.cpp` (CalcBalancedCurrent), and `SmartEVSE-3/data/index.html` (current UI bindings).*
