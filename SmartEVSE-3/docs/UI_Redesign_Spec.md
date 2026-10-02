# SmartEVSE Web Interface Redesign – Technical Specification

**Version:** 1.0  
**Target:** Figma design handoff for SmartEVSE v3/v4 web UI  
**Purpose:** Provide a technical spec so designs are implementable on ESP32 and slot cleanly into the existing backend.

---

## 1. Page Structure

The web interface should be split into **4 main pages** with clear navigation:

| Page | Route | Purpose |
|------|-------|---------|
| **Home / Landing** | `/` or `index.html` | Status overview, quick controls, at-a-glance info |
| **Settings** | `/settings.html` or multi-section single page | All configuration, split into logical sections |
| **Log** | `/log.html` | Live log viewer with filtering |
| **Logic Flow** | `/logic.html` | Visual diagram of Smart/Solar mode decision flow |

### 1.1 Navigation

- **Persistent navigation** (header or sidebar) with links to: Home | Settings | Log | Logic Flow
- **Mobile-first**: Navigation must work on small screens (320px+). Consider hamburger menu.
- **Single-page vs multi-page**: Either approach works. If single-page, use hash routing (`#home`, `#settings`, `#log`, `#logic`) or show/hide sections. Current codebase serves separate HTML files.

---

## 2. Technical Constraints (ESP32)

**Critical:** The web UI runs on an **ESP32** serving static files from **LittleFS/SPIFFS**. There is no Node.js, no React, no build step on the device.

### 2.1 Tech Stack Requirements

| Allowed | Not Allowed |
|---------|-------------|
| Vanilla HTML, CSS, JavaScript | React, Vue, Angular, Svelte |
| jQuery (current) or vanilla JS | npm, webpack, Vite, esbuild |
| Bootstrap, Tailwind (CDN), or custom CSS | Node.js runtime |
| Fetch API or XMLHttpRequest | Server-side rendering |
| Single HTML file or multiple static files | WebSockets for UI (backend has them for OCPP only) |

### 2.2 Resource Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| **SPIFFS partition** | ~576 KB (0x90000) | All web assets (HTML, CSS, JS, images) must fit |
| **Current assets** | ~200–300 KB | index.html ~150KB, log.html ~8KB, styling.css, etc. |
| **Single file size** | Keep under ~150 KB | Large files increase load time and memory pressure |
| **External CDNs** | Allowed | jQuery, Bootstrap from CDN reduce flash usage |
| **Images** | Prefer SVG or small WebP | Avoid large PNGs; use `Cache-Control` for static assets |

### 2.3 Data Flow

- **GET** `http://{device-ip}/settings` → JSON with all state and settings
- **POST** `http://{device-ip}/settings?param=value&...` → Update settings
- **GET** `http://{device-ip}/api/logs?lines=80` → JSON array of log lines
- **Polling**: UI polls `/settings` every 5 seconds for live updates (no WebSocket for UI)

### 2.4 Design Implications

- **No client-side routing frameworks** – use plain links or hash-based navigation
- **Minimal JavaScript** – avoid heavy frameworks; vanilla or jQuery is fine
- **Progressive enhancement** – core functionality must work without JS (e.g. form submit)
- **Responsive** – design for 320px–1920px; many users access from phones
- **Low bandwidth** – avoid large images or animations that hurt load time

---

## 3. Page Specifications

### 3.1 Home / Landing Page

**Purpose:** At-a-glance status, mode, and quick controls.

#### Data to Display (from `GET /settings`)

| Data Path | Type | Display | Notes |
|-----------|------|---------|-------|
| `version` | string | Header | e.g. "3.0.12" |
| `serialnr` | string | Header | e.g. "SmartEVSE-12345" |
| `mode` | string | Prominent | "NORMAL", "SMART", "SOLAR", "OFF", "PAUSE" |
| `mode_id` | int | For styling | 0=OFF, 1=NORMAL, 2=SOLAR, 3=SMART, 4=PAUSE |
| `car_connected` | bool | Yes/No | EV plugged in |
| `evse.state` | string | Status | e.g. "B1", "C2", "B2" |
| `evse.solar_stop_timer` | int | Optional | "Stopping in Xs" when > 0 |
| `evse.error` | string | Error banner | "None" or error text |
| `evse.temp` | int | °C | EVSE temperature |
| `evse.temp_max` | int | °C | Max temp limit |
| `evse.pwm` | int | % | Duty cycle (0–1024 → 0–100%) |
| `evse.rfid` | string | If RFID | Status or "Not Installed" |
| `settings.charge_current` | int | A (÷10) | Current charge current |
| `settings.override_current` | int | A (÷10) | Manual override |
| `settings.current_min` | float | A | Min current |
| `settings.current_max` | float | A | Max current |
| `phase_currents.L1/L2/L3/TOTAL` | int | A (÷10) | Mains currents |
| `phase_currents.last_data_update` | int | Timestamp | Data age |
| `ev_meter.*` | object | If enabled | Power, energy, currents |
| `home_battery.*` | object | If enabled | Battery status, current |
| `mqtt.status` | string | If MQTT | "Connected"/"Disconnected" |
| `ev_state.*` | object | If modem | SoC, time to full, etc. |

#### Quick Controls (POST /settings)

| Control | POST param | Values | When visible |
|---------|------------|--------|--------------|
| Mode buttons | `mode` | 0,1,2,3,4 | Always (slaves: limited) |
| Override current | `mode_override_current` | 0 or 6–80 (A) | Normal/Smart only, not Solar, not slave |
| Solar start current | `solar_start_current` | 0–16 | Solar mode only |
| Solar max import | `solar_max_import` | 0–16 | Solar mode only |
| Solar stop time | `solar_stop_time` | minutes | Solar mode only |
| LCD Lock | `lcdlock` | 0, 1 | Always |
| Cable Lock | `cablelock` | 0, 1 | If lock != 0 |
| Delayed start/stop | `starttime`, `stoptime`, `repeat` | datetime strings | Always |
| PWM override | `override_pwm` | 0–1024 | Modem builds only |

#### Conditional Visibility

- **Load balancing slave** (`evse.loadbl` ≥ 2): Hide override, show "Slave Node X", some controls disabled
- **Solar mode** (`mode_id` == 2): Show solar params, hide override current
- **MQTT disabled**: Hide MQTT status
- **Mains meter disabled**: Hide phase currents
- **EV meter disabled**: Hide EV meter card
- **Home battery disabled**: Hide battery card
- **Modem/EV state**: Hide ev_state block if not available

---

### 3.2 Settings Page

**Purpose:** All configuration in logical sections. Split into **sub-sections** (tabs, accordion, or separate pages).

#### 3.2.1 Settings Sections

| Section | Content | POST params |
|---------|---------|-------------|
| **EVSE Configuration** | Node & hardware, system & grid, meters, switch & safety, general | See table below |
| **Solar** | Start current, max import, stop time | `solar_start_current`, `solar_max_import`, `solar_stop_time` |
| **MQTT** | Host, port, username, password, topic prefix, TLS, CA cert | `mqtt_update=1`, `mqtt_host`, etc. |
| **Home Assistant** | Enabled, URL, port, token, refresh, mains entities, test | `ha_enabled`, `ha_server_url`, etc. |
| **OCPP** | Enable, backend URL, charge box ID, auth key, auto-auth, idTag | `ocpp_update=1`, `ocpp_mode`, etc. |

#### 3.2.2 EVSE Configuration – Full Field List

| Field | Input type | Param name | Values / validation |
|-------|------------|------------|---------------------|
| Config | select | `config` | 0=Socket, 1=Fixed Cable |
| Lock | select | `lock` | 0=Disabled, 1=Solenoid, 2=Motor |
| Max current source | select | (via `max_current_source`) | 0=Static, 1=MQTT, 2=Home Assistant |
| Max current (A) | number | `current_max` | 6–80, when source=Static |
| MQTT topic | text | `max_current_mqtt_topic` | When source=MQTT |
| Max current unit | select | `max_current_ha_unit` | 0=A, 1=W, 2=kW |
| Phase voltage (V) | number | (from `ha.mains_voltage`) | 100–300, when unit=W/kW |
| Max current entity | text | `max_current_ha_entity` | HA entity ID, when source=HA |
| Circuit max (A) | number | `current_max_circuit` | 10–160 |
| Load balance | select | `loadbl` | 0–8 (Disabled, Master, Node 1–7) |
| Mains max (A) | number | `current_main` | 10–200 |
| Grid | select | `grid` | 0=4Wire, 1=3Wire |
| SB2 WiFi | select | `sb2_wifi` | 0=Disabled, 1=Enabled, 2=SetupWifi |
| Mains meter type | select | `mains_meter_type` | From `meter_types` array |
| Mains meter address | number | `mains_meter_address` | 10–247, when Modbus |
| Mains API source | select | `ha_mains_api_source` | 0=MQTT, 1=Home Assistant |
| Mains unit | select | `ha_mains_unit` | 0=A, 1=W, 2=kW |
| Mains voltage | number | `ha_mains_voltage` | 100–300 |
| L1/L2/L3 entity | text | `ha_mains_entity_l1` etc. | When API=HA |
| EV meter type | select | `ev_meter_type` | From `meter_types` |
| EV meter address | number | `ev_meter_address` | 11–247, when Modbus |
| Solar meter source | select | `solar_meter_source` | 0=Disabled, 1=MQTT, 2=HA |
| Solar meter MQTT topic | text | `solar_meter_mqtt_topic` | When source=MQTT |
| Solar meter unit | select | `solar_meter_unit` | 0=A, 1=W, 2=kW |
| Solar meter entity | text | `solar_meter_ha_entity` | When source=HA |
| Switch (SW pin) | select | `switch` | 0–7 (see options) |
| RCMon | checkbox | `rcmon` | 0/1 |
| RFID reader | select | `rfidreader` | 0–6 |
| Autoupdate | checkbox | `autoupdate` | 0/1 |
| Max temp (°C) | number | `max_temp` | 40–75 |
| LCD PIN | number | `lcd_pin` | 0–9999 |
| App server | checkbox | `app_server` | 0/1 (MQTT only) |

**Save:** Single "Save EVSE configuration" button sends all EVSE config fields in one POST.

#### 3.2.3 Conditional Fields

- **Mains meter address**: Show when meter type is Modbus (not Disabled, Sensorbox, API, HomeWizard P1)
- **Mains API options**: Show when `mains_meter_type` = 9 (API)
- **HA entity rows**: Show when `ha_mains_api_source` = 1
- **EV meter address**: Show when EV meter type is Modbus
- **Max current HA voltage**: Show when `max_current_ha_unit` = 1 or 2
- **Master-only**: Load balance, mains max, grid, meters, etc. disabled on slaves

#### 3.2.4 HA Entity Validation

- **Endpoint:** `GET /api/validate_ha_entity?entity_id={id}`
- **Response:** `{"ok": true}` or `{"ok": false, "error": "not_found"}`
- **Usage:** Debounce 500ms on input, show ✓/✗ next to entity fields

---

### 3.3 Log Page

**Purpose:** Live log viewer with level filtering and text search.

#### API

- **GET** `/api/logs?lines=80` → `{"total": N, "available": M, "lines": ["[I] msg", ...]}`
- **Polling:** Client polls every 3–60 seconds (user configurable)
- **Log format:** `[LEVEL] message` — LEVEL = A, E, W, I, D, V or other

#### UI Elements

| Element | Type | Notes |
|---------|------|-------|
| Level filter | Checkboxes | A, E, W, I, D, V, Other, All |
| Text filter | Input | Filter lines by substring |
| Poll interval | Number input | 1–60 seconds |
| Log display | Scrollable area | Monospace, color by level |
| Status | Text | "Waiting…" / "X lines" |

#### Persistence

- Store filter state in `localStorage` (`smartevse_log_filter`, `smartevse_log_topic_filter`)

---

### 3.4 Logic Flow Page

**Purpose:** Visual diagram showing how Smart and Solar modes decide charge current.

#### Content to Illustrate

**Smart Mode:**
- Uses mains meter (L1+L2+L3) to compute available current
- `IsetBalanced` = min(MaxMains - Baseload, MaxCircuit - Baseload_EV, …)
- Increases slowly (1/4 of difference), decreases immediately
- Respects MaxSumMains, Grid Relay, etc.

**Solar Mode:**
- Uses surplus current: `Isum` = grid import (negative = export)
- **Start:** Charging starts when surplus ≥ StartCurrent (sum of phases)
- **During charge:** `IsumImport = Isum - (10 * ImportCurrent)` — allows grid import up to ImportCurrent
- **Ramp-up:** +0.5A or +0.1A when surplus available; -variable when over
- **Stop:** SolarStopTimer when IsetBalanced < min needed; StopTime minutes
- **1P vs 3P:** With C2=AUTO, can switch from 1P to 3P when current high enough

#### Data to Show (Live)

| Data | Source | Use |
|------|--------|-----|
| `mode` | GET /settings | Highlight active branch |
| `evse.state` | GET /settings | State (A, B, C) |
| `evse.pwm` | GET /settings | Current PWM |
| `settings.charge_current` | GET /settings | Balanced[0] |
| `phase_currents.*` | GET /settings | Mains currents |
| `settings.solar_start_current` | GET /settings | Start threshold |
| `settings.solar_max_import` | GET /settings | Import limit |
| `evse.solar_stop_timer` | GET /settings | Countdown |

#### Design Notes

- **Flowchart or diagram** — boxes for: Mains Meter → Calc → IsetBalanced → PWM
- **Highlight active path** based on `mode_id`
- **Show live values** in diagram (e.g. "Isum = -12.3 A", "StartCurrent = 6 A")
- **Static diagram** is fine; live values can be overlaid via JS

---

## 4. API Reference Summary

### 4.1 GET /settings

Returns JSON. Key top-level keys:

```
version, serialnr, mode, mode_id, car_connected
evse: { temp, temp_max, state, state_id, error, pwm, loadbl, solar_stop_timer, rfid, ... }
settings: { charge_current, override_current, current_min, current_max, ... }
phase_currents: { L1, L2, L3, TOTAL, last_data_update, original_data }
ev_meter: { description, type, currents, import_active_power, total_wh, charged_wh, ... }
home_battery: { current, last_update }
mqtt: { host, port, status, tls, ... }  // if MQTT enabled
ha: { enabled, server_url, port, token_set, refresh_interval, mains_*, test_result }
ocpp: { mode, backend_url, cb_id, status, auto_auth, auto_auth_idtag }
ev_state: { computed_soc, full_soc, time_until_full, evccid, ... }  // if modem
meter_types: [ "Disabled", "Sensorbox", ... ]
```

### 4.2 POST /settings

Query params. Examples:

```
mode=1
mode_override_current=32
solar_start_current=6
solar_max_import=10
solar_stop_time=5
lcdlock=1
cablelock=0
starttime=2025-03-06T08:00
stoptime=2025-03-06T22:00
repeat=1
override_pwm=512
required_evccid=ABC123
```

EVSE config: many params; see `saveEvseConfig()` in index.html for full list. Send as single POST with `param1=value1&param2=value2&...`.

### 4.3 GET /api/logs?lines=80

Returns `{"total": N, "available": M, "lines": ["[I] ...", ...]}`.

### 4.4 GET /api/validate_ha_entity?entity_id=sensor.xyz

Returns `{"ok": true}` or `{"ok": false, "error": "not_found"}`.

### 4.5 Other Endpoints

- `GET /settings` (no path) — raw JSON
- `POST /reboot` — reboot device
- `GET /mqtt_ca_cert` — fetch MQTT CA cert
- OTA, firmware upload — separate flows

---

## 5. Hook-up Checklist for Implementation

When implementing the Figma design:

1. **Map each UI element** to a data path (e.g. `#charge_current` ← `data.settings.charge_current`)
2. **Map each control** to a POST param (e.g. mode button → `mode=2`)
3. **Respect conditional visibility** — use `evse.loadbl`, `mode_id`, `data.mqtt`, etc.
4. **Preserve form dirty state** — don’t overwrite user edits with poll data
5. **Use same endpoints** — no backend changes required for basic redesign
6. **Keep IDs or add data attributes** — e.g. `data-settings-key="charge_current"` for easier binding
7. **Test on real device** — verify under 576KB assets, acceptable load time

---

## 6. File Structure (Current)

```
data/
  index.html    # Main UI (~2321 lines)
  log.html      # Log viewer
  styling.css   # Custom styles
  update2.html  # OTA update (separate flow)
```

Suggested structure after redesign:

```
data/
  index.html      # Home
  settings.html   # Settings (or #settings section)
  log.html        # Log
  logic.html      # Logic flow
  styling.css     # Shared styles
  (optional) app.js  # Shared JS if extracted
```

---

## 7. Appendix: Smart/Solar Logic (Simplified)

```
SMART MODE:
  IsetBalanced = f(MainsMeter, MaxMains, MaxCircuit, Baseload, MaxSumMains, ...)
  Increase: +Idifference/4 (slow)
  Decrease: +Idifference (fast)

SOLAR MODE:
  Isum = grid current (negative = export)
  Start: Isum >= -StartCurrent*10 (deci-amps)
  Import: allow up to ImportCurrent from grid
  Ramp: +0.5A or +0.1A if surplus; -variable if over
  Stop: SolarStopTimer when below min; StopTime minutes
```

---

*End of spec. For questions or clarifications, refer to `SmartEVSE-3/src/esp32.cpp` (GET/POST handlers), `SmartEVSE-3/src/main.cpp` (CalcBalancedCurrent), and `SmartEVSE-3/data/index.html` (current UI bindings).*
