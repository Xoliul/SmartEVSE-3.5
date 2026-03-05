/*
 * Web log ring buffer for log.html (DBG=0).
 * Only appends when a subscriber is active (recent GET /api/logs) to avoid perf impact.
 */

#ifndef WEB_LOG_H
#define WEB_LOG_H

#include <stddef.h>
#include <stdarg.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Call when handling GET /api/logs to mark that someone is watching. */
void web_log_set_subscriber_active(void);

/* True if GET /api/logs was called recently (e.g. within last 5 min). When false, append is a no-op. */
int web_log_subscriber_active(void);

/* Append a line (only does work when subscriber_active). level = 'A'|'W'|'I' etc. func may be NULL for NO_FUNC. */
void web_log_append_va(char level, const char *func, const char *fmt, va_list ap);
/* Variadic wrapper for use from macros (va_start must be in a function with ...). */
void web_log_append(char level, const char *func, const char *fmt, ...);

/* Ring buffer read API for GET /api/logs */
int web_log_get_count(void);
unsigned long web_log_get_total_count(void);
/* Copy last num_lines lines into out (newline-separated). Returns bytes written. */
int web_log_copy_recent(char *out, size_t out_size, int num_lines);

void web_log_init(void);

/* Append a raw line unconditionally (for bootstrap message when subscriber activates). */
void web_log_append_raw(const char *msg);

#ifdef __cplusplus
}
#endif

#endif
