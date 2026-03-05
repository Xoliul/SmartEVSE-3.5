/*
;    Project: Smart EVSE v3
;
;
; Permission is hereby granted, free of charge, to any person obtaining a copy
; of this software and associated documentation files (the "Software"), to deal
; in the Software without restriction, including without limitation the rights
; to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
; copies of the Software, and to permit persons to whom the Software is
; furnished to do so, subject to the following conditions:
;
; The above copyright notice and this permission notice shall be included in
; all copies or substantial portions of the Software.
;
; THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
; IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
; FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
; AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
; LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
; OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
; THE SOFTWARE.
 */

#ifndef __EVSE_DEBUG

#define __EVSE_DEBUG
#include "stdio.h"

#ifndef VERSION
//please note that this version will only be displayed with the correct time/date if the program is recompiled
//so the webserver will show correct version if evse.cpp is recompiled
//the lcd display will show correct version if glcd.cpp is recompiled
#define VERSION (__TIME__ " @" __DATE__)
#endif


#if (defined(SMARTEVSE_VERSION) && DBG == 0) || (!defined(SMARTEVSE_VERSION) && DBG_CH32 == 0)
//used to steer RemoteDebug
#define DEBUG_DISABLED 1
#define _LOG_W( ... ) //dummy
#define _LOG_I( ... ) //dummy
#define _LOG_D( ... ) //dummy
#define _LOG_V( ... ) //dummy
#if defined(SMARTEVSE_VERSION)
#include "web_log.h"
#define _LOG_A(fmt, ...) do { if (web_log_subscriber_active()) web_log_append('A', __func__, fmt, ##__VA_ARGS__); } while(0)
#define _LOG_A_NO_FUNC(fmt, ...) do { if (web_log_subscriber_active()) web_log_append('A', NULL, fmt, ##__VA_ARGS__); } while(0)
#define _LOG_I(fmt, ...) do { if (web_log_subscriber_active()) web_log_append('I', __func__, fmt, ##__VA_ARGS__); } while(0)
#define _LOG_I_NO_FUNC(fmt, ...) do { if (web_log_subscriber_active()) web_log_append('I', NULL, fmt, ##__VA_ARGS__); } while(0)
#define _LOG_W(fmt, ...) do { if (web_log_subscriber_active()) web_log_append('W', __func__, fmt, ##__VA_ARGS__); } while(0)
#define _LOG_W_NO_FUNC(fmt, ...) do { if (web_log_subscriber_active()) web_log_append('W', NULL, fmt, ##__VA_ARGS__); } while(0)
#define _LOG_D(fmt, ...) do { if (web_log_subscriber_active()) web_log_append('D', __func__, fmt, ##__VA_ARGS__); } while(0)
#define _LOG_D_NO_FUNC(fmt, ...) do { if (web_log_subscriber_active()) web_log_append('D', NULL, fmt, ##__VA_ARGS__); } while(0)
#define _LOG_V(fmt, ...) do { if (web_log_subscriber_active()) web_log_append('V', __func__, fmt, ##__VA_ARGS__); } while(0)
#define _LOG_V_NO_FUNC(fmt, ...) do { if (web_log_subscriber_active()) web_log_append('V', NULL, fmt, ##__VA_ARGS__); } while(0)
#else
#define _LOG_A( ... ) //dummy
#define _LOG_A_NO_FUNC( ... ) //dummy
#endif
#define _LOG_W_NO_FUNC( ... ) //dummy
#define _LOG_I_NO_FUNC( ... ) //dummy
#define _LOG_D_NO_FUNC( ... ) //dummy
#define _LOG_V_NO_FUNC( ... ) //dummy
#endif

#if DBG == 1 && defined(SMARTEVSE_VERSION) //only on ESP32
#include "web_log.h"
#define _LOG_A(fmt, ...) do { \
    if (Debug.isActive(Debug.ANY))                Debug.printf("(%s)(C%d) " fmt, __func__, xPortGetCoreID(), ##__VA_ARGS__); \
    if (web_log_subscriber_active())             web_log_append('A', __func__, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_P(fmt, ...) if (Debug.isActive(Debug.PROFILER))   Debug.printf("(%s)(C%d) " fmt, __func__, xPortGetCoreID(), ##__VA_ARGS__)
#define _LOG_V(fmt, ...) do { \
    if (Debug.isActive(Debug.VERBOSE))    Debug.printf("(%s)(C%d) " fmt, __func__, xPortGetCoreID(), ##__VA_ARGS__); \
    if (web_log_subscriber_active())      web_log_append('V', __func__, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_D(fmt, ...) do { \
    if (Debug.isActive(Debug.DEBUG))      Debug.printf("(%s)(C%d) " fmt, __func__, xPortGetCoreID(), ##__VA_ARGS__); \
    if (web_log_subscriber_active())      web_log_append('D', __func__, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_I(fmt, ...) do { \
    if (Debug.isActive(Debug.INFO))               Debug.printf("(%s)(C%d) " fmt, __func__, xPortGetCoreID(), ##__VA_ARGS__); \
    if (web_log_subscriber_active())             web_log_append('I', __func__, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_W(fmt, ...) do { \
    if (Debug.isActive(Debug.WARNING))    Debug.printf("(%s)(C%d) " fmt, __func__, xPortGetCoreID(), ##__VA_ARGS__); \
    if (web_log_subscriber_active())     web_log_append('W', __func__, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_E(fmt, ...) if (Debug.isActive(Debug.ERROR))              Debug.printf("(%s)(C%d) " fmt, __func__, xPortGetCoreID(), ##__VA_ARGS__) //Error not used!
#define _LOG_A_NO_FUNC(fmt, ...) do { \
    if (Debug.isActive(Debug.ANY))                Debug.printf(fmt, ##__VA_ARGS__); \
    if (web_log_subscriber_active())             web_log_append('A', NULL, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_P_NO_FUNC(fmt, ...) if (Debug.isActive(Debug.PROFILER))   Debug.printf(fmt, ##__VA_ARGS__)
#define _LOG_V_NO_FUNC(fmt, ...) do { \
    if (Debug.isActive(Debug.VERBOSE))    Debug.printf(fmt, ##__VA_ARGS__); \
    if (web_log_subscriber_active())      web_log_append('V', NULL, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_D_NO_FUNC(fmt, ...) do { \
    if (Debug.isActive(Debug.DEBUG))      Debug.printf(fmt, ##__VA_ARGS__); \
    if (web_log_subscriber_active())      web_log_append('D', NULL, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_I_NO_FUNC(fmt, ...) do { \
    if (Debug.isActive(Debug.INFO))               Debug.printf(fmt, ##__VA_ARGS__); \
    if (web_log_subscriber_active())             web_log_append('I', NULL, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_W_NO_FUNC(fmt, ...) do { \
    if (Debug.isActive(Debug.WARNING))    Debug.printf(fmt, ##__VA_ARGS__); \
    if (web_log_subscriber_active())     web_log_append('W', NULL, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_E_NO_FUNC(fmt, ...) if (Debug.isActive(Debug.ERROR))              Debug.printf(fmt, ##__VA_ARGS__)
#include "RemoteDebug.h"  //https://github.com/JoaoLopesF/RemoteDebug
extern RemoteDebug Debug;
#endif

#define EVSE_LOG_FORMAT(letter, format) "[%6u][" #letter "][%s:%u] %s(): " format , (uint32_t) (esp_timer_get_time() / 1000ULL), pathToFileName(__FILE__), __LINE__, __FUNCTION__

#if DBG == 2 && defined(SMARTEVSE_VERSION) //only on ESP32
#define DEBUG_DISABLED 1
#include "web_log.h"
#if LOG_LEVEL >= 1  // Errors
#define _LOG_A(fmt, ...) do { \
    Serial.printf(EVSE_LOG_FORMAT(E, fmt), ##__VA_ARGS__); \
    if (web_log_subscriber_active()) web_log_append('A', __func__, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_A_NO_FUNC( ... ) do { Serial.printf ( __VA_ARGS__ ); if (web_log_subscriber_active()) web_log_append('A', NULL, __VA_ARGS__); } while(0)
#else
#define _LOG_A( ... )
#define _LOG_A_NO_FUNC( ... )
#endif
#if LOG_LEVEL >= 2  // Warnings
#define _LOG_W(fmt, ... ) do { \
    Serial.printf(EVSE_LOG_FORMAT(W, fmt), ##__VA_ARGS__); \
    if (web_log_subscriber_active()) web_log_append('W', __func__, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_W_NO_FUNC( ... ) do { Serial.printf ( __VA_ARGS__ ); if (web_log_subscriber_active()) web_log_append('W', NULL, __VA_ARGS__); } while(0)
#else
#define _LOG_W( ... ) 
#define _LOG_W_NO_FUNC( ... )
#endif
#if LOG_LEVEL >= 3  // Info
#define _LOG_I(fmt, ... ) do { \
    Serial.printf(EVSE_LOG_FORMAT(I, fmt), ##__VA_ARGS__); \
    if (web_log_subscriber_active()) web_log_append('I', __func__, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_I_NO_FUNC( ... ) do { Serial.printf ( __VA_ARGS__ ); if (web_log_subscriber_active()) web_log_append('I', NULL, __VA_ARGS__); } while(0)
#else
#define _LOG_I( ... )
#define _LOG_I_NO_FUNC( ... )
#endif
#if LOG_LEVEL >= 4  // Debug
#define _LOG_D(fmt, ... ) do { \
    Serial.printf(EVSE_LOG_FORMAT(D, fmt), ##__VA_ARGS__); \
    if (web_log_subscriber_active()) web_log_append('D', __func__, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_D_NO_FUNC( ... ) do { Serial.printf ( __VA_ARGS__ ); if (web_log_subscriber_active()) web_log_append('D', NULL, __VA_ARGS__); } while(0)
#else
#define _LOG_D( ... ) 
#define _LOG_D_NO_FUNC( ... )
#endif
#if LOG_LEVEL >= 5  // Verbose
#define _LOG_V(fmt, ... ) do { \
    Serial.printf(EVSE_LOG_FORMAT(V, fmt), ##__VA_ARGS__); \
    if (web_log_subscriber_active()) web_log_append('V', __func__, fmt, ##__VA_ARGS__); \
} while(0)
#define _LOG_V_NO_FUNC( ... ) do { Serial.printf ( __VA_ARGS__ ); if (web_log_subscriber_active()) web_log_append('V', NULL, __VA_ARGS__); } while(0)
#else
#define _LOG_V( ... ) 
#define _LOG_V_NO_FUNC( ... )
#endif
#endif //ESP32

#if !defined(SMARTEVSE_VERSION) && (DBG_CH32 == 1 || DBG_CH32 == 2) //CH32
#define DEBUG_DISABLED 1
#define LOG_LEVEL 5
#if LOG_LEVEL >= 1  // Errors
#define _LOG_A_NO_FUNC( ... ) printf ( __VA_ARGS__ )
#define _LOG_A( ... ) printf ( "@MSG:" __VA_ARGS__ )
#else
#define _LOG_A( ... )
#define _LOG_A_NO_FUNC( ... )
#endif
#if LOG_LEVEL >= 2  // Warnings
#define _LOG_W_NO_FUNC( ... ) printf ( __VA_ARGS__ )
#define _LOG_W( ... ) printf ( "@MSG:" __VA_ARGS__ )
#else
#define _LOG_W( ... ) 
#define _LOG_W_NO_FUNC( ... )
#endif
#if LOG_LEVEL >= 3  // Info
#define _LOG_I_NO_FUNC( ... ) printf ( __VA_ARGS__ )
#define _LOG_I( ... ) printf ( "@MSG:" __VA_ARGS__ )
#else
#define _LOG_I( ... )
#define _LOG_I_NO_FUNC( ... )
#endif
#if LOG_LEVEL >= 4  // Debug
#define _LOG_D_NO_FUNC( ... ) printf ( __VA_ARGS__ )
#define _LOG_D( ... ) printf ( "@MSG:" __VA_ARGS__ )
#else
#define _LOG_D( ... ) 
#define _LOG_D_NO_FUNC( ... )
#endif
#if LOG_LEVEL >= 5  // Verbose
#define _LOG_V_NO_FUNC( ... ) printf ( __VA_ARGS__ )
#define _LOG_V( ... ) printf ( "@MSG:" __VA_ARGS__ )
#else
#define _LOG_V( ... ) 
#define _LOG_V_NO_FUNC( ... )
#endif
#endif //CH32

#endif
