/**
 * API Service for SmartEVSE
 * 
 * This file contains mock implementations of the API calls.
 * Replace these with actual fetch() calls when connecting to ESP32.
 */

export interface SmartEVSEData {
  version: string;
  serialnr: string;
  mode: string;
  mode_id: number;
  car_connected: boolean;
  evse: {
    temp: number;
    temp_max: number;
    state: string;
    state_id: number;
    error: string;
    pwm: number;
    loadbl: number;
    solar_stop_timer: number;
  };
  settings: {
    charge_current: number;
    override_current: number;
    current_min: number;
    current_max: number;
    solar_start_current: number;
    solar_max_import: number;
    solar_stop_time: number;
  };
  phase_currents: {
    L1: number;
    L2: number;
    L3: number;
    TOTAL: number;
  };
  ev_meter: {
    import_active_power: number;
    charged_wh: number;
  };
  solar: {
    power: number;
  };
  home: {
    power: number;
  };
  grid: {
    power: number;
  };
}

export interface LogResponse {
  total: number;
  available: number;
  lines: string[];
}

/**
 * Fetch settings from ESP32
 * Real implementation: GET /settings
 */
export async function fetchSettings(): Promise<SmartEVSEData> {
  // TODO: Replace with actual API call
  // return fetch('/settings').then(res => res.json());
  
  // Mock data for development
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        version: '3.0.12',
        serialnr: 'SmartEVSE-12345',
        mode: 'SMART',
        mode_id: 3,
        car_connected: true,
        evse: {
          temp: 42 + Math.floor(Math.random() * 3),
          temp_max: 65,
          state: 'C2',
          state_id: 2,
          error: 'None',
          pwm: 614,
          loadbl: 0,
          solar_stop_timer: 0,
        },
        settings: {
          charge_current: 240,
          override_current: 0,
          current_min: 60,
          current_max: 320,
          solar_start_current: 40,
          solar_max_import: 100,
          solar_stop_time: 10,
        },
        phase_currents: {
          L1: 78,
          L2: 82,
          L3: 80,
          TOTAL: 240,
        },
        ev_meter: {
          import_active_power: 3700,
          charged_wh: 8200,
        },
        solar: {
          power: 2500,
        },
        home: {
          power: 1800,
        },
        grid: {
          power: -1000,
        },
      });
    }, 100);
  });
}

/**
 * Update settings on ESP32
 * Real implementation: POST /settings?param=value&...
 */
export async function updateSettings(params: Record<string, any>): Promise<void> {
  // TODO: Replace with actual API call
  // const query = new URLSearchParams(params).toString();
  // return fetch(`/settings?${query}`, { method: 'POST' });
  
  console.log('Updating settings:', params);
  return Promise.resolve();
}

/**
 * Fetch logs from ESP32
 * Real implementation: GET /api/logs?lines=80
 */
export async function fetchLogs(lines: number = 80): Promise<LogResponse> {
  // TODO: Replace with actual API call
  // return fetch(`/api/logs?lines=${lines}`).then(res => res.json());
  
  // Mock data for development
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        total: 100,
        available: 80,
        lines: [
          '[I] System started',
          '[I] WiFi connected',
          '[D] Mains meter: L1=7.8A L2=8.2A L3=8.0A',
          '[I] EV connected',
          '[I] Mode changed to SMART',
          '[D] Charge current set to 24.0A',
          '[W] Temperature rising: 42°C',
          '[I] Charging started',
          '[D] PWM duty cycle: 61.4%',
          '[I] Energy metering active',
        ],
      });
    }, 100);
  });
}

/**
 * Validate Home Assistant entity
 * Real implementation: GET /api/validate_ha_entity?entity_id=sensor.xyz
 */
export async function validateHAEntity(entityId: string): Promise<{ ok: boolean; error?: string }> {
  // TODO: Replace with actual API call
  // return fetch(`/api/validate_ha_entity?entity_id=${entityId}`).then(res => res.json());
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ok: true });
    }, 500);
  });
}
