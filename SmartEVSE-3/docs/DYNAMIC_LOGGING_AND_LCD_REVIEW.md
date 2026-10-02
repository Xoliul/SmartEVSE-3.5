# Dynamic Web Logging vs LCD Screen Emulation: Review and Impact Analysis

This document reviews the dynamic web logging feature (log.html + web_log) and the LCD screen emulation (WebSocket BMP streaming), and estimates their memory and performance impacts on the SmartEVSE ESP32 firmware.

---

## 1. Dynamic Web Logging Feature

### 1.1 Architecture Overview

- **Components:** `web_log.cpp`, `web_log.h`, `debug.h` (macro wiring), `network_common.cpp` (GET `/api/logs`), `data/log.html`
- **Flow:** When the log page is open, it polls `/api/logs` every N seconds. Each poll calls `web_log_set_subscriber_active()`, which extends a 5‑minute subscriber window. While the window is active, all `_LOG_A`, `_LOG_I`, `_LOG_W`, `_LOG_D`, `_LOG_V` calls append to a ring buffer. When inactive, append is a fast no-op (subscriber check only).

### 1.2 Memory Impact

| Item | Size | Notes |
|------|------|-------|
| Ring buffer `s_buf[128][256]` | **32,768 bytes (32 KB)** | Static, always allocated |
| Other globals (`s_head`, `s_total`, `s_subscriber_until`, `s_inited`) | ~20 bytes | Negligible |
| **Total static** | **~32.8 KB** | |

**Per GET /api/logs request (temporary):**

| Item | Size | Notes |
|------|------|-------|
| `log_buf` (malloc) | up to 16,384 bytes | `num_lines * 280`, capped at 16K |
| `DynamicJsonDocument` | `buf_size + 512` | Same order of magnitude |
| **Peak during request** | ~33 KB extra | Freed after response |

**ESP32 context:** Typical ESP32 has ~320 KB SRAM. The 32 KB ring buffer is ~10% of total SRAM. This is significant but acceptable for a diagnostic feature.

### 1.3 Performance Impact

**When subscriber is inactive (no log page open):**

- Each `_LOG_*` call: `web_log_subscriber_active()` → `now_ms()` + comparison + optional `s_subscriber_until = 0`. Cost: **~50–100 CPU cycles** per call.
- No buffer writes, no `snprintf`/`vsnprintf`.
- **Impact: negligible** even with many log calls per second.

**When subscriber is active (log page open and polling):**

- Each append: `web_log_subscriber_active()` + `snprintf` (header) + `vsnprintf` (message) + buffer write + index update.
- Typical line: ~80–200 bytes. Cost: **~500–2000 CPU cycles** per append.
- Log rate: STATE line ~1/s, solar/load status ~1/15s, event-driven logs variable. Estimate: **1–10 appends/second** under normal operation.
- **Impact: low** — well under 1% CPU at 240 MHz.

**GET /api/logs:**

- `web_log_copy_recent()`: O(n) over up to 128 lines, ~20 KB copy.
- JSON build + serialize: O(n), temporary allocations.
- Cost: **~1–5 ms** per request. With 3 s poll interval, this is negligible.

### 1.4 Design Strengths

1. **Subscriber-aware:** No work when nobody is watching.
2. **Bounded:** Fixed 32 KB, no heap growth.
3. **Ring buffer:** Constant-time append, no realloc.
4. **5‑minute timeout:** Stops capturing if user closes the tab without explicit disconnect.

### 1.5 Potential Concerns

1. **32 KB static:** On memory-constrained builds, consider reducing `WEB_LOG_MAX_LINES` or `WEB_LOG_LINE_SIZE`.
2. **Log rate spikes:** If many `_LOG_V`/`_LOG_D` calls fire during heavy activity, CPU use can increase; still expected to stay low.
3. **JSON allocation:** Each `/api/logs` request allocates ~16–33 KB temporarily; under load this could contribute to fragmentation, though requests are infrequent (poll every few seconds).

---

## 2. LCD Screen Emulation (WebSocket BMP Streaming)

### 2.1 Architecture Overview

- **Components:** `glcd.cpp` (`createImageFromGLCDBuffer`, `createBMPHeader`), `network_common.cpp` (WebSocket `/ws/lcd`, `lcd_image_timer_fn`), `data/index.html` (LCD panel, WebSocket client)
- **Flow:** When a client connects to `/ws/lcd`, a 1 s repeating timer starts. Each tick: read `GLCDbuf2` (1024 bytes), convert to BMP, send to all connected clients. When the last client disconnects, the timer stops.

### 2.2 Memory Impact

| Item | Size | Notes |
|------|------|-------|
| `GLCDbuf2` | 1,024 bytes | Pre-existing LCD buffer |
| `wsLcdConnections` | ~4 bytes per connection | `std::vector<mg_connection*>` |
| **Per frame (heap, temporary)** | **~1.2 KB** | `std::vector<uint8_t>` in `createImageFromGLCDBuffer()` |

**BMP size calculation:**

- Header: 62 bytes + (rowSize × height / 8). For 128×64 1‑bit: rowSize = 16, pixel data = 1024 bytes → **~1.2 KB per frame**.
- This vector is allocated and freed each timer tick.

**When no client is connected:** Timer is stopped; no per-frame allocations.

**When 1+ clients connected:** ~1.2 KB heap alloc/free per second. No persistent extra static memory beyond the existing `GLCDbuf2`.

### 2.3 Performance Impact

**When no client connected:**

- **Zero** — timer is not running.

**When 1+ clients connected (1 s interval):**

- Per tick: read 1024 bytes, transpose 8×8 blocks (8 chunks × 64 ops), build BMP, `mg_ws_send` to each client.
- Estimate: **~5,000–15,000 CPU cycles** per frame.
- At 240 MHz, 15,000 cycles ≈ **62 µs** per second → **~0.006% CPU**.
- Network: 1.2 KB/s per client. For 3 clients: ~3.6 KB/s.

**Design strengths:**

1. **On-demand:** No work when nobody is viewing the LCD.
2. **Low rate:** 1 frame/s keeps CPU and bandwidth low.
3. **Small frames:** 1.2 KB is small for WiFi.

---

## 3. Comparison: Web Log vs LCD Emulation

| Aspect | Web Log | LCD Emulation |
|--------|---------|----------------|
| **Static RAM** | 32 KB (always) | 0 (uses existing GLCDbuf2) |
| **Work when idle** | Subscriber check only (~50 cycles/call) | None (timer off) |
| **Work when active** | Append: ~500–2000 cycles/line, 1–10/s | ~5–15k cycles/s, 1 frame/s |
| **Network when active** | Poll every 3 s, ~2–10 KB/request | 1.2 KB/s per client |
| **Heap churn when active** | Per request: ~16–33 KB (freed after) | Per second: ~1.2 KB alloc/free |
| **Bounded growth** | Yes (fixed ring) | Yes (fixed frame size) |

**Summary:**

- **Web log** uses more static RAM (32 KB) but has minimal CPU impact when the log page is closed.
- **LCD emulation** uses almost no extra static RAM and very little CPU/network when active; its cost is mainly the small per-frame heap allocation.
- Both features are **subscriber/viewer-aware** and do nothing when nobody is using them.

---

## 4. Recommendations

1. **Web log:** Consider making `WEB_LOG_MAX_LINES` and `WEB_LOG_LINE_SIZE` configurable (e.g. via `platformio.ini` or a config header) for memory-constrained builds.
2. **LCD emulation:** Current design is efficient; no changes needed for typical use.
3. **Monitoring:** If adding more `_LOG_V`/`_LOG_D` in hot paths, keep an eye on log rate when the log page is open.
4. **Documentation:** Keep this document updated when buffer sizes, timer intervals, or log formats change.

---

## 5. Mitigation Options (If Lead Dev Opposes Web Log)

If the lead dev opposes the web log due to memory and performance costs, the following actions can reduce or eliminate its impact:

### 5.1 Memory Reductions

| Action | Effect | Trade-off |
|--------|--------|-----------|
| **Shrink ring buffer** | Reduce `WEB_LOG_MAX_LINES` (128→64) and `WEB_LOG_LINE_SIZE` (256→128) → ~8 KB instead of 32 KB | Fewer lines retained, shorter history |
| **Make configurable** | Add `#define` or build flags so release uses smaller buffer (or none) | Requires build/config changes |
| **Optional compilation** | Exclude `web_log.cpp` unless `ENABLE_WEB_LOG` is set; disable feature entirely for minimal builds | Feature unavailable when disabled |

### 5.2 Performance Reductions

| Action | Effect | Trade-off |
|--------|--------|-----------|
| **Throttle appends** | Cap append rate when subscriber active (e.g. max 1 line per 100 ms) | Some lines dropped during bursts |
| **Limit levels in release** | In DBG=0, only send `_LOG_A` (and optionally `_LOG_I`) to web; omit `_LOG_D`/`_LOG_V` | Less detail for debugging |
| **Coarser subscriber check** | Cache `web_log_subscriber_active()` result for a short window (e.g. 100 ms) | Slightly delayed stop after last poll |

### 5.3 Recommended Low-Impact Configuration

For maximum acceptance with minimal impact:

- **8 KB buffer** (64×128) — ~75% memory reduction
- **Only `_LOG_A` and `_LOG_I`** sent to web in release (DBG=0) — cuts append volume
- **Optional:** `ENABLE_WEB_LOG` build flag so the feature can be disabled entirely for production builds

---

## 6. References

- `src/web_log.cpp`, `src/web_log.h` — ring buffer implementation
- `src/debug.h` — `_LOG_*` macro wiring to `web_log_append`
- `src/network_common.cpp` — `/api/logs` handler, `/ws/lcd` WebSocket, `lcd_image_timer_fn`
- `src/glcd.cpp` — `createImageFromGLCDBuffer`, `createBMPHeader`
- `data/log.html` — log viewer with level filtering
- `data/index.html` — LCD panel and WebSocket client
