# SmartEVSE Project — Technical Overview & Development Guide

This document describes how the SmartEVSE firmware and software work so you can extend or fix the project. It covers architecture, build system, state machine, key modules, and extension points.

---

## 1. Project overview

**SmartEVSE** is an open-source Electric Vehicle Supply Equipment (EVSE) controller. The repo builds:

| Target | Hardware | Role |
|--------|----------|------|
| **SmartEVSE v3** | ESP32 (single MCU) | CP/PWM, Modbus, LCD, relays, everything on one chip |
| **SmartEVSE v4** | ESP32-S3 + CH32V203 | ESP32: WiFi, web, OCPP, load balancing, modem; CH32: CP/PWM, ADC, contactors, RCM, RS485 |
| **CH32 only** | CH32V203 | Standalone firmware for the v4 mainboard (talks to ESP32 over UART) |

- **Version macros**: `SMARTEVSE_VERSION=30` (v3), `SMARTEVSE_VERSION=40` (v4). CH32 build has `SMARTEVSE_VERSION` undefined.
- **Shared code**: Most logic lives in `src/main.cpp` (large, 3600+ lines) and is compiled for both ESP32 and CH32 with `#if (SMARTEVSE_VERSION …)` and `#ifndef SMARTEVSE_VERSION`.
- **Platform**: PlatformIO; framework = Arduino (ESP32) or bare-metal (CH32).

---

## 2. Repository layout

```
SmartEVSE-3/
├── platformio.ini          # Envs: release (v3), v4, ch32
├── partitions_custom.csv   # v3 partition (NVS, OTA, SPIFFS)
├── partitions_custom_v4.csv
├── packfs.py               # Packs data/ into packed_fs.c (gzipped) for Mongoose
├── replace_mbedtls.py      # Pre-build: swap in custom mbedTLS libs (smaller)
├── make_ch32.py            # Pre-build v4: build CH32, copy firmware.bin → data/
├── gen_ldscript.py         # CH32 linker script
├── src/
│   ├── main.cpp            # Shared EVSE logic, state machine, globals (ESP32 + CH32)
│   ├── main.h              # Defaults, pin macros, Button, Node_t, MENU_* etc.
│   ├── main_c.h            # IEC 61851 state #defines, error flags, C-only decls
│   ├── evse.c / evse.h     # CH32: buffers, ISRs, GPIO/UART/ADC/TIM init, CP PWM
│   ├── esp32.cpp / esp32.h # ESP32: setup(), loop(), pins, NVS, LCD menu strings
│   ├── ch32.cpp / ch32.h   # CH32 pin defs (PA*, PB*), log levels
│   ├── ch32v003fun/        # CH32 SDK (init, sysclock, UART printf, etc.)
│   ├── meter.cpp / meter.h # Modbus meters (Mains, EV), EM_* types, Meter class
│   ├── modbus.cpp / modbus.h # Modbus RTU client/server, registers, load-balance protocol
│   ├── network_common.cpp  # Mongoose HTTP/WS, MQTT (ESP), WiFi, OTA, /settings API
│   ├── network_common.h    # MQTTclient_t, webServerRequest, mgr, WiFi/MQTT decls
│   ├── tcp.cpp             # v4: ISO 15118 TCP/V2GTP/EXI over QCA7000 (IPv6)
│   ├── qca.cpp / qca.h     # v4: QCA7000 SPI driver, Ethernet frames
│   ├── ipv6.h / ipv6.cpp   # IPv6 headers, checksums for tcp.cpp
│   ├── mongoose.c / .h     # Mongoose networking (HTTP, WS, packed FS)
│   ├── glcd.cpp / glcd.h   # LCD drawing, menu navigation (v3)
│   ├── utils.cpp           # Helpers
│   ├── wchisp.cpp          # v4: CH32 bootloader (WCH-Link) flashing from ESP32
│   ├── OneWire*.cpp/h      # 1-Wire (temperature, RFID)
│   ├── exi2/               # EXI codecs for ISO 15118-2 (DIN), ISO 15118-20 (AC)
│   └── ...
├── data/                   # Web UI and assets (packed into firmware)
│   ├── index.html
│   ├── styling.css
│   ├── update2.html        # OTA update page
│   └── cert.pem / key.pem  # HTTPS (optional)
├── lib/
│   └── RemoteDebug         # Telnet debug server (optional)
├── custom_libs/            # Custom mbedTLS .a for ESP32 (smaller TLS)
└── test/                   # Scripts (e.g. feed_mains.sh for testing)
```

---

## 3. Build system

### 3.1 PlatformIO environments

- **`release`** (default): ESP32 (board `esp32dev`), v3. Partition: `partitions_custom.csv`. Pre scripts: `packfs.py`, `replace_mbedtls.py`. Defines: `SMARTEVSE_VERSION=30`, `ENABLE_OCPP=1`, Mongoose packed FS, etc.
- **`v4`**: ESP32-S3 (`esp32-s3-devkitc-1`), PSRAM. Partition: `partitions_custom_v4.csv`. Pre: `make_ch32.py`, `packfs.py`. Defines: `SMARTEVSE_VERSION=40`, `MODEM=1`, `BOARD_HAS_PSRAM`, USB CDC.
- **`ch32`**: CH32V203 (community platform). Builds only C/C++ needed for CH32; excludes `RemoteDebug`, `mongoose.c`, etc. Pre: `gen_ldscript.py`.

### 3.2 Key pre-build steps

1. **packfs.py**  
   Gzips files in `data/` (except certs, CH32 bin), runs `pack.py` to generate `src/packed_fs.c` for Mongoose’s packed filesystem (`MG_ENABLE_PACKED_FS`).

2. **replace_mbedtls.py**  
   Copies custom mbedTLS libs from `custom_libs/` into the ESP32 framework to reduce TLS RAM/flash.

3. **make_ch32.py**  
   Runs `pio run -e ch32` and copies `.pio/build/ch32/firmware.bin` to `data/CH32V203.bin` so the v4 ESP32 can flash the mainboard MCU via the web updater or wchisp.

### 3.3 Flashing

- **v3**: Flash `firmware.bin` via serial or OTA (e.g. `http://smartevse-xxx/update`). See `HowToFlash.txt`.
- **v4**: Flash ESP32-S3 first; then flash CH32 (e.g. via WCH-Link or the built-in path that uses `data/CH32V203.bin`).

---

## 4. Architecture: who does what

### 4.1 SmartEVSE v3 (single ESP32)

- One binary. ESP32 drives:
  - **CP (Control Pilot)**: PWM on GPIO, ADC for CP/PP/temperature.
  - **Modbus RTU**: Serial1, RS485 for meters and load-balancing.
  - **LCD**: SPI.
  - **Relays**: SSR1/SSR2, actuator (lock), RCM, etc.
- `evse.c` is not used in the v3 build (only CH32). CP and contactors are controlled directly from `main.cpp` / `esp32.cpp` via `CONTACTOR1_ON/OFF`, `SetCPDuty`, etc.

### 4.2 SmartEVSE v4 (ESP32-S3 + CH32V203)

- **CH32** (firmware from `env:ch32`):
  - **CP**: PWM (TIM1), ADC for CP/PP/temperature, pilot state.
  - **Relays**: SSR1, SSR2, actuator, RCM fault input, modem power.
  - **RS485**: Modbus timing, RX/TX.
  - **Communication**: UART1 to ESP32 at 500000 baud; protocol is text: `@Key:value\n` (and `@Key?\n` for requests).

- **ESP32-S3**:
  - WiFi, HTTP/HTTPS (Mongoose), WebSocket, MQTT, OCPP (MicroOcpp).
  - Load balancing (master/node), meters (Modbus master), NVS settings.
  - Optional: QCA7000 (Ethernet) for ISO 15118 over IPv6 (`tcp.cpp`, `qca.cpp`).
  - Sends commands to CH32 over Serial1 (`SEND_TO_CH32(...)` → `Serial1.printf("@%s:%u\n", ...)`).
  - Receives CH32 messages in `loop()` by reading Serial1 and parsing lines (`SerialBuf`); handlers use `CALL_ON_RECEIVE`, `CALL_ON_RECEIVE_PARAM`, `SET_ON_RECEIVE` macros to call e.g. `setState()`, set `pilot`, etc.

So on v4, **state and pilot are decided in shared logic in `main.cpp`**, but **CP output and contactors are on CH32**; the ESP32 just sends `@SetCPDuty:...`, `@State:...`, etc., and gets back `@State:...`, `@Pilot:...`, `@Temp:...`.

### 4.3 CH32 ↔ ESP32 protocol (v4)

- **ESP32 → CH32** (examples):  
  `@State:2`, `@SetCPDuty:512`, `@SetCurrent:160`, `@Access:1`, `@Mode:1`, `@ChargeDelay:0`, `@setErrorFlags:1`, `@clearErrorFlags:1`, `@RequiredEVCCID:...`, `@Irms:011,312,123,124`, `@version?`, `@PowerPanicCtrl:0`, `@RCmon:1`, etc.
- **CH32 → ESP32**:  
  `@State:...`, `@Pilot:...`, `@Temp:...`, `@MSG:...`, `@ExtSwitch:...`, `@setStatePowerUnavailable`, etc.
- Parsing on ESP32: in `esp32.cpp` / `main.cpp`, `Serial1.readBytesUntil('\n', SerialBuf, ...)` then string match on `SerialBuf` (e.g. `strstr(SerialBuf, "State:")`) and `atoi()` for parameters.

---

## 5. State machine (IEC 61851-1)

States are in `main_c.h`; handling is in `main.cpp` (`setState()`, and the big “every 100 ms” block that drives transitions).

| State | Name (concept) | Meaning |
|-------|----------------|--------|
| **STATE_A** (0) | Vehicle not connected | No car; CP 12 V |
| **STATE_B** (1) | Vehicle connected, not ready | Car connected; CP 9 V |
| **STATE_C** (2) | Charging | Car ready; PWM present; contactors closed |
| **STATE_D** (3) | Ventilation (not implemented) | — |
| **STATE_COMM_B** (4) | Request A→B | Load-balance node request |
| **STATE_COMM_B_OK** (5) | A→B OK | Master response |
| **STATE_COMM_C** (6) | Request B→C | Node request to charge |
| **STATE_COMM_C_OK** (7) | B→C OK | Master response |
| **STATE_ACTSTART** (8) | Activation | — |
| **STATE_B1** (9) | EVSE not ready (no PWM) | Connected but no power offered |
| **STATE_C1** (10) | Stopping (no PWM) | Stopping charge, PWM off |
| **STATE_MODEM_REQUEST** (11) | ISO 15118 setup | CP 0% for modem |
| **STATE_MODEM_WAIT** (12) | ISO 15118 wait | CP 5% |
| **STATE_MODEM_DONE** (13) | Modem done | SoC etc. received |
| **STATE_MODEM_DENIED** (14) | Modem denied | EVCCID not allowed |

- **Pilot** values: `PILOT_12V` (A), `PILOT_9V` (B), `PILOT_6V` (C), `PILOT_3V`, `PILOT_DIODE`, `PILOT_NOK`, `PILOT_SHORT` (see `main.h`).
- **Errors** (e.g. in `ErrorFlags`): `NO_ERROR`, `LESS_6A`, `CT_NOCOMM`, `TEMP_HIGH`, `EV_NOCOMM`, `RCM_TRIPPED`, `RCM_TEST`, `Test_IO`, `BL_FLASH` (see `main_c.h`).
- **Modes**: `MODE_NORMAL` (0), `MODE_SMART` (1), `MODE_SOLAR` (2). Access: `AccessStatus_t` — `OFF`, `ON`, `PAUSE`.

Charging flow (simplified): A → B (plug in) → C (start charging) ↔ C1 (stop from EVSE). Load balancing uses COMM_B/COMM_C to coordinate multiple units. Solar/Smart logic and timers (e.g. `SolarStopTimer`, `ChargeDelay`) are applied in the same state machine.

---

## 6. Key modules

### 6.1 Meters (`meter.cpp` / `meter.h`)

- **MainsMeter**, **EVMeter**: type from `EM_*` (Sensorbox, Phoenix, Eastron, Finder, ABB, SolarEdge, Wago, API, HomeWizard P1, Schneider, Chint, Carlo Gavazzi, custom, etc.).
- Registers and divisors for U, I, P, E (and optionally export) per meter type; Modbus RTU (address, function 3/4, endianness, data type).
- **Meter::UpdateEnergies()**, **CalcImeasured()**, **receiveCurrentMeasurement()**, etc. On v4, part of the data is sent to CH32 via `@Irms:...`; timeouts can be sent as `@MainsMeterTimeout` / `@EVMeterTimeout`.
- **EM_API**: virtual meter fed by MQTT/API (e.g. `MQTTprefix + "/Set/MainsMeter"` with `L1:L2:L3`).

### 6.2 Modbus (`modbus.cpp` / `modbus.h`)

- **Registers**: Status (0x0000…), node config (0x0100…), system config (0x0200…). Used for load balancing (master broadcasts current, nodes report state) and for external Modbus clients.
- **ModbusServerRTU** / **ModbusClientRTU** (eModbus) on ESP32; on CH32, raw UART + DMA and timers (t3.5) in `evse.c`.
- Request/response loop and exception handling; integration with `Node[]`, `Balanced[]`, `BalancedState[]`, etc.

### 6.3 Network & web (`network_common.cpp`)

- **Mongoose** (`mgr`): HTTP on port 80 and 443 (TLS with packed cert/key). Serves static files from packed FS (`/data/*`), and handles:
  - **/**, **/save** — WiFi setup (AP mode).
  - **/settings** — GET: JSON status/settings for the web UI; POST: apply settings.
  - **/api/v1/data** — JSON API (used by UI and possibly other clients).
  - **/update**, **/autoupdate**, **/reboot**, **/erasesettings**.
  - **/ws/lcd** — WebSocket for LCD/control.
  - **/mqtt_ca_cert** — MQTT CA cert.
- **MQTT**: ESP-IDF client or Mongoose MQTT; topics under `MQTTprefix`; optional Home Assistant discovery; separate “SmartEVSE server” client. Publish: state, current, errors, etc. Subscribe: Set/CurrentOverride, Set/Access, Set/MainsMeter, Set/EVMeter, Set/HomeBatteryCurrent, Set/RequiredEVCCID, Set/Color*, etc.
- **WiFi**: STA/AP, mDNS (`smartevse-xxx.local`), NTP for delayed start/stop and OCPP.

### 6.4 OCPP (optional, ESP32 only)

- **MicroOcpp** + **MicroOcppMongooseClient**: WebSocket connection to OCPP backend; connector lock/unlock, start/stop transaction, meter values, RFID (e.g. `ocppUpdateRfidReading`, `OcppForcesLock`, `OcppTrackPermitsCharge`). Wired into state machine and access control in `main.cpp`.

### 6.5 ISO 15118 / modem (v4)

- **QCA7000** (qca.cpp): SPI to Ethernet chip; IPv6 link-local; TCP stack in `tcp.cpp` for V2GTP + EXI (ISO 15118-2/20).
- **exi2/** : EXI encoders/decoders (DIN, ISO2, ISO20 AC) for session setup, charge parameter discovery, power delivery, metering, etc.
- States **STATE_MODEM_*** and `Charging_Protocol_t` (IEC, DIN, ISO2, ISO20) switch between classic PWM-only and high-level modem session; SoC and session data are used for display and access control.

### 6.6 Settings & NVS (ESP32)

- **Preferences** (NVS): keys for mode, currents, circuit, meters, RFID, OCPP, WiFi, delayed start/stop, etc. Cached in `SettingsCache`; writes are batched and rate-limited (`request_write_settings()`, `write_settings()` in `esp32.cpp`). Load/save in `read_settings()` / `write_settings()`.

---

## 7. Web UI and API

- **Frontend**: `data/index.html` (jQuery + Bootstrap), loads `/settings` as JSON, shows state, mode, current, errors, solar timers, override, RFID, etc. Can POST to `/settings` and use WebSocket `/ws/lcd`.
- **API**: Main data from **GET /settings** (and **/api/v1/data**). Control and config via **POST /settings** and MQTT `Set/*` topics. No single OpenAPI file; routes are in `network_common.cpp` (`mg_http_match_uri`, `mg_match`).
- **OTA**: **/update** serves `update2.html`; user selects `firmware.bin` (and optional signed variant); backend uses `Update` library and optional signature check.

---

## 8. Where to add or change behaviour

- **State machine / charging logic**: `main.cpp` — `setState()`, the 100 ms timer block (state transitions, solar/smart, load balance, modem states).
- **Current and PWM**: `SetCurrent()`, `SetCPDuty()` in `main.cpp`; on v4 they forward to CH32; on v3 they drive LEDC directly.
- **Meters**: `meter.cpp` — add a new `EM_*` type and extend `EMConfig[]` and read logic; for “virtual” meter use `EM_API` and MQTT/API.
- **Modbus**: `modbus.cpp` — register map and load-balance protocol; also `main.cpp` for `Balanced[]`, `Node[]`, `BroadcastCurrent()`.
- **Web/API**: `network_common.cpp` — new `mg_http_match_uri` branch, extend JSON in the handler that serves `/settings` and `/api/v1/data`.
- **MQTT**: `network_common.cpp` (and esp32.cpp for callbacks) — new `Set/` topic or new publish in `mqttPublishData()` / `mqttSmartEVSEPublishData()`.
- **OCPP**: `main.cpp` and OCPP init/loop in `esp32.cpp`; MicroOcpp configuration and connector/transaction handling.
- **v4 CH32 ↔ ESP32**: extend the text protocol in `main.cpp` / `esp32.cpp` (new `@Key:value` or `@Key?\n`) and in `evse.c` (CH32) if you need new pins or timing.
- **ISO 15118**: `tcp.cpp` (TCP/V2GTP/EXI state machine), `qca.cpp` (Ethernet), `exi2/` (message types).

---

## 9. Defaults and compile-time options

Important defaults live in **main.h** (and a few in **platformio.ini**):

- Currents: `MAX_MAINS`, `MAX_CURRENT`, `MIN_CURRENT`, `MAX_CIRCUIT`, `START_CURRENT`, `STOP_TIME`, `IMPORT_CURRENT`.
- Mode: `MODE`, `LOADBL`, `SWITCH`, `RC_MON`, `RFID_READER`, `WIFI_MODE`, `MAINS_METER`, `EV_METER`, `CONFIG`, `LOCK`, `CABLE_LOCK`, `EnableC2`, `OCPP_MODE`, `AUTOUPDATE`, etc.
- Build flags: `ENABLE_OCPP`, `MODEM`, `DBG`, `FAKE_RFID`, `AUTOMATED_TESTING`, `FAKE_SUNNY_DAY` (see main.h comments).

Toggling these changes behaviour or enables debug/test features without changing UI.

---

## 10. Quick reference

| I want to… | Look at |
|------------|--------|
| Change max/min current or mode defaults | `main.h` defaults |
| Add a new meter type | `meter.h` EM_*, `meter.cpp` config and read |
| Add a web page or API endpoint | `network_common.cpp` `fn_http_server` |
| Change when we start/stop charging | `main.cpp` state machine and solar/smart logic |
| Add a new Modbus register | `modbus.cpp` + any handler in `main.cpp` |
| Add a MQTT topic | `network_common.cpp` / `esp32.cpp` subscribe; publish in mqtt*PublishData |
| Change v4 ESP32↔CH32 protocol | `main.cpp` SEND_TO_CH32, Serial1 parsing in `esp32.cpp`; `evse.c` printf/parser |
| Change OCPP behaviour | OCPP code in `main.cpp` and `esp32.cpp`; MicroOcpp config |
| Change ISO 15118 sequence | `tcp.cpp` FSM and EXI calls; `exi2/` message set |

This should be enough to navigate the codebase and add or fix features without getting lost. For deeper dives, keep `main.cpp` (state machine and globals) and `network_common.cpp` (web and MQTT) as primary entry points.
