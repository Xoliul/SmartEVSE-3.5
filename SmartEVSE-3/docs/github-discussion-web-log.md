# GitHub Discussion: Web Log Feature (log.html) — Memory, Telnet, and Log Level

*Copy the content below into a new GitHub Discussion to explore feedback on the web log feature.*

---

## Web log feature: exploring concerns and trade-offs

There’s been feedback on the web log feature (log.html + `/api/logs`) along these lines:

> Extra memory usage without substantial addition of functionality; telnet isn’t that difficult either; and probably no way to set a logging level — so even a regression in functionality.

This discussion aims to clarify what we have, what we could add, and whether the concerns hold up.

---

### 1. Memory concern

**Claim:** Extra memory usage is a problem.

**Current state:**
- Ring buffer: 128 lines × 256 bytes = **32 KB** static RAM
- On ESP32 (~320 KB SRAM): ~10% of total
- When nobody has the log page open: append is a no-op (subscriber check only)
- See [docs/DYNAMIC_LOGGING_AND_LCD_REVIEW.md](DYNAMIC_LOGGING_AND_LCD_REVIEW.md) for full analysis

**Mitigation options (if we want to reduce impact):**
- Shrink to 64×128 → **8 KB** (~75% reduction)
- Optional build flag to disable the feature entirely
- Only capture A/I in release; omit D/V to cut volume

**Question:** Is 32 KB (or 8 KB with a smaller buffer) acceptable for a diagnostic feature that does nothing when unused?

---

### 2. Telnet comparison

**Claim:** Telnet is not that difficult, so the web log adds little.

**Differences:**

| Aspect | Telnet (RemoteDebug) | Web log |
|--------|----------------------|---------|
| **Availability** | Only when DBG=1 (debug build) | Works in DBG=0 (release) |
| **Setup** | Requires telnet client, network access, correct port | Open `/log.html` in browser |
| **Access** | Often blocked by firewalls, VPNs, or locked-down networks | Same as web UI (HTTP/HTTPS) |
| **Persistence** | Stream only; no history before connect | Last 128 lines in ring buffer |
| **Filtering** | RemoteDebug has its own level controls | Client-side level filter (A/E/W/I/D/V) + text filter |

**Use case:** Web log targets users who want quick, browser-based diagnostics without telnet or a debug build. It’s additive, not a replacement for telnet.

**Question:** Do we want a zero-setup, release-build logging option, or is telnet-only sufficient?

---

### 3. Log level support

**Claim:** Probably no way to set a logging level — regression in functionality.

**What “setting log level via telnet” means:**

RemoteDebug (telnet) lets you change the verbosity **on the device** at runtime. When connected, you type:

| Command | Effect |
|---------|--------|
| `v` | Set level to **Verbose** — show everything (V, D, I, W, E, A) |
| `d` | Set level to **Debug** — show D, I, W, E, A |
| `i` | Set level to **Info** — show I, W, E, A |
| `w` | Set level to **Warning** — show W, E, A |
| `e` | Set level to **Error** — show E, A only |
| `filter <string>` | Show only lines containing that text |
| `nofilter` | Disable text filter |

The device updates `_clientDebugLevel` and only sends lines at or above that level to that telnet client. Filtering happens **at the source**.

**Web log today:**
- The device captures **all** levels (A, W, I, D, V) when the log page is open.
- Filtering is **client-side only** — checkboxes in the browser hide levels you don’t want to see.
- The device still buffers everything; it doesn’t have a “min level” setting.

So the lead dev’s point: telnet gives **device-side** level control; web log only has **client-side** filtering. Adding `?min_level=I` (or similar) to `/api/logs` would give device-side control and reduce what gets captured/returned.

**Current state:**
- **Client-side:** log.html has a filter bar with checkboxes for A, E, W, I, D, V, and “Other”. Users can show/hide levels.
- **Client-side:** Text filter to search within lines.
- **Server-side:** The device captures whatever levels are logged (based on DBG/LOG_LEVEL). There is no API to set a “minimum level” on the device.

**What we could add:**
- **`?min_level=I`** (or similar) on `/api/logs` — server only returns lines at or above that level (e.g. A, W, I; exclude D, V). Small change in the handler.
- **`?levels=A,I,W`** — explicit allowlist of levels to return.
- **Persisted preference** — e.g. store last-used level filter and reuse on next open.

**Question:** Is client-side filtering enough, or do we need server-side level control? If so, which style (`min_level` vs `levels`) do we prefer?

---

### 4. Summary of questions

1. **Memory:** Is 32 KB (or a reduced 8 KB) acceptable? Should we add a build flag to disable the feature?
2. **Telnet vs web:** Do we want a release-build, browser-based log, or is telnet-only enough?
3. **Log level:** Is client-side filtering sufficient, or should we add server-side `min_level` / `levels` support?

---

### 5. References

- [DYNAMIC_LOGGING_AND_LCD_REVIEW.md](DYNAMIC_LOGGING_AND_LCD_REVIEW.md) — memory/performance analysis and mitigation options
- `data/log.html` — log viewer with level and text filters
- `src/web_log.cpp` — ring buffer implementation
