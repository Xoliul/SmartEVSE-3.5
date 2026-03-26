# SmartEVSE Web Interface

A lightweight web interface for SmartEVSE v3/v4, designed to be hosted on ESP32.

## Overview

This is a React-based implementation that closely follows the SmartEVSE specifications. The interface includes:

- **Dashboard (Home)**: Real-time charging stats, energy flow visualization, mode selection, and current limiting
- **Settings**: Configuration for connectivity, energy meters, and hardware settings
- **Log**: Live log viewer with level filtering and text search
- **Logic Flow**: Visual debugger showing Smart and Solar mode decision logic

## Key Features

### Dashboard
- Real-time charging metrics (Current, Voltage, Power, Energy)
- Visual energy flow diagram (Solar → Home → EV)
- Mode selector (Solar, Smart, Manual)
- Interactive current limit slider (6A - 32A)
- Info cards for Grid, Solar, Home, and EV Charge

### Settings
- **Connectivity**: WiFi, MQTT configuration
- **Energy**: Mains meter, EV meter, Solar meter, Grid configuration
- **Hardware**: PIN-protected critical settings (max current, load balancing, etc.)

### Log Viewer
- Real-time log streaming with configurable poll interval
- Level filtering (A, E, W, I, D, V, Other)
- Text search capability
- Color-coded log levels

### Logic Flow
- Visual representation of Smart and Solar mode algorithms
- Live data overlay showing current values
- Step-by-step decision flow

## Design Specifications

### Theme
- Dark theme optimized for readability
- Primary color: #4A9EFF (blue)
- Background: #0a1628 (dark navy)
- Cards: #0f1f36 with #1a3050 borders

### Bundle Size Targets (for ESP32)
- JS bundle: < 150 KB
- CSS: < 50 KB
- Total UI: < 300 KB

## API Integration

The interface is designed to work with these endpoints:

- `GET /settings` - Returns all device state and configuration
- `POST /settings?param=value` - Updates settings
- `GET /api/logs?lines=80` - Returns log lines

### Mock Data Structure

```javascript
{
  version: '3.0.12',
  serialnr: 'SmartEVSE-12345',
  mode: 'SMART',
  mode_id: 3,
  car_connected: true,
  evse: { temp, temp_max, state, error, pwm, ... },
  settings: { charge_current, current_max, ... },
  phase_currents: { L1, L2, L3, TOTAL },
  ev_meter: { import_active_power, charged_wh },
  solar: { power },
  home: { power },
  grid: { power }
}
```

## Hash Routing

The app uses simple hash-based routing:
- `#home` or `/` - Dashboard
- `#settings` - Settings page
- `#log` - Log viewer
- `#flow` - Logic flow diagram

## Converting to Svelte/Preact

This React implementation can be easily converted to Svelte or Preact:

1. **Component Structure**: Each component is in `/src/app/components/`
2. **State Management**: Uses simple `useState` hooks
3. **Styling**: All Tailwind CSS classes are portable
4. **No heavy dependencies**: Only React built-ins used

### Conversion Tips

**For Svelte:**
- Replace `useState` with Svelte stores or reactive `$:` statements
- Convert JSX to Svelte template syntax
- Use `on:click` instead of `onClick`

**For Preact:**
- Change imports from `react` to `preact/hooks`
- Minimal changes needed to JSX
- Will reduce bundle size significantly

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Production Build for ESP32

After building with Vite:

1. The output will be in `/dist`
2. Files needed: `index.html`, compiled JS, compiled CSS, and assets
3. Upload to ESP32 flash storage (LittleFS/SPIFFS)
4. Serve via ESP32 HTTP server

## Customization

### Colors
Modify the color values in `/src/app/App.tsx` and component files:
- Primary blue: `#4A9EFF`
- Background: `#0a1628`
- Card background: `#0f1f36`
- Border: `#1a3050`

### Polling Interval
Default is 5 seconds for `/settings` endpoint. Adjust in `App.tsx`:

```javascript
const interval = setInterval(() => {
  // fetch('/settings')...
}, 5000); // Change this value
```

## Performance Optimizations

- Uses inline SVG icons (no icon library overhead)
- Minimal dependencies
- Simple hash routing (no router library)
- Efficient re-renders with React hooks
- CSS optimized for small bundle size

## Browser Support

- Chrome, Safari, Edge, Firefox
- Mobile browsers (iOS Safari, Chrome Mobile)
- ES2020+ JavaScript required
- CSS Grid and Flexbox support required

## License

This interface is designed for SmartEVSE open source project.
