# SmartEVSE Implementation Guide

## Converting to Svelte for ESP32 Production

This React implementation is designed to be converted to Svelte for minimal bundle size. Follow these steps:

### Step 1: Setup Svelte Project

```bash
npm create vite@latest smartevse-ui -- --template svelte
cd smartevse-ui
npm install
```

### Step 2: Configure Vite for ESP32

Update `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: undefined, // Single chunk
      },
    },
    // Optimize for size
    cssCodeSplit: false,
  },
});
```

### Step 3: Component Conversion Examples

#### React to Svelte: Dashboard Component

**React (current):**
```jsx
import { useState } from 'react';

export function Dashboard({ data }) {
  const [currentLimit, setCurrentLimit] = useState(24);
  
  return (
    <div className="space-y-6">
      <input 
        type="range" 
        value={currentLimit}
        onChange={(e) => setCurrentLimit(Number(e.target.value))}
      />
    </div>
  );
}
```

**Svelte (target):**
```svelte
<script>
  export let data;
  let currentLimit = 24;
</script>

<div class="space-y-6">
  <input 
    type="range" 
    bind:value={currentLimit}
  />
</div>
```

### Step 4: API Integration

Create `src/lib/api.js`:

```javascript
const API_BASE = ''; // Empty for same-origin requests

export async function fetchSettings() {
  const response = await fetch(`${API_BASE}/settings`);
  return response.json();
}

export async function updateSettings(params) {
  const query = new URLSearchParams(params).toString();
  await fetch(`${API_BASE}/settings?${query}`, { method: 'POST' });
}

export async function fetchLogs(lines = 80) {
  const response = await fetch(`${API_BASE}/api/logs?lines=${lines}`);
  return response.json();
}
```

### Step 5: Routing

Use simple hash-based routing in `App.svelte`:

```svelte
<script>
  import { onMount } from 'svelte';
  import Dashboard from './components/Dashboard.svelte';
  import Settings from './components/Settings.svelte';
  import Log from './components/Log.svelte';
  import Flow from './components/Flow.svelte';
  
  let currentPage = 'home';
  
  function handleHashChange() {
    currentPage = window.location.hash.slice(1) || 'home';
  }
  
  onMount(() => {
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  });
</script>

{#if currentPage === 'home'}
  <Dashboard />
{:else if currentPage === 'settings'}
  <Settings />
{:else if currentPage === 'log'}
  <Log />
{:else if currentPage === 'flow'}
  <Flow />
{/if}
```

## ESP32 Integration

### File Structure on ESP32

```
/data/
  ├── index.html      (Svelte build output)
  ├── assets/
  │   ├── index.js    (< 150KB target)
  │   └── index.css   (< 50KB target)
  └── favicon.ico
```

### ESP32 Code Setup

**platformio.ini:**
```ini
[env:esp32]
platform = espressif32
board = esp32dev
framework = arduino

lib_deps = 
    ESP Async WebServer
    LittleFS

build_flags = 
    -DCORE_DEBUG_LEVEL=0
    -Os  ; Optimize for size

board_build.filesystem = littlefs
board_build.partitions = partitions.csv
```

**partitions.csv:**
```
# Name,   Type, SubType, Offset,  Size
nvs,      data, nvs,     0x9000,  0x5000
otadata,  data, ota,     0xe000,  0x2000
app0,     app,  ota_0,   0x10000, 0x180000
app1,     app,  ota_1,   0x190000,0x180000
spiffs,   data, spiffs,  0x310000,0xF0000
```

### C++ Web Server Implementation

```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

AsyncWebServer server(80);

void setupWebServer() {
  // Serve static files
  server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
  
  // GET /settings
  server.on("/settings", HTTP_GET, [](AsyncWebServerRequest *request){
    StaticJsonDocument<2048> doc;
    
    doc["version"] = "3.0.12";
    doc["serialnr"] = "SmartEVSE-12345";
    doc["mode"] = "SMART";
    doc["mode_id"] = 3;
    doc["car_connected"] = true;
    
    JsonObject evse = doc.createNestedObject("evse");
    evse["temp"] = getTemperature();
    evse["temp_max"] = 65;
    evse["state"] = "C2";
    evse["pwm"] = getPWM();
    
    JsonObject settings = doc.createNestedObject("settings");
    settings["charge_current"] = getChargeCurrent();
    settings["current_max"] = 320;
    
    JsonObject phase = doc.createNestedObject("phase_currents");
    phase["L1"] = getL1Current();
    phase["L2"] = getL2Current();
    phase["L3"] = getL3Current();
    phase["TOTAL"] = getTotalCurrent();
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response);
  });
  
  // POST /settings
  server.on("/settings", HTTP_POST, [](AsyncWebServerRequest *request){
    if (request->hasParam("mode")) {
      int mode = request->getParam("mode")->value().toInt();
      setMode(mode);
    }
    
    if (request->hasParam("mode_override_current")) {
      int current = request->getParam("mode_override_current")->value().toInt();
      setOverrideCurrent(current);
    }
    
    request->send(200, "text/plain", "OK");
  });
  
  // GET /api/logs
  server.on("/api/logs", HTTP_GET, [](AsyncWebServerRequest *request){
    int lines = 80;
    if (request->hasParam("lines")) {
      lines = request->getParam("lines")->value().toInt();
    }
    
    StaticJsonDocument<4096> doc;
    doc["total"] = 100;
    doc["available"] = lines;
    
    JsonArray logLines = doc.createNestedArray("lines");
    // Add your log lines here
    logLines.add("[I] System started");
    logLines.add("[D] Current: 24.0A");
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response);
  });
  
  server.begin();
}
```

## Optimization Checklist

### Before Building

- [ ] Remove all console.log statements
- [ ] Minify all assets
- [ ] Remove unused imports
- [ ] Use production build (`npm run build`)
- [ ] Compress CSS
- [ ] Inline critical CSS if needed

### Bundle Size Verification

```bash
# After building
du -sh dist/*

# Target sizes:
# dist/assets/index.js < 150KB
# dist/assets/index.css < 50KB
# dist/index.html < 10KB
```

### Further Optimizations

1. **Use Preact instead of React**: Even smaller than Svelte
   ```bash
   npm install preact
   # Alias React to Preact in vite.config.js
   ```

2. **Tree-shaking**: Ensure all unused code is removed
   
3. **Compression**: Enable gzip on ESP32 server
   ```cpp
   response->addHeader("Content-Encoding", "gzip");
   ```

4. **Caching**: Set long cache headers for static assets
   ```cpp
   response->addHeader("Cache-Control", "public, max-age=31536000");
   ```

## Testing on ESP32

1. Build the project:
   ```bash
   npm run build
   ```

2. Upload files to ESP32 LittleFS:
   ```bash
   pio run --target uploadfs
   ```

3. Flash firmware:
   ```bash
   pio run --target upload
   ```

4. Monitor serial output:
   ```bash
   pio device monitor
   ```

5. Access web interface:
   - Connect to ESP32 WiFi or
   - Navigate to `http://[esp32-ip]`

## Performance Monitoring

Add these to your ESP32 code:

```cpp
// Monitor heap memory
Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());

// Monitor request time
unsigned long start = millis();
// ... handle request ...
Serial.printf("Request took %lu ms\n", millis() - start);
```

## Security Considerations

1. **PIN Protection**: Implement server-side validation for hardware settings
2. **WiFi Security**: Use WPA2 at minimum
3. **HTTPS**: Consider SSL/TLS for sensitive networks
4. **Rate Limiting**: Prevent API abuse
5. **Input Validation**: Validate all POST parameters

## Troubleshooting

### Bundle too large
- Switch from React to Preact or Svelte
- Remove unused dependencies
- Use dynamic imports for rarely-used features

### OTA Updates failing
- Ensure partition sizes are correct
- Compress assets before uploading
- Use incremental updates

### Web interface slow
- Increase polling interval
- Reduce JSON payload size
- Enable compression
- Use WebSocket instead of polling

## Resources

- [Svelte Documentation](https://svelte.dev/docs)
- [ESP32 Arduino Core](https://docs.espressif.com/projects/arduino-esp32/)
- [ESPAsyncWebServer](https://github.com/me-no-dev/ESPAsyncWebServer)
- [LittleFS Documentation](https://arduino-esp8266.readthedocs.io/en/latest/filesystem.html)
