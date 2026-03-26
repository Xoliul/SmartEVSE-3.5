// Help text for all settings - centralized configuration
export const helpText = {
  // Dashboard - Mode Selection
  chargeMode: {
    title: 'Charge Mode',
    description: 'Select the charging mode for your EV. Solar mode charges using excess solar power, Smart mode balances grid load, and Normal mode charges at a fixed current.',
  },
  
  // Dashboard - Solar Mode Parameters
  solarStartCurrent: {
    title: 'Start Current',
    description: 'Minimum charging current required to start a charging session in Solar mode. The system will only begin charging when this amount of solar surplus is available.',
  },
  solarMaxImport: {
    title: 'Max Import',
    description: 'Maximum current allowed to be imported from the grid while in Solar mode. Set to 0 for pure solar charging only.',
  },
  solarStopTime: {
    title: 'Stop Time',
    description: 'Time in minutes that the charger will wait when insufficient solar power is available before stopping the charging session.',
  },
  
  // Dashboard - Smart Mode
  smartOverride: {
    title: 'Override Current',
    description: 'Manually override the Smart mode automatic current calculation. Set to "None" to let the system automatically manage charging current based on available grid capacity.',
  },
  
  // Dashboard - Normal Mode
  normalCurrent: {
    title: 'Charge Current',
    description: 'Fixed charging current in Normal mode. The EV will charge at this constant rate regardless of solar production or grid load.',
  },
  
  // Settings - WiFi
  wifiSSID: {
    title: 'WiFi SSID',
    description: 'Name of your WiFi network. The SmartEVSE will connect to this network for remote monitoring and control.',
  },
  wifiPassword: {
    title: 'WiFi Password',
    description: 'Password for your WiFi network. This is stored securely on the device.',
  },
  
  // Settings - MQTT
  mqttHost: {
    title: 'MQTT Host',
    description: 'Hostname or IP address of your MQTT broker. Used for integration with home automation systems.',
  },
  mqttPort: {
    title: 'MQTT Port',
    description: 'Port number for MQTT connection. Default is 1883 for non-encrypted connections, 8883 for encrypted.',
  },
  mqttUsername: {
    title: 'MQTT Username',
    description: 'Username for authenticating with your MQTT broker, if authentication is enabled.',
  },
  mqttPassword: {
    title: 'MQTT Password',
    description: 'Password for MQTT authentication.',
  },
  
  // Settings - Mains Meter
  mainsType: {
    title: 'Mains Meter Type',
    description: 'Type of energy meter measuring your main grid connection. This meter monitors total household power consumption.',
  },
  mainsAddress: {
    title: 'Mains Meter Address',
    description: 'Modbus address of the mains meter. Each meter on the bus must have a unique address between 10-247.',
  },
  
  // Settings - EV Meter
  evMeterType: {
    title: 'EV Meter Type',
    description: 'Type of energy meter measuring EV charging. This dedicated meter tracks energy delivered to your vehicle.',
  },
  evMeterAddress: {
    title: 'EV Meter Address',
    description: 'Modbus address of the EV meter. Must be different from the mains meter address.',
  },
  
  // Settings - Grid Config
  gridConfig: {
    title: 'Grid Configuration',
    description: '4-Wire systems have 3 phases + neutral. 3-Wire systems have 3 phases without neutral. Select based on your electrical installation.',
  },
  
  // Settings - Hardware (PIN Protected)
  maxCircuitCurrent: {
    title: 'Max Circuit Current',
    description: 'Maximum current capacity of your electrical circuit. Must match the rating of your circuit breaker and wiring.',
  },
  maxCurrent: {
    title: 'Max Current',
    description: 'Maximum charging current the EVSE can deliver to the vehicle. Limited by cable and connector ratings.',
  },
  evseConfig: {
    title: 'Config',
    description: 'Type of EV connector. Socket allows using different cables, Fixed Cable has a permanently attached cable.',
  },
  loadBalancing: {
    title: 'Load Balancing',
    description: 'Enables load balancing between multiple chargers. Set one as Master and others as Nodes for coordinated charging.',
  },
  maxTemperature: {
    title: 'Max Temperature',
    description: 'Maximum operating temperature in Celsius. Charging will be reduced or stopped if this temperature is exceeded.',
  },
  rcdMonitor: {
    title: 'RCD Monitor',
    description: 'Residual Current Device monitoring for additional safety. Enable if you have an RCD connected to the monitoring input.',
  },
};
