# Online Logging to log.html — Replication Guide

This document describes how internal ESP32 logs are captured and exposed on the **log.html** web page in the Pettofoon 2.0 project, so you can replicate the same approach in another ESP32 project (including with **PlatformIO**). ESP-IDF–specific parts are clearly marked.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Application code                                                       │
│  ESP_LOGI(TAG, "message");  ESP_LOGE(TAG, "error");  etc.               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ESP-IDF logging (esp_log)  ◄── ESP-IDF SPECIFIC                        │
│  Uses current vprintf hook (default: UART)                               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────┐     ┌───────────────────────────────────────┐
│  CentralLogger hook       │     │  Original behavior                     │
│  (our custom vprintf)    │     │  Serial/UART output                    │
│  → ring buffer           │     │  (we call printf() from hook)          │
└─────────────┬─────────────┘     └───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  In-memory ring buffer (last N lines, e.g. 256 × 256 bytes)              │
│  Lock-free, non-blocking. Optional: PSRAM (ESP-IDF heap_caps).           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Web server                                                              │
│  • GET /log or /log.html  → serve log.html page (embedded or from FS)    │
│  • GET /api/logs?lines=N  → return recent logs as JSON                    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  log.html (browser)                                                      │
│  Polls GET /api/logs every few seconds, renders lines with color by level│
└─────────────────────────────────────────────────────────────────────────┘
```

**Design choices in this project:**

- **Polling** is used for `/api/logs` (e.g. every 3 s). **Server-Sent Events (SSE)** were tried but disabled because they blocked HTTP worker threads and caused freezes; polling is safe and works with limited workers.
- **CentralLogger** does no I/O or networking; it only formats and stores lines. The web server reads from the in-memory buffer when a request arrives.

---

## 2. Components and Files

| Role | File(s) | ESP-IDF specific? |
|------|--------|--------------------|
| Log capture (hook + ring buffer) | `main/logging/central_logger.cpp`, `central_logger.h` | Partially (see below) |
| Web: serve log page | `main/connectivity/WebServer.cpp` (`log_handler`) | Yes (httpd) |
| Web: logs API | `main/connectivity/WebServer.cpp` (`logs_api_handler`) | Yes (httpd) |
| Embedded log.html | `web_files/log.html` + CMake embedding | Yes (embedding build) |
| Init | `main/main.cpp` calls `CentralLogger::init()` early | No (concept only) |

---

## 3. Central Logger (Capture Layer)

### 3.1 Role

- **Hook** into the logging backend so that every log line (from `ESP_LOG*`) is also written into a **ring buffer**.
- Keep **serial output unchanged** by calling `printf()` from inside the hook with the already-formatted string (avoids recursion).
- Expose **recent lines** to the web server via `copyRecentLogs()` (and optionally `getLogCount()` / `getTotalLogCount()`).

### 3.2 ESP-IDF–specific pieces in `central_logger.cpp`

- **`esp_log.h`**  
  Provides `esp_log_set_vprintf()`, which installs a custom `vprintf`-style function used for all `ESP_LOG*` output.

- **`esp_log_set_vprintf(&centralLoggerVprintf)`**  
  Replaces the default log output. Your handler must:
  - Format the message (e.g. `vsnprintf`).
  - Store it in your ring buffer.
  - Optionally print to console with `printf("%s", buffer)` so serial behavior is unchanged.

- **`esp_timer.h`**  
  Used only for a timestamp in the “already initialized” / “PSRAM not available” fallback messages when avoiding `ESP_LOG*` during init (to prevent recursion).

- **`esp_heap_caps.h`**  
  `heap_caps_malloc(..., MALLOC_CAP_SPIRAM)` (and `MALLOC_CAP_INTERNAL` fallback), `heap_caps_free()`. Used to put the ring buffer (and optionally API response buffers) in PSRAM to save internal RAM.

So: **the “capture” idea is portable; the hook mechanism and heap/PSRAM APIs are ESP-IDF-specific.**  
On PlatformIO with the **Arduino** framework (no full ESP-IDF logging), you don’t have `esp_log_set_vprintf`. You would instead:
- Use a **custom macro** (e.g. `#define LOGI(TAG, fmt, ...) do { ... } while(0)`) that writes to both `Serial` and your ring buffer, or
- Use a small **wrapper** that all logging goes through, and have that write to Serial + ring buffer.

The **ring buffer and API** (`getLogCount`, `getTotalLogCount`, `copyRecentLogs`) can stay the same; only the “source” of lines changes (ESP-IDF hook vs your own macros/wrapper).

### 3.3 Ring buffer and API (portable idea)

- **Lock-free ring buffer**: fixed number of lines (e.g. 256), each line up to 256 bytes.  
  - `s_logHead` (atomic) is the next write index; index in buffer = `head % N`.  
  - No mutex; single producer (logging thread/task), consumers (HTTP handlers) read recent slice.

- **Functions used by the web server**:
  - `getLogCount()` — number of lines currently stored (capped at history size).
  - `getTotalLogCount()` — total lines ever written (for wrap-around / client hint).
  - `copyRecentLogs(outBuffer, bufferSize, numLines)` — copy last `numLines` lines into one buffer, newline-separated; returns bytes written. **Preferred** over `getRecentLogs()` (which used to strdup and leak).

- **Reentrancy**: the custom vprintf sets a static `reentry` flag and, if already inside, just calls `vprintf` and returns to avoid recursion (e.g. if something in the hook logs).

---

## 4. Web Server: log Page and /api/logs

### 4.1 Serving the log page (ESP-IDF httpd)

- **Route**: `GET /log` or `GET /log.html`.
- **Handler**: `log_handler()`.
- **Behavior**:  
  - Resolve `log.html` from **embedded files** (see next section).  
  - Send it with `httpd_resp_set_type(req, "text/html")` and `httpd_resp_send(req, data, size)`.

**PlatformIO:** If you use **AsyncWebServer** (Arduino), you’d do the same conceptually: register a handler for `"/log"` and `"/log.html"` that serves the same HTML (from PROGMEM/embed or SPIFFS/LittleFS).

### 4.2 Embedding log.html (ESP-IDF build)

- **CMake:**  
  `target_add_binary_data(${COMPONENT_LIB} "../web_files/log.html" TEXT)`  
  This compiles `log.html` into the binary and produces symbols like:
  - `_binary_log_html_start`
  - `_binary_log_html_end`

- **Code:**  
  In `EmbeddedFiles.h`, those symbols are declared and mapped to a struct:
  - `extern const uint8_t log_html_start[] asm("_binary_log_html_start");`
  - `extern const uint8_t log_html_end[] asm("_binary_log_html_end");`
  - `getEmbeddedFile("log.html")` returns `{ data = log_html_start, size = end - start, mime_type = "text/html" }`.

**PlatformIO:**

- **Framework = espidf:** You can use the same CMake pattern and symbol names if your project is ESP-IDF-based.
- **Framework = arduino:** The build doesn’t use `target_add_binary_data` by default. Options:
  - Use **PROGMEM** / `#include`-generated byte array (e.g. `const char log_html[] PROGMEM = { ... };`) and serve that.
  - Or use a **file-embed** script / build flag that generates a `.c`/`.h` with a symbol you reference (symbol names may differ from `_binary_*`; adjust `getEmbeddedFile` or equivalent).
  - Or serve **from SPIFFS/LittleFS** instead of embedding (different deployment, same HTTP behavior).

So: **embedding and symbol names are ESP-IDF build–specific;** the “serve this HTML for /log” is not.

### 4.3 Logs API: GET /api/logs (ESP-IDF httpd)

- **Route**: `GET /api/logs`.
- **Query**: `lines` (optional, default 30, max 100).
- **Handler**: `logs_api_handler()`.

**Steps:**

1. **Throttle:** e.g. reject if more than 1–2 concurrent log requests (avoid overload).
2. **Allocate buffers:**  
   One for building the JSON response, one for raw log text. In this project they use `heap_caps_malloc(..., MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)` with fallback to normal `malloc` — **ESP-IDF heap_caps**.
3. **Get counts:**  
   `totalLogs = CentralLogger::getTotalLogCount()`, `availableLogs = CentralLogger::getLogCount()`.
4. **Get lines:**  
   `CentralLogger::copyRecentLogs(logBuffer, logBufferSize, numLines)`.
5. **Build JSON:**  
   `{"total":…,"available":…,"lines":["line1","line2",…]}`. Escape `"` and `\` in each line.
6. **Send:**  
   `httpd_resp_set_type(req, "application/json")`, then `httpd_resp_send(req, buffer, offset)`.
7. **Free** buffers and decrement “active requests”.

**PlatformIO (e.g. AsyncWebServer):** Same logic: in the handler for `GET /api/logs`, parse `lines`, call your equivalent of `getTotalLogCount`/`getLogCount`/`copyRecentLogs`, build the same JSON string, and send it. Only the API to send the response changes (`request->send(200, "application/json", json)` etc.).

---

## 5. log.html (Front End)

- **URL:** Same origin as device (e.g. `http://<device-ip>/log.html` or `/log`).
- **Behavior:**
  - **Polling:** Every 3 seconds (configurable), `fetch('/api/logs?lines=30')`.
  - **Response:** JSON `{ total, available, lines: ["...", "..."] }`.
  - **Rendering:** Clear the log window, append each `lines[i]` as a div; assign CSS class by level (e.g. `E (`/ERROR → error, `W (`/WARN → warn, `I (` → info, `D (`/`V (` → debug).
  - **Auto-scroll** to bottom.
- **No SSE:** The page does **not** use `EventSource`; only polling. This is intentional to avoid blocking the server.

This part is **framework-agnostic**: any HTTP server that serves this HTML and implements `GET /api/logs` as above will work.

---

## 6. Init Order

- **CentralLogger::init()** must run **before** any `ESP_LOG*` that you want in the ring buffer.
- In this project it’s called in `app_main()` right after NVS init and before other modules that log.
- **PlatformIO:** Call your “central logger init” (or install the Arduino-style logging hook) at the same point — early in `setup()` or before any code that logs.

---

## 7. ESP-IDF vs PlatformIO Summary

| Item | ESP-IDF (this project) | PlatformIO (reuse / replace) |
|------|-------------------------|------------------------------|
| Log hook | `esp_log_set_vprintf()` | No equivalent in Arduino core; use custom macro or wrapper that writes to Serial + your buffer. |
| Timestamp / init fallback | `esp_timer_get_time()` | `millis()` or equivalent. |
| Heap / PSRAM | `heap_caps_malloc`, `heap_caps_free`, `MALLOC_CAP_*` | Same if framework is ESP-IDF; with Arduino, optional PSRAM via `ps_malloc()` or heap_caps if you include the right ESP-IDF component. |
| Embedding web files | `target_add_binary_data` + `_binary_*_start/_end` | PROGMEM / file-embed script / SPIFFS/LittleFS. |
| HTTP server | `esp_http_server` (httpd) | AsyncWebServer or WiFiServer + manual parsing; same routes and JSON. |
| JSON endpoint | `httpd_resp_*` | `request->send(200, "application/json", json)`. |

---

## 8. Minimal Checklist to Replicate

1. **Capture:**
   - **ESP-IDF:** Implement a vprintf hook that writes to a ring buffer and calls `printf`; call `esp_log_set_vprintf()` once at startup.
   - **Arduino/PlatformIO:** Implement a logging macro or wrapper that appends to the same ring buffer and prints to `Serial`.
2. **Ring buffer:** Same design (atomic head, fixed line count/length, `copyRecentLogs`).
3. **HTTP:** One route that serves the log page (HTML), one route `GET /api/logs?lines=N` that returns `{"total":…,"available":…,"lines":[…]}`.
4. **log.html:** Use the same polling + JSON + color-by-level logic; adjust only asset paths (e.g. `/style.css`, `/app.js`) if your project differs.
5. **Init:** Call your logger init early so all later logs go through it.

With that, you get the same “internal logs on log.html” behavior; only the hook and build/embedding details differ between ESP-IDF and PlatformIO as above.
