# Home Assistant Mains Meter & Dynamic MaxMains – Two-Stage Plan

This document plans adding **Home Assistant API pull** support for mains meter data and an optional **dynamic MaxMains** (per-phase mains current limit), with a dedicated settings area, source choice (HA vs MQTT), unit options (A / W / kW), and strict **safety validation** so load balancing and current algorithms are never fed unsafe values.

References: [HA REST API](HA%20REST%20API.md), [PULL_FROM_EXTERNAL_API](PULL_FROM_EXTERNAL_API.md), [POWER_BASED_INPUT_DESIGN](POWER_BASED_INPUT_DESIGN.md), [DYNAMIC_GRID_IMPORT_LIMIT_PLAN](DYNAMIC_GRID_IMPORT_LIMIT_PLAN.md).

---

## Overview

| Stage | Scope |
|-------|--------|
| **Stage 1** | New **Home Assistant connection** settings frame: enable, server URL, port, token, refresh interval, and a **Test connection** button. |
| **Stage 2** | **Mains meter API path**: choose **Home Assistant** or **MQTT**; configure unit (A / W / kW), entity IDs or power+voltages; optional **dynamic MaxMains** subsection with same options. All values validated and clamped so load balancing stays safe. |

---

## Stage 1: Home Assistant Connection Settings

### 1.1 New settings frame / area

Add a dedicated **“Home Assistant”** (or “External API”) settings block, separate from the existing Mains/EV meter type picker. This block is the single place to enable “pull from HA” and configure the connection.

**Settings (persisted in NVS, same pattern as other prefs):**

| Setting | Type | Description | Default / bounds |
|--------|------|-------------|-------------------|
| **HA pull enabled** | bool | Master switch: when off, no HA requests are made; mains meter and dynamic MaxMains use MQTT/static only. | `false` |
| **Server URL** | string | Base URL without path (e.g. `http://192.168.1.10` or `https://ha.example.com`). No trailing slash. Stored as in `network_common` / prefs; max length ~80 chars. | `""` |
| **Port** | uint16_t | Port number (e.g. 8123). | `8123`, 1–65535 |
| **Token** | string | Long-Lived Access Token for `Authorization: Bearer TOKEN`. Stored like MQTT password (secure prefs if available). Max length ~128. | `""` |
| **Refresh interval (s)** | uint16_t | Seconds between pull runs (e.g. 5–60). Same interval used for all HA-sourced values (mains meter + dynamic MaxMains if enabled). | `10`, 5–120 |

**UI:**

- Section title e.g. **“Home Assistant (pull)”**.
- Checkbox: **Enable Home Assistant pull**.
- Inputs: **Server URL**, **Port**, **Token** (password-style), **Refresh interval (s)**.
- Button: **Test connection**.

### 1.2 Test connection

- **Action:** One GET request to `{ServerURL}:{Port}/api/` or a simple authenticated endpoint (e.g. `/api/config` or `/api/states/sun.sun`) with header `Authorization: Bearer {Token}`.
- **Success:** HTTP 200 → show “Connection OK” (or equivalent) in the UI / API response.
- **Failure:** 401 → “Invalid token”; 404 → “Not found” (endpoint); connection error / timeout → “Connection failed” or “Timeout”. No retries needed for the test; single request is enough.

Implementation can live in `esp32.cpp` (new POST handler e.g. `/settings/test_ha` or a param on POST `/settings`) or in `network_common.cpp` with a small HTTP client path. Reuse the same HTTP client / TLS patterns as HomeWizard P1 (or a dedicated HA client).

### 1.3 When HA pull is disabled

- Do not perform any HA GET requests.
- Mains meter: if type is “API”, only MQTT/REST push updates `MainsMeter.Irms[]` (current behaviour).
- Dynamic MaxMains: if enabled but source is “HA”, treat as “no value” (use static MaxMains only) when HA pull is off.

---

## Stage 2: Mains Meter API Path & Dynamic MaxMains

### 2.1 Mains meter source: Home Assistant vs MQTT

Introduce a **source** for the “API” mains meter (no new meter type in `EMConfig`; still `EM_API`):

- **MQTT (and REST)** – Current behaviour: values pushed via `Set/MainsMeter` (and `/currents`). Accepts L1:L2:L3 as deci-amps (e.g. `45:32:21`) or decimal amps (e.g. `4.5:3.2:2.1`).
- **Home Assistant** – Device pulls from HA on the configured refresh interval; no push needed.

**New setting:** e.g. `mains_meter_api_source` or `MainsMeterAPISource`: `0 = MQTT`, `1 = Home Assistant`. Stored in NVS; only relevant when `MainsMeter.Type == EM_API`. When `EM_API` and source is HA, do not overwrite `MainsMeter.Irms[]` from MQTT/REST (or define priority: e.g. HA overwrites, or “last write wins” with timestamp; recommend HA overwrites when source is HA).

### 2.2 Mains meter configuration when source is Home Assistant

**Unit choice:** A (amps), W (watts), or kW (kilowatts). Stored e.g. `mains_ha_unit`: 0 = A, 1 = W, 2 = kW.

**If unit = A (current):**

- **L1, L2, L3 entity IDs** – Optional. User can set only L1 (single phase), or L1+L2+L3. Empty = “don’t use this phase”.
- Per entity: GET `/api/states/<entity_id>`. Parse `state` as float (decimal amps). HA often returns e.g. `"12.5"` or `"12.5 A"`; strip optional unit suffix and parse. Store in `MainsMeter.Irms[i]` as **deci-amps** (×10). Unfilled phases: keep previous value or set 0 (recommend 0 for unfilled to avoid stale data).
- **Validation:** Before using a value, optionally GET the entity once (e.g. at config save or on first run). If response is **404**, show error in UI: “Entity not found: &lt;entity_id&gt;”. In the periodic pull, if a GET returns 404, do not update that phase (keep previous or set 0) and optionally set a “stale/error” flag for that phase so UI can show “404” or “Invalid”.
- **No “no decimal” requirement:** Values are decimal amps from HA (e.g. 12.5 A), converted to deci-amps internally (125). So user enters entity IDs only, not weird integer formats.

**If unit = W or kW:**

- **Single phase vs all phases** – Setting: e.g. `mains_ha_phases`: 1 = single phase, 3 = three phases. For single phase, one power value is used for “total” and converted to current using one voltage.
- **Per-phase voltages** – e.g. V1, V2, V3 (or single V for single phase). Used to compute amps from power: `I_A = P_W / V` (per phase). For 3-phase total power, convention from POWER_BASED_INPUT_DESIGN: e.g. `I_sum_equiv = P_total / V_phase` or split P across phases if per-phase power is provided. Keep it simple in v1: one total P and one V → one equivalent current for “sum”; or per-phase P and V → three currents.
- **Entity IDs for power** – Either one entity (total W or kW) or three (L1, L2, L3 power). If three, each phase: `I_i = P_i / V_i`, then fill `MainsMeter.Irms[i]` in deci-amps. If one total P and single phase: one current, put in L1 and 0 for L2/L3 (or scale for display; document behaviour).
- **kW:** Convert to W (×1000) then same formula.

**Safety (all paths):**

- Clamp every **current** written to `MainsMeter.Irms[]` to the same range as today: **-2000..2000** (deci-amps), i.e. -200 A..+200 A. Reject or clamp out-of-range values; do not write raw unchecked values into `Irms`.
- Clamp **voltage** to a sane range (e.g. 100–300 V) before division to avoid division by zero or crazy amps.
- If parsing fails (non-numeric `state`, missing key): do not update that phase; set 0 or keep previous and mark stale.

### 2.3 Dynamic MaxMains (optional subsection)

**Concept:** Optional **dynamic per-phase mains current limit** (MaxMains) that can be pulled from Home Assistant (or, later, MQTT). When valid, it is used in place of (or capped by) the static **MaxMains** in the same way as in DYNAMIC_GRID_IMPORT_LIMIT_PLAN: `effective_max_mains = min(static MaxMains, dynamic_value)` when dynamic is valid; otherwise use static MaxMains only.

**New subsection in settings:**

- **Enable dynamic MaxMains** – Bool. When off, only static MaxMains is used (current behaviour).
- When on:
  - **Source:** For v1, only “Home Assistant” (same HA connection as Stage 1). Requires “HA pull” enabled.
  - **Unit:** A, W, or kW (same as mains meter).
  - **If A:** One entity ID for “current limit” (single value = per-phase limit, or document that it’s applied to all phases equally). Optional: three entities (L1, L2, L3 limit). Clamp to e.g. 10–200 A (or 100–2000 deci-amps) so it can only tighten, not exceed sensible hardware.
  - **If W or kW:** One power value + one voltage (or per-phase); convert to current and use as per-phase limit. Same voltage/power sanity and current clamp.
- **Timeout:** Seconds without update after which dynamic value is invalid (e.g. 60–600). Same pattern as `homeBatteryLastUpdate` / solar meter timeout.

**Code touch points (high level):**

- New globals (e.g. in `main.h`): `dynamicMaxMainsDeciA`, `dynamicMaxMainsLastUpdate`, `dynamicMaxMainsTimeout`, config flags.
- In `CalcBalancedCurrent` / `IsCurrentAvailable`: use `effective_max_mains = dynamic valid ? min(MaxMains, dynamic_value_A) : MaxMains` (in the same places where `MaxMains` is used for per-phase headroom). Do **not** change the meaning of MaxCircuit or MaxSumMains.
- Pull loop: when “dynamic MaxMains” and HA are enabled, each refresh fetch the configured entity/entities, convert to amps, clamp, then set `dynamicMaxMainsDeciA` and `dynamicMaxMainsLastUpdate`.

### 2.4 Safety summary – do not break load balancing

- **MainsMeter.Irms[]:** Always clamp to **-2000..2000** deci-amps before write. Use the same validation as existing MQTT handler (-2000..2000).
- **Dynamic MaxMains:** Clamp to **[10, 200] A** (or [100, 2000] deci-amps), and **effective = min(static MaxMains, dynamic)** so dynamic can only tighten the limit.
- **Voltages:** Min 100 V, max 300 V (or similar); avoid division by zero and absurd currents.
- **Power (W/kW):** Reject negative if only import is expected, or allow negative and clamp resulting current; cap power to e.g. 500 kW to avoid overflow in conversion.
- **Stale / invalid:** On 404, timeout, or parse error, do not feed new value; use previous or 0 and treat as “invalid” so the rest of the logic falls back to static/safe behaviour.
- **No new meter type:** Keep `EM_API`; “source” (MQTT vs HA) and “unit” (A/W/kW) are configuration options for the API meter, not new entries in the meter list.

---

## Implementation outline

### Stage 1

| Area | Tasks |
|------|--------|
| **NVS / prefs** | Add keys: `HAEnabled`, `HAServerURL`, `HAPort`, `HAToken`, `HARefreshInterval`. Load/save in `read_settings` / `write_settings` (esp32.cpp). |
| **network_common** | Add function `testHomeAssistantConnection(url, port, token)` → bool or enum (success / 401 / 404 / timeout). Use HTTPClient or Mongoose HTTP GET with Bearer header. |
| **esp32.cpp** | GET /settings: include `ha_pull_enabled`, `ha_server_url`, `ha_port`, `ha_token` (masked in response if desired), `ha_refresh_interval`. POST /settings: accept same; on `test_ha=1` (or POST to `/settings/test_ha`), call `testHomeAssistantConnection` and return result in JSON. |
| **Web UI (index.html)** | New section “Home Assistant”: checkbox, URL, port, token, refresh interval, “Test connection” button that POSTs test and shows result. |

### Stage 2

| Area | Tasks |
|------|--------|
| **NVS / prefs** | Mains meter API: `MainsMeterAPISource`, `MainsHAUnit`, `MainsHAEntityL1/L2/L3`, `MainsHAVoltage1/2/3`, `MainsHAPhases` (1 or 3), power entity IDs if W/kW. Dynamic MaxMains: `DynamicMaxMainsEnabled`, `DynamicMaxMainsHAUnit`, entity/voltages/power entities, `DynamicMaxMainsTimeout`. |
| **network_common** | Implement HA pull loop (or extend a generic “pull” module): build GET URLs for each configured entity, Bearer auth, parse JSON `state`, convert to deci-amps (or W→A with voltages), clamp, then write to `MainsMeter.Irms[]` and/or `dynamicMaxMainsDeciA`. Call from a timer in `loop()` when HA pull enabled and interval elapsed (same pattern as `homewizard_loop()`). Entity validation: optional GET on config save or first run; return 404 to UI. |
| **main.cpp** | Introduce `effective_max_mains` where `MaxMains` is used for per-phase headroom; when dynamic MaxMains enabled and valid, `effective = min(MaxMains, dynamic_value_A)`. |
| **esp32.cpp** | GET /settings: expose all new keys (mains source, unit, entity IDs, voltages, dynamic MaxMains toggle and config, timeout). POST /settings: accept and validate entity IDs (optional: trigger one GET per entity to check 404). |
| **Web UI** | Subsection “Mains meter (API)”: when meter type is API, show “Source: MQTT | Home Assistant”. When HA: Unit (A / W / kW); if A: L1/L2/L3 entity ID inputs + validation status (OK / 404); if W/kW: phases, voltages, power entity ID(s). Subsection “Dynamic MaxMains”: enable toggle; same unit/entity/voltage options; timeout. Show “Connection OK” / “Entity not found” from test/validation. |

### Files to touch (summary)

| File | Stage 1 | Stage 2 |
|------|---------|---------|
| **src/esp32.cpp** | HA prefs load/save, GET/POST settings, test endpoint | Mains/dynamic MaxMains prefs, GET/POST, optional entity validation |
| **src/esp32.h** | — | Optional MENU_* or pref keys |
| **src/network_common.cpp** | `testHomeAssistantConnection()` | HA pull loop, entity GET, parse state, convert and clamp, write Irms/dynamicMaxMains |
| **src/network_common.h** | Declare test function | Declare pull/update function |
| **src/main.cpp** | — | `effective_max_mains`, use in IsCurrentAvailable / CalcBalancedCurrent |
| **src/main.h** | HA prefs externs / globals | Dynamic MaxMains globals, effective_max_mains |
| **data/index.html** | HA connection section + Test button | Mains meter source/unit/entities; Dynamic MaxMains subsection |

---

## API summary (HA REST)

- **Test:** `GET {base}/api/` or `/api/config` or `/api/states/sun.sun` with `Authorization: Bearer {token}`.
- **Entity state:** `GET {base}/api/states/<entity_id>` → JSON with `state` (string, often numeric), optional `attributes.unit_of_measurement`. 404 if entity not found.
- Parse `state` as float; strip optional “ A”, “ W”, “ kW” suffix; convert to internal units (deci-amps for current; W for power then I = P/V).

---

## Summary

- **Stage 1:** Dedicated HA connection frame (enable, URL, port, token, refresh interval) and a **Test connection** button that reports OK or error (401/404/timeout).
- **Stage 2:** Mains meter API path can use **Home Assistant** or **MQTT**. For HA: choose **A, W, or kW**; for A optionally set L1/L2/L3 entity IDs (decimal amps, no “no decimal” requirement); for W/kW set single/total phase, per-phase voltages, and power entity ID(s); internally convert to amps and clamp. Optional **dynamic MaxMains** subsection: same A/W/kW and config, feeds a dynamic per-phase limit capped by static MaxMains, with timeout.
- **Safety:** All currents clamped to existing ranges (-2000..2000 deci-amps for Irms; 10..200 A for dynamic MaxMains); effective MaxMains = min(static, dynamic); stale/invalid/404 do not feed unsafe values into load balancing or current algorithms.

This keeps the existing load balancing and current logic unchanged in meaning and adds HA as a safe, configurable pull source for mains meter and optional dynamic MaxMains.
