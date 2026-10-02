# Exposing LCD/Menu Settings on the Web UI

The SmartEVSE has a full configuration menu on the **physical LCD** (navigated with three buttons). The **web UI** and **Home Assistant** integration only expose a subset of those settings. The rest can only be changed via the device buttons or by **emulating button presses** over WebSocket (`/ws/lcd`), which drives the same menu state machine—hence the “screen emulation” instead of real form fields.

This document describes **what is missing**, **how the system works**, and **what it would take** to expose (some or all) menu settings as proper web/API settings.

---

## 1. How settings work today

### 1.1 Single source of truth: menu items

All configurable values are represented as **menu items** in `esp32.h`:

- **MenuStr[]** — One entry per item: LCD label, description, Min, Max, default.
- **MENU_xxx** — Index into that table (e.g. `MENU_CONFIG`, `MENU_MAX`, `MENU_MAINSMETER`).
- **setItemValue(nav, val)** and **getItemValue(nav)** in `main.cpp` — Get/set the underlying variable (Config, MaxCurrent, MainsMeter.Type, etc.) and optionally sync to CH32/ESP32 and NVS.

So **every setting that appears in the LCD menu is already get/set via `getItemValue`/`setItemValue`** with a known min/max. The missing piece is **exposing them on the web**.

### 1.2 What the web already does

- **GET /settings** (in `esp32.cpp` → `handle_URI`) returns a large JSON with:
  - **doc["settings"]**: charge_current, override_current, **current_min**, **current_max**, current_main, current_max_circuit, current_max_sum_mains, max_sum_mains_time, solar_*, **enable_C2**, mains_meter (description string), starttime, stoptime, repeat, **lcdlock**, **lock**, **cablelock**, required_evccid, etc.
  - **doc["evse"]**: loadbl, rfidreader (string), state, error, etc.
  - **doc["mqtt"]**: smartevse_server, etc.

- **POST /settings** (same file) accepts **only a subset** of params, e.g.:
  - backlight, **current_min**, **current_max_sum_mains**, **max_sum_mains_timer**, custombutton, **mode**, starttime, stoptime, repeat, **enable_C2**, stop_timer, **override_current**, solar_start_current, solar_max_import, override_pwm, required_evccid, **lcdlock**, **cablelock**, **ocpp_update** (and OCPP fields).

So many values are **read** in GET but **not writable** via POST. They can only be changed via the LCD (or WebSocket button emulation).

### 1.3 Screen emulation (WebSocket)

- **WebSocket** `/ws/lcd`: clients receive **LCD framebuffer as BMP** and can send **button events** (`{"button":"left|middle|right", "state":0|1}`).
- Those events are fed into the **same button/LCD logic** as the physical keys (`ButtonStateOverride`, `getButtonState()` in `glcd.cpp`), so the menu navigates and **setItemValue(LCDNav, value)** is called when the user “selects” a value.
- So the emulation is literally “remote control of the LCD menu,” not a dedicated settings API. That’s why it feels wrong: you’re driving a UI designed for a 3‑button device instead of editing settings directly.

---

## 2. Gap: menu items vs web/API

Below, “In GET” = present in GET /settings response; “In POST” = accepted by POST /settings. All of these are in **MenuStr** and **setItemValue**/getItemValue.

| Menu item (LCD)        | GET /settings field(s)     | In POST? | Variable / MENU_xxx     |
|------------------------|-----------------------------|----------|--------------------------|
| CONFIG (Socket/Cable)  | —                           | No       | Config, MENU_CONFIG     |
| LOCK (actuator type)  | lock                        | No       | Lock, MENU_LOCK         |
| MIN current            | current_min                 | Yes      | MinCurrent               |
| MAX current            | current_max                 | No       | MaxCurrent, MENU_MAX    |
| PWR SHARE (load bal.) | evse.loadbl                 | No       | LoadBl, MENU_LOADBL     |
| SWITCH (pin function) | —                           | No       | Switch, MENU_SWITCH     |
| RCMON                  | —                           | No       | RCmon, MENU_RCMON       |
| RFID reader            | evse.rfidreader (string)    | No       | RFIDReader, MENU_RFIDREADER |
| EV METER type          | ev_meter.description        | No       | EVMeter.Type            |
| EV METER address       | ev_meter.address            | No       | EVMeter.Address         |
| MODE                   | mode, mode_id               | Yes      | Mode                    |
| CIRCUIT                | current_max_circuit         | No       | MaxCircuit, MENU_CIRCUIT |
| GRID                   | —                           | No       | Grid, MENU_GRID         |
| SB2 WIFI               | —                           | No       | SB2_WIFImode            |
| MAINS                  | current_main                | No       | MaxMains, MENU_MAINS    |
| START (solar)          | solar_start_current         | Yes      | StartCurrent            |
| STOP (solar)           | solar_stop_time             | Yes (stop_timer) | StopTime  |
| IMPORT                 | solar_max_import            | Yes      | ImportCurrent           |
| MAINS METER type       | mains_meter (desc)          | No       | MainsMeter.Type         |
| MAINS METER address    | —                           | No       | MainsMeter.Address      |
| Custom meter (all)     | —                           | No       | EMConfig[EM_CUSTOM].*   |
| WIFI                   | wifi.status/ssid            | No       | WIFImode, MENU_WIFI     |
| AUTOUPDAT              | —                           | No       | AutoUpdate              |
| CONTACT 2              | enable_C2                   | Yes      | EnableC2                |
| MAX TEMP               | evse.temp_max               | No       | maxTemp                 |
| CAPACITY               | current_max_sum_mains       | Yes      | MaxSumMains             |
| CAP STOP               | max_sum_mains_time          | Yes      | MaxSumMainsTime         |
| LCD PIN                | —                           | No       | LCDPin, MENU_LCDPIN     |
| APP PIN                | —                           | No       | PairingPin (read-only) |
| APP SERVR               | mqtt.smartevse_server       | No       | MQTTSmartServer         |

So: **most menu items are readable in GET but not writable in POST.** A few (mode, solar params, enable_C2, lcdlock, cablelock, override, OCPP, MQTT) are already full round-trip.

Note: **AUTOMATED_TESTING** (compile flag) enables an extra endpoint that accepts e.g. `current_max`, `current_main`, `current_max_circuit` for testing—but that’s not the normal user-facing API.

---

## 3. What it would take to expose settings on the web

Goal: **allow changing any of the above (or a chosen subset) from the web UI and/or Home Assistant** without using the LCD or screen emulation.

### 3.1 Backend (HTTP API)

**Where:** `esp32.cpp` → `handle_URI()` → branch that handles **POST** to `/settings`.

**Approach:**

1. **Add POST parameters** for each setting you want to expose. For each param:
   - Parse value (int/string as appropriate).
   - Optionally check bounds using **MenuStr[nav].Min** and **MenuStr[nav].Max** (same as LCD).
   - Call **setItemValue(nav, value)** (or set the variable and then `request_write_settings()` if you need to persist and the item is in NVS).

2. **Use existing persistence:**  
   `setItemValue()` already updates the global (Config, MaxCurrent, etc.). For ESP32, **write_settings()** in `esp32.cpp` persists all of these to NVS (Preferences). So after `setItemValue()` you only need to call **request_write_settings()** so the next periodic write (or immediate write) saves to flash. No new persistence layer.

3. **Slave / LoadBl:**  
   For **LoadBl ≥ 2** (slave), some settings are system-wide and must not be changed on the slave (they come from the master). The code already has patterns (e.g. `LoadBl < 2` checks). Apply the same: only accept POST for “system” or “master-only” settings when `LoadBl < 2`, and optionally return an error for slaves.

4. **Suggested param names** (align with GET where it exists):
   - config, lock, current_max, loadbl, switch, rcmon, rfidreader, ev_meter_type, ev_meter_address, current_max_circuit, grid, sb2_wifi, current_main, mains_meter_type, mains_meter_address, autoupdate, max_temp, lcd_pin, app_server (and for custom meter: em_endianness, em_datatype, em_function, em_*_register, em_*_divisor, etc.).

**Effort:** Add one `if (request->hasParam("...")) { ... setItemValue(...); doc["..."] = ...; }` block per setting (or a small loop over a table of param → MENU_xxx if you prefer). Validation: use MenuStr[nav].Min/Max. Low risk if you keep the same bounds as the LCD.

### 3.2 GET /settings (optional but useful)

Most of these are already in the GET response (e.g. current_max, current_main, loadbl, lock, rfidreader, ev_meter.*, mains_meter). Add any **missing** keys so the web UI and HA can show current values (e.g. config, switch, rcmon, grid, sb2_wifi, mains_meter_address, autoupdate, max_temp, lcd_pin, app_server, custom meter fields). That’s mostly adding more `doc["settings"]["..."] = ...` (or similar) in the GET branch.

### 3.3 Web UI (index.html)

**Where:** `data/index.html` — same page that today shows mode, solar params, override, lcdlock, cablelock, OCPP, MQTT, etc.

**Approach:**

1. **Add a “Settings” or “EVSE configuration” section** (or split into “Node settings” and “System settings” to mirror the menu).
2. For each setting you exposed in POST:
   - **Display:** Use the existing `loadData()` that GETs `/settings` and fill new elements (e.g. `#config`, `#current_max`, `#switch`, …) from `data.settings.*` or `data.evse.*`.
   - **Edit:** Add an input (number, select, or checkbox) with the same bounds as MenuStr (and optionally descriptions from MenuStr or a small JS map).
   - **Save:** On “Save” or per-field change, **POST to /settings** with the same param names you added on the backend (e.g. `$.post("/settings?current_max=" + val)` or a single form that collects all and POSTs).

3. **Labels/descriptions:** You can reuse **MenuStr[].Desc** by exposing it in GET (e.g. a `menu_descriptions` object keyed by param name) or duplicate the strings in JS. The former keeps one source of truth.

4. **Slave nodes:** If the backend returns 403 or a “read-only” flag for certain keys when LoadBl ≥ 2, hide or disable the corresponding inputs on the web UI for slaves.

**Effort:** Mostly form layout and wiring existing GET/POST. No new backend protocol.

### 3.4 Home Assistant

The integration likely uses **MQTT** or **REST** to read state and possibly send commands.

- **MQTT:** The firmware already publishes many values (e.g. LoadBl, RFID, meter data). Add **publish on change** for any new setting you add (so HA sees updates), and **subscribe** to **Set/…** topics for settings you want HA to control (following the existing pattern, e.g. `MQTTprefix + "/Set/CurrentOverride"`). In `esp32.cpp` / `network_common.cpp`, add handlers that call `setItemValue(...)` and then publish the new value.
- **REST:** If HA uses REST instead, then exposing GET/POST as above is enough; HA would call GET /settings to read and POST /settings to write. No extra backend work beyond what’s in 3.1–3.2.

So: **exposing a setting in POST /settings and in the web UI is enough for REST-based HA.** For MQTT-based HA, add the corresponding MQTT publish/subscribe for that setting.

### 3.5 Custom meter (EM_CUSTOM)

The custom meter has many registers/divisors (U, I, P, E, endianness, data type, function). They’re all in **MenuStr** and **getItemValue**/setItemValue (MENU_EMCUSTOM_*). To expose them:

- **GET:** Add to `doc["settings"]` (or a dedicated `doc["custom_meter"]`) all EMConfig[EM_CUSTOM] fields you already persist in read_settings/write_settings.
- **POST:** Add params for each (e.g. em_endianness, em_uregister, em_udivisor, …) and call setItemValue for the corresponding MENU_EMCUSTOM_xxx (or set EMConfig[EM_CUSTOM] and request_write_settings).
- **Web UI:** One subsection “Custom meter” with inputs for each field. Optional: show this only when mains or EV meter type is “Custom.”

---

## 4. Implementation outline

### Phase 1 — Backend only (no UI change)

1. In **esp32.cpp** POST /settings handler, add handling for a **small set** of high-value params, e.g.:
   - **current_max**, **current_main**, **current_max_circuit**
   - **config**, **lock**, **switch**, **rcmon**, **loadbl**
   - **grid**, **sb2_wifi**, **mains_meter_type**, **mains_meter_address**, **ev_meter_type**, **ev_meter_address**
   - **rfidreader**, **autoupdate**, **max_temp**, **lcd_pin**, **app_server**
2. For each: `request->hasParam(...)`, parse, bounds-check with MenuStr (or existing constants), call **setItemValue(MENU_xxx, value)** (or the right STATUS_/MENU_ constant), set **doc["..."]** in the response, then **request_write_settings()**.
3. Add any missing keys to **GET** /settings for the same items so the UI can display them.

### Phase 2 — Web UI

1. In **data/index.html**, add a “Configuration” (or “EVSE settings”) section.
2. For each new GET key, add a display element and, where appropriate, an input (number/select/checkbox).
3. On save, build a query string or form data with the same param names and **POST /settings** (same pattern as existing solar/mode/lcdlock/cablelock).

### Phase 3 — Optional

- Expose **custom meter** registers (GET + POST + UI subsection).
- Add **MQTT** Set/ topics and publish-on-change for the new settings so MQTT-based HA can read/write them.
- Add a **single “Export / Import settings”** endpoint (e.g. GET returns full config JSON, POST accepts same JSON) for backup/restore or bulk edit.

---

## 5. Files to touch

| File | Role |
|------|------|
| **src/esp32.cpp** | GET /settings: add missing keys. POST /settings: add `hasParam` + `setItemValue` + bounds check + `request_write_settings()` for each new setting. |
| **src/main.cpp** | No change required; **setItemValue** / **getItemValue** already implement all menu items. |
| **src/esp32.h** | No change required; **MenuStr** and MENU_xxx are already defined. |
| **data/index.html** | New section(s) for configuration; read from GET response, write via POST /settings. |
| **src/network_common.cpp** | Only if you add MQTT Set/ topics or publish new settings over MQTT. |

---

## 6. Summary

- **Why it’s like this:** The project centered configuration on the LCD menu and reused that same path for “web” by emulating button presses over WebSocket instead of adding a real settings API.
- **What’s missing:** Most menu items are **read** in GET /settings but **not writable** in POST /settings; the web UI only has form fields for a subset.
- **What it takes:** Add POST parameters in **esp32.cpp** that call **setItemValue()** (and optionally extend GET). Add matching form fields in **index.html** that read from GET and POST to /settings. Optionally add MQTT for HA. No change to the LCD menu logic or to **main.cpp**’s setItemValue/getItemValue.
- **Benefit:** Users (and HA) can configure the EVSE from the web or automation without using the physical buttons or the LCD emulation.

Once you decide which settings to expose first (e.g. current_max, config, switch, rcmon, loadbl, meters, WiFi mode, autoupdate), you can implement Phase 1 in a single pass in `esp32.cpp`, then add the corresponding UI in `index.html`.
