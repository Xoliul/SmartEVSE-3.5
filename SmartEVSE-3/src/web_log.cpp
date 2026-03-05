/*
 * Web log ring buffer: in-memory, subscriber-aware.
 * When nobody has requested /api/logs recently, append is a fast no-op.
 */

#include "web_log.h"
#include <stdio.h>
#include <string.h>
#include <stdint.h>

#if defined(MG_ARCH_ESP32) || defined(ARDUINO_ARCH_ESP32)
#include <esp_timer.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#endif

#ifndef WEB_LOG_MAX_LINES
#define WEB_LOG_MAX_LINES 128
#endif
#ifndef WEB_LOG_LINE_SIZE
#define WEB_LOG_LINE_SIZE 256
#endif

#define SUBSCRIBER_TIMEOUT_MS (5 * 60 * 1000)  /* 5 minutes */

static char s_buf[WEB_LOG_MAX_LINES][WEB_LOG_LINE_SIZE];
static uint32_t s_head;        /* next write index */
static unsigned long s_total;  /* total lines ever written */
static unsigned long s_subscriber_until;  /* 0 = no subscriber */
static int s_inited;

static inline unsigned long now_ms(void) {
#if defined(MG_ARCH_ESP32) || defined(ARDUINO_ARCH_ESP32)
    return (unsigned long)(esp_timer_get_time() / 1000ULL);
#else
    return 0;
#endif
}

void web_log_init(void) {
    if (s_inited) return;
    s_head = 0;
    s_total = 0;
    s_subscriber_until = 0;
    s_inited = 1;
}

void web_log_set_subscriber_active(void) {
    s_subscriber_until = now_ms() + SUBSCRIBER_TIMEOUT_MS;
}

int web_log_subscriber_active(void) {
    if (!s_inited) return 0;
    unsigned long now = now_ms();
    if (s_subscriber_until != 0 && now < s_subscriber_until)
        return 1;
    s_subscriber_until = 0;
    return 0;
}

void web_log_append_va(char level, const char *func, const char *fmt, va_list ap) {
    if (!s_inited || !web_log_subscriber_active())
        return;

    char *line = s_buf[s_head % WEB_LOG_MAX_LINES];
    size_t n = 0;

    if (func && func[0]) {
#if defined(MG_ARCH_ESP32) || defined(ARDUINO_ARCH_ESP32)
        int core = (int)xPortGetCoreID();
        n = (size_t)snprintf(line, WEB_LOG_LINE_SIZE, "[%c](%s)(C%d) ", level, func, core);
#else
        n = (size_t)snprintf(line, WEB_LOG_LINE_SIZE, "[%c](%s) ", level, func);
#endif
        if (n >= WEB_LOG_LINE_SIZE) n = WEB_LOG_LINE_SIZE - 1;
    } else {
        n = (size_t)snprintf(line, WEB_LOG_LINE_SIZE, "[%c] ", level);
        if (n >= WEB_LOG_LINE_SIZE) n = WEB_LOG_LINE_SIZE - 1;
    }
    int r = vsnprintf(line + n, WEB_LOG_LINE_SIZE - n, fmt, ap);
    if (r < 0) return;
    n += (size_t)r;
    if (n >= WEB_LOG_LINE_SIZE) n = WEB_LOG_LINE_SIZE - 1;
    /* ensure newline at end if space */
    if (n > 0 && line[n - 1] != '\n' && n < WEB_LOG_LINE_SIZE - 1) {
        line[n] = '\n';
        n++;
    }
    line[n] = '\0';

    s_head++;
    s_total++;
}

void web_log_append(char level, const char *func, const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    web_log_append_va(level, func, fmt, ap);
    va_end(ap);
}

void web_log_append_raw(const char *msg) {
    if (!msg || !s_inited) return;
    size_t len = strlen(msg);
    if (len >= WEB_LOG_LINE_SIZE) len = WEB_LOG_LINE_SIZE - 1;
    char *line = s_buf[s_head % WEB_LOG_MAX_LINES];
    memcpy(line, msg, len);
    if (len == 0 || line[len - 1] != '\n')
        line[len++] = '\n';
    line[len] = '\0';
    s_head++;
    s_total++;
}

int web_log_get_count(void) {
    if (!s_inited) return 0;
    return (s_total < (unsigned long)WEB_LOG_MAX_LINES) ? (int)s_total : WEB_LOG_MAX_LINES;
}

unsigned long web_log_get_total_count(void) {
    return s_total;
}

int web_log_copy_recent(char *out, size_t out_size, int num_lines) {
    if (!s_inited || out_size == 0 || num_lines <= 0)
        return 0;
    int count = web_log_get_count();
    if (num_lines > count) num_lines = count;
    size_t off = 0;
    for (int i = num_lines - 1; i >= 0 && off < out_size; i--) {
        uint32_t idx = (s_head + WEB_LOG_MAX_LINES - 1 - (uint32_t)i) % WEB_LOG_MAX_LINES;
        const char *src = s_buf[idx];
        size_t len = strlen(src);
        if (off + len + 1 > out_size)
            len = out_size - off - 1;
        if (len > 0) {
            memcpy(out + off, src, len);
            off += len;
        }
        if (off < out_size && (off == 0 || out[off - 1] != '\n'))
            out[off++] = '\n';
    }
    if (off < out_size) out[off] = '\0';
    return (int)off;
}
