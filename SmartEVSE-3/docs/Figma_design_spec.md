# SmartEVSE Web UI – Technical UI Specification

## Purpose

This document defines the **technical constraints and architecture for the SmartEVSE web interface** so that UI designs created in Figma can realistically be implemented on an ESP32 device.

The UI runs directly from the ESP32 and must therefore be **lightweight, efficient, and optimized for embedded hardware**.

This specification focuses only on the **frontend architecture and constraints** relevant to design and layout.

---

# 1. Architecture Overview

The SmartEVSE web interface is a **Single Page Application (SPA)** built using **Svelte**.

The compiled UI is served directly by the ESP32 as **static files**.

The browser loads the interface locally from the charger itself.


Browser
│
│ HTTP
▼
ESP32 HTTP Server
│
├─ Static UI files (HTML / CSS / JS)
├─ REST API
└─ WebSocket (live data)


There is **no Node.js or backend framework running on the device**.

---

# 2. Frontend Framework

**Framework:** Svelte  
**Build tool:** Vite  
**Output:** Static bundle

Reasons for choosing Svelte:

- extremely small runtime
- minimal JavaScript bundle size
- reactive UI without heavy framework overhead
- ideal for embedded devices

---

# 3. Deployment Model

The UI is compiled into static files:


index.html
app.js
app.css
assets/*


These files are stored in the ESP32 flash filesystem.

Typical bundle size target:


JS bundle: < 150 KB
CSS: < 50 KB
Total UI: < 300 KB


Designs should avoid UI elements that require large libraries.

---

# 4. Communication with Firmware

The UI communicates with the firmware through two mechanisms.

## REST API

Used for:

- configuration
- initial data fetch
- settings updates

Example endpoints:


GET /api/status
GET /api/config
POST /api/config
POST /api/action


## WebSocket

Used for **live updates** such as:

- charging current
- power
- solar production
- grid usage
- system state

Example:


ws://device.local/ws


Update frequency target:


1 – 2 updates per second


---

# 5. Browser Support

The interface targets **modern browsers only**.

Supported environments:

- Chrome
- Safari
- Edge
- Firefox
- mobile browsers

Older browsers are **not supported**.

Design assumption:


ES2020+ JavaScript support
CSS Grid
Flexbox


---

# 6. Responsive Design Targets

The UI should work on:

### Desktop

Typical resolution:


1280 × 800
1920 × 1080


### Tablet

Typical resolution:


1024 × 768


### Mobile

Typical resolution:


375 × 812


Primary use case:

**Phone or tablet connecting locally to the charger.**

---

# 7. Performance Constraints

Because the UI runs on an ESP32 device:

Avoid:

- large UI frameworks
- heavy animation libraries
- large charting libraries
- large icon packs
- large font families

Recommended:

- SVG icons
- system fonts
- simple CSS animations
- lightweight charts if necessary

---

# 8. Design System

Design should follow a **clean dashboard style** optimized for energy monitoring.

Typical elements:

- status cards
- energy flow visualization
- power graphs
- toggle buttons
- configuration panels
- numeric telemetry readouts

Avoid overly complex UI patterns.

---

# 9. Typical UI Structure

Example structure:


Dashboard
Charging power
Solar production
Grid usage
Current per phase

Energy Flow
Solar → House → EV

Charging Controls
Start / Stop
Current limit

Settings
Charging modes
Solar mode
Network configuration


---

# 10. UI Design Guidelines for Figma

Designers should:

- use **clean grid layouts**
- prefer **clear numeric readouts**
- prioritize **legibility**
- design for **touch interaction**

Designs should assume:


fast local network
instant UI response
live data updates


---

# 11. Key Constraints Summary

| Constraint | Value |
|------------|------|
Frontend framework | Svelte
Build system | Vite
Deployment | Static files on ESP32
Runtime | Browser only
Realtime updates | WebSocket
Configuration | REST API
Target bundle size | < 300 KB
Primary use | Local device dashboard

---

# 12. Important Note

The UI is **not a cloud application**.

It runs **directly from the EV charger hardware**.

This means:

- the UI must stay lightweight
- all assets are served locally
- network latency is minimal

---

# End of Specification