import { InfoDialog } from './InfoDialog';
import { helpText } from '../config/helpText';
import { useState } from 'react';

interface SettingsProps {
  data: any;
}

export function Settings({ data }: SettingsProps) {
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [mainsMeterType, setMainsMeterType] = useState('Disabled');
  const [evMeterType, setEvMeterType] = useState('Disabled');
  const [ocppEnabled, setOcppEnabled] = useState(false);
  const [appServerEnabled, setAppServerEnabled] = useState(false);
  const [appPinGenerated, setAppPinGenerated] = useState(false);
  const [smartevseAppEnabled, setSmartevseAppEnabled] = useState(false);
  const [rfidMode, setRfidMode] = useState('Disabled');
  const [showLearnDialog, setShowLearnDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  
  // Connection status states (mock data - would come from backend in real app)
  const [wifiConnected, setWifiConnected] = useState(true);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [ocppConnected, setOcppConnected] = useState(false);
  const [mainsMeterConnected, setMainsMeterConnected] = useState(true);
  const [evMeterConnected, setEvMeterConnected] = useState(true);
  const [appServerConnected, setAppServerConnected] = useState(false);
  const [smartevseAppConnected, setSmartevseAppConnected] = useState(false);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPinValue(value);
  };

  const handlePinSubmit = () => {
    if (pinValue === '0000') {
      setPinUnlocked(true);
    } else {
      setPinUnlocked(false);
      alert('Incorrect PIN');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Connectivity Section */}
      <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-white/10 to-white/5 px-6 py-4 border-b border-[#2a3544]">
          <h2 className="text-lg text-white font-semibold">Connectivity</h2>
        </div>
        <div className="p-6">
          {/* WiFi */}
          <div className="pb-6 mb-6 border-b border-[#2a3544]/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-300">WiFi</h3>
                <InfoDialog title={helpText.wifiSSID.title} description={helpText.wifiSSID.description} />
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                wifiConnected 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${wifiConnected ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                {wifiConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Network name</label>
                <input
                  type="text"
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                  placeholder="Network name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Password</label>
                <input
                  type="password"
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* MQTT */}
          <div className="pb-6 mb-6 border-b border-[#2a3544]/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-300">MQTT</h3>
                <InfoDialog title={helpText.mqttHost.title} description={helpText.mqttHost.description} />
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                mqttConnected 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${mqttConnected ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                {mqttConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Host</label>
                <input
                  type="text"
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                  placeholder="mqtt.example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Port</label>
                <input
                  type="number"
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                  placeholder="1883"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Username</label>
                <input
                  type="text"
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Password</label>
                <input
                  type="password"
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-2">Topic Prefix</label>
                <input
                  type="text"
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                  placeholder="homeassistant/smartevse"
                  defaultValue="homeassistant/smartevse"
                />
              </div>
            </div>
          </div>

          {/* OCPP */}
          <div className={wifiConnected ? "pb-6 mb-6 border-b border-[#2a3544]/50" : ""}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-300">OCPP</h3>
                <InfoDialog title="OCPP" description="Open Charge Point Protocol allows the SmartEVSE to communicate with OCPP-compliant charging management systems." />
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                ocppConnected 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ocppConnected ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                {ocppConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ocppEnabled}
                  onChange={(e) => setOcppEnabled(e.target.checked)}
                  className="w-4 h-4 text-[#4A9EFF] bg-[#0f1924] border-[#2a3544] rounded focus:ring-[#4A9EFF] focus:ring-2"
                />
                <span className="text-sm text-gray-300">Enable OCPP</span>
              </label>
            </div>
          </div>

          {/* SmartEVSE App - Only shown when WiFi is enabled */}
          {wifiConnected && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-300">SmartEVSE App</h3>
                  <InfoDialog 
                    title="SmartEVSE App" 
                    description="Enable integration with the SmartEVSE mobile app for remote monitoring and control." 
                  />
                </div>
                {smartevseAppEnabled && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    smartevseAppConnected 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                      : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${smartevseAppConnected ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                    {smartevseAppConnected ? 'Connected' : 'Disconnected'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smartevseAppEnabled}
                    onChange={(e) => setSmartevseAppEnabled(e.target.checked)}
                    className="w-4 h-4 text-[#4A9EFF] bg-[#0f1924] border-[#2a3544] rounded focus:ring-[#4A9EFF] focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Enable SmartEVSE App</span>
                </label>
              </div>
              
              {smartevseAppEnabled && (
                <div className="ml-6 space-y-6 border-l-2 border-[#2a3544]/50 pl-6">
                  {/* App PIN */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-sm font-medium text-gray-300">App PIN</h4>
                      <InfoDialog 
                        title="App PIN" 
                        description="Generate a 6-digit pairing PIN for connecting the SmartEVSE mobile app." 
                      />
                    </div>
                    <button
                      onClick={() => setAppPinGenerated(true)}
                      className="px-4 py-2.5 bg-gradient-to-r from-[#4A9EFF] to-[#3A8EEF] text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium"
                    >
                      Generate PIN
                    </button>
                    {appPinGenerated && (
                      <div className="mt-4 bg-[#0f1924]/50 rounded-lg p-4 border border-[#2a3544]/50">
                        <p className="text-sm text-gray-300 leading-relaxed">
                          The PIN is displayed on the LCD screen and is valid for 2 minutes.<br/>
                          Enter this PIN in the SmartEVSE mobile app to pair your device.<br/>
                          The PIN is automatically cleared when you exit the menu or after the timeout expires.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* App Server */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-300">App Server</h4>
                        <InfoDialog 
                          title="App Server" 
                          description="Enable or disable the connection to the SmartEVSE cloud server for mobile app integration. Disabled: No connection to the SmartEVSE server. Enabled: Connect to mqtt.smartevse.nl for mobile app communication." 
                        />
                      </div>
                      {appServerEnabled && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                          appServerConnected 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                            : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${appServerConnected ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                          {appServerConnected ? 'Connected' : 'Disconnected'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={appServerEnabled}
                          onChange={(e) => setAppServerEnabled(e.target.checked)}
                          className="w-4 h-4 text-[#4A9EFF] bg-[#0f1924] border-[#2a3544] rounded focus:ring-[#4A9EFF] focus:ring-2"
                        />
                        <span className="text-sm text-gray-300">Enable App Server</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Energy Section */}
      <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-white/10 to-white/5 px-6 py-4 border-b border-[#2a3544]">
          <h2 className="text-lg text-white font-semibold">Energy</h2>
        </div>
        <div className="p-6">
          {/* Main Meter */}
          <div className="pb-6 mb-6 border-b border-[#2a3544]/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-300">Mains Meter</h3>
                <InfoDialog title="Mains kWh Meter" description="Set the type of MAINS kWh Meter. Disabled: No MAINS meter connected (only Normal mode possible). Sensorbox: The Sensorbox sends measurement data to the SmartEVSE. API: MAINS meter data is fed through the REST API or MQTT API." />
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                mainsMeterConnected 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${mainsMeterConnected ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                {mainsMeterConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Type</label>
                  <select
                    className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                    value={mainsMeterType}
                    onChange={(e) => setMainsMeterType(e.target.value)}
                  >
                    <option>Disabled</option>
                    <option>Sensorbox</option>
                    <option>API</option>
                    <option>Phoenix Contact</option>
                    <option>Finder 7M</option>
                    <option>Eastron1P</option>
                    <option>Eastron3P</option>
                    <option>InvEastron</option>
                    <option>ABB</option>
                    <option>Solaredge</option>
                    <option>HmWzrd P1</option>
                    <option>Custom</option>
                  </select>
                </div>
                {mainsMeterType !== 'Disabled' && mainsMeterType !== 'API' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">MAINS ADR (Modbus Address)</label>
                    <input
                      type="number"
                      className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                      placeholder="10"
                      min="1"
                      max="247"
                    />
                  </div>
                )}
              </div>
              {mainsMeterType === 'Sensorbox' && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-medium text-gray-400">GRID Configuration</h4>
                    <InfoDialog title="Grid Configuration" description="4Wire: Star connection with 3 phase wires and neutral. 3Wire: Delta connection with 3 phase wires without neutral." />
                  </div>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="grid-main" value="4wire" className="text-[#4A9EFF] w-4 h-4" defaultChecked />
                      <span className="text-sm text-gray-300">4-Wire</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="grid-main" value="3wire" className="text-[#4A9EFF] w-4 h-4" />
                      <span className="text-sm text-gray-300">3-Wire</span>
                    </label>
                  </div>
                </>
              )}
              {mainsMeterType === 'API' && (
                <div className="bg-[#0f1924]/50 rounded-lg p-4 border border-[#2a3544]/50">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Publish <span className="font-mono text-[#4A9EFF]">L1:L2:L3</span> to topic{' '}
                    <span className="font-mono text-[#4A9EFF]">{'{prefix}'}/Set/MainsMeter</span>. 
                    Use deci-amps (e.g. <span className="font-mono text-[#4A9EFF]">45:32:21</span>). 
                    No entity IDs on this device—your broker/HA/Node-RED pushes the values.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* EV Meter */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-300">EV Meter</h3>
                <InfoDialog title="EV kWh Meter" description="Set Type of EV kWh Meter (measures power and charged energy). Disabled: No EV meter connected. API: EV meter data is fed through the REST API or MQTT API." />
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                evMeterConnected 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${evMeterConnected ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                {evMeterConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Type</label>
                  <select
                    className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                    value={evMeterType}
                    onChange={(e) => setEvMeterType(e.target.value)}
                  >
                    <option>Disabled</option>
                    <option>API</option>
                    <option>Phoenix Contact</option>
                    <option>Finder 7M</option>
                    <option>Eastron1P</option>
                    <option>Eastron3P</option>
                    <option>InvEastron</option>
                    <option>ABB</option>
                    <option>Solaredge</option>
                    <option>Custom</option>
                  </select>
                </div>
                {evMeterType !== 'Disabled' && evMeterType !== 'API' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">EV ADR (Modbus Address)</label>
                    <input
                      type="number"
                      className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                      placeholder="10"
                      min="10"
                      max="247"
                    />
                  </div>
                )}
              </div>
              {evMeterType === 'API' && (
                <div className="bg-[#0f1924]/50 rounded-lg p-4 border border-[#2a3544]/50">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Publish <span className="font-mono text-[#4A9EFF]">L1:L2:L3</span> to topic{' '}
                    <span className="font-mono text-[#4A9EFF]">{'{prefix}'}/Set/EVMeter</span>. 
                    Use deci-amps (e.g. <span className="font-mono text-[#4A9EFF]">45:32:21</span>). 
                    No entity IDs on this device—your broker/HA/Node-RED pushes the values.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* EU Capacity Limit (SumMains) */}
          <div className="pt-6 border-t border-[#2a3544]/50">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-gray-300">EU Capacity Limit</h3>
              <InfoDialog 
                title="EU Capacity Limit (SumMains)" 
                description="Maximum allowed total current (in Amps) for all connected SmartEVSE units combined. This is typically the main fuse/breaker rating of your electrical installation. Used in load balancing to ensure the total load across all charge points doesn't exceed your building's electrical capacity. EU regulations often require this limit to prevent grid overload." 
              />
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">SumMains (A)</label>
                <input
                  type="number"
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                  placeholder="600"
                  defaultValue="600"
                  min="100"
                  max="2000"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RFID Section */}
      <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-white/10 to-white/5 px-6 py-4 border-b border-[#2a3544]">
          <h2 className="text-lg text-white font-semibold">RFID</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm text-gray-400">RFID Mode</label>
                <InfoDialog 
                  title="RFID Mode" 
                  description="Use an RFID Card Reader to Enable/Disable Access to the EVSE. A maximum of 100 RFID cards can be stored. Only a push button can be used simultaneously with the RFID reader.

• Disabled: RFID reader turned off.
• EnableAll: Accept all learned cards for enabling/disabling the SmartEVSE.
• EnableOne: Only allow a single (learned) card for enabling/disabling the SmartEVSE. In this mode, the lock (if used) will lock the cable in the charging socket, and the same card is used to unlock it.
• Rmt/OCPP: Authorize remotely over OCPP and bypass the SmartEVSE's local RFID storage." 
                />
              </div>
              <select
                className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                value={rfidMode}
                onChange={(e) => setRfidMode(e.target.value)}
              >
                <option>Disabled</option>
                <option>EnableAll</option>
                <option>EnableOne</option>
                {ocppEnabled && <option>Rmt/OCPP</option>}
              </select>
            </div>

            {rfidMode !== 'Disabled' && (
              <div className="pt-4 border-t border-[#2a3544]/50">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Card Management</h4>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowLearnDialog(true)}
                    className="px-4 py-2.5 bg-[#0f1924] border border-[#2a3544] text-white rounded-lg hover:border-[#4A9EFF] hover:shadow-lg hover:shadow-blue-500/20 transition-all font-medium"
                  >
                    Learn Card
                  </button>
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="px-4 py-2.5 bg-[#0f1924] border border-[#2a3544] text-white rounded-lg hover:border-[#4A9EFF] hover:shadow-lg hover:shadow-blue-500/20 transition-all font-medium"
                  >
                    Delete Card
                  </button>
                  <button
                    onClick={() => setShowDeleteAllDialog(true)}
                    className="px-4 py-2.5 bg-[#0f1924] border border-red-500/50 text-red-400 rounded-lg hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20 transition-all font-medium"
                  >
                    Delete All Cards
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Learn Card Dialog */}
      {showLearnDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Learn RFID Card</h3>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Present a card in front of the RFID reader. When the card is successfully learned, "Card Stored" will be displayed on the LCD screen.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLearnDialog(false)}
                className="px-4 py-2.5 bg-gradient-to-r from-[#4A9EFF] to-[#3A8EEF] text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Card Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Delete RFID Card</h3>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Hold the card you want to delete in front of the RFID reader. When the card is successfully deleted, "Card Deleted" will be displayed on the LCD screen.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2.5 bg-gradient-to-r from-[#4A9EFF] to-[#3A8EEF] text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Cards Dialog */}
      {showDeleteAllDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Delete All RFID Cards</h3>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Are you sure you want to erase all learned RFID cards from the SmartEVSE? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteAllDialog(false)}
                className="px-4 py-2.5 bg-[#0f1924] border border-[#2a3544] text-gray-400 rounded-lg hover:text-white transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Handle delete all action here
                  setShowDeleteAllDialog(false);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-lg hover:shadow-red-500/30 transition-all font-medium"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hardware Section (PIN Protected) */}
      <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-white/10 to-white/5 px-6 py-4 border-b border-[#2a3544] flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2"/>
            <path d="M12 7v6M12 16v.5" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h2 className="text-lg text-white font-semibold">Hardware (PIN Protected)</h2>
        </div>
        <div className="p-6">
          <div className="bg-[#0f1924]/50 rounded-lg p-4 mb-6 border border-[#2a3544]/50">
            <p className="text-sm text-gray-400 mb-3">
              {pinUnlocked ? (
                <span className="text-green-400">✓ PIN accepted. Hardware settings unlocked.</span>
              ) : (
                'Enter PIN to modify hardware settings.'
              )}
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1 max-w-xs">
                <input
                  type="password"
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                  placeholder="Enter PIN"
                  maxLength={4}
                  value={pinValue}
                  onChange={handlePinChange}
                />
              </div>
              <button
                onClick={handlePinSubmit}
                className="px-4 py-2.5 bg-gradient-to-r from-[#4A9EFF] to-[#3A8EEF] text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium"
              >
                Submit
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!pinUnlocked ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm text-gray-400">Max Circuit Current (A)</label>
                <InfoDialog 
                  title="Max Circuit Current" 
                  description="Maximum current rating of the electrical circuit breaker protecting the SmartEVSE installation. This value must match or be lower than your circuit breaker rating (typically 16A, 32A, or higher). Range: 10-160A." 
                />
              </div>
              <input
                type="number"
                className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white"
                placeholder="32"
                min="10"
                max="160"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm text-gray-400">Max Current (A)</label>
                <InfoDialog 
                  title="Max Current" 
                  description="Maximum charging current that the SmartEVSE can deliver to the vehicle. This should be set based on the cable rating and vehicle capabilities. Must be equal to or lower than Max Circuit Current. Range: 6-80A." 
                />
              </div>
              <input
                type="number"
                className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white"
                placeholder="32"
                min="6"
                max="80"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm text-gray-400">Config</label>
                <InfoDialog 
                  title="Configuration" 
                  description="Socket: EVSE has a Type 2 socket for connecting your own cable. Fixed Cable: EVSE has a permanently attached charging cable with Type 2 connector." 
                />
              </div>
              <select className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white">
                <option>Socket</option>
                <option>Fixed Cable</option>
              </select>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm text-gray-400">Load Balancing</label>
                <InfoDialog 
                  title="Load Balancing" 
                  description="Configure the load balancing mode for multiple SmartEVSE units. Disabled: No load balancing. Master: This unit acts as the Master and coordinates charging with Node units. Node 1/2/3: This unit is a Node that receives commands from the Master. All units must be connected via Modbus." 
                />
              </div>
              <select className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white">
                <option>Disabled</option>
                <option>Master</option>
                <option>Node 1</option>
                <option>Node 2</option>
                <option>Node 3</option>
              </select>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm text-gray-400">Max Temperature (°C)</label>
                <InfoDialog 
                  title="Max Temperature" 
                  description="Maximum allowed temperature for the internal temperature sensor. If this temperature is exceeded, charging will be reduced or stopped to prevent overheating. Recommended: 65°C. Range: 40-75°C." 
                />
              </div>
              <input
                type="number"
                className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white"
                placeholder="65"
                min="40"
                max="75"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm text-gray-400">RCD Monitor</label>
                <InfoDialog 
                  title="RCD Monitor" 
                  description="Residual Current Device monitoring. Enabled: SmartEVSE monitors the RCD (Ground Fault Circuit Interrupter) status. If the RCD trips, charging will be stopped. Disabled: No RCD monitoring." 
                />
              </div>
              <select className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white">
                <option>Disabled</option>
                <option>Enabled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button className="px-6 py-3 bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 rounded-lg hover:text-white border border-[#2a3544] shadow-lg transition-all">
          Cancel
        </button>
        <button className="px-6 py-3 bg-gradient-to-r from-[#4A9EFF] to-[#3A8EEF] text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium">
          Save Settings
        </button>
      </div>
    </div>
  );
}