interface FlowProps {
  data: any;
}

export function Flow({ data }: FlowProps) {
  const mode = data.mode;
  const isSmartMode = mode === 'SMART';
  const isSolarMode = mode === 'SOLAR';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-6">Logic Flow</h1>

      <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl p-6 border border-[#2a3544] shadow-2xl">
        <div className="mb-6">
          <span className="text-sm text-gray-400">Current Mode: </span>
          <span className="text-lg text-[#4A9EFF] font-semibold">{mode}</span>
        </div>

        {/* Smart Mode Flow */}
        {isSmartMode && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-[#4A9EFF]">Smart Mode Logic</h2>
            
            <div className="flex flex-col items-center gap-4">
              {/* Step 1: Mains Meter */}
              <div className="bg-gradient-to-br from-[#1a2f3e] to-[#142530] rounded-lg p-4 w-full max-w-md border-2 border-[#4A9EFF] shadow-lg shadow-blue-500/20">
                <h3 className="font-semibold mb-2">1. Mains Meter Reading</h3>
                <div className="text-sm space-y-1">
                  <div>L1: {(data.phase_currents.L1 / 10).toFixed(1)} A</div>
                  <div>L2: {(data.phase_currents.L2 / 10).toFixed(1)} A</div>
                  <div>L3: {(data.phase_currents.L3 / 10).toFixed(1)} A</div>
                  <div className="text-[#4A9EFF] mt-2 font-semibold">Total: {(data.phase_currents.TOTAL / 10).toFixed(1)} A</div>
                </div>
              </div>

              <div className="text-[#4A9EFF] text-2xl">↓</div>

              {/* Step 2: Calculate Available Current */}
              <div className="bg-gradient-to-br from-[#1a2f3e] to-[#142530] rounded-lg p-4 w-full max-w-md border-2 border-[#4A9EFF] shadow-lg shadow-blue-500/20">
                <h3 className="font-semibold mb-2">2. Calculate Available Current</h3>
                <div className="text-sm space-y-1">
                  <div>Max Circuit: {data.settings.current_max / 10} A</div>
                  <div>Current Load: {(data.phase_currents.TOTAL / 10).toFixed(1)} A</div>
                  <div className="text-[#4A9EFF] mt-2 font-semibold">
                    Available: {Math.max(0, (data.settings.current_max - data.phase_currents.TOTAL) / 10).toFixed(1)} A
                  </div>
                </div>
              </div>

              <div className="text-[#4A9EFF] text-2xl">↓</div>

              {/* Step 3: Set Balanced Current */}
              <div className="bg-gradient-to-br from-[#1a2f3e] to-[#142530] rounded-lg p-4 w-full max-w-md border-2 border-[#4A9EFF] shadow-lg shadow-blue-500/20">
                <h3 className="font-semibold mb-2">3. Set Balanced Current (IsetBalanced)</h3>
                <div className="text-sm space-y-1">
                  <div>Ramp: Increase slowly (+0.25A/cycle)</div>
                  <div>Decrease: Immediate when needed</div>
                  <div className="text-[#4A9EFF] mt-2 font-semibold">
                    Charge Current: {(data.settings.charge_current / 10).toFixed(1)} A
                  </div>
                </div>
              </div>

              <div className="text-[#4A9EFF] text-2xl">↓</div>

              {/* Step 4: PWM Output */}
              <div className="bg-gradient-to-br from-[#1a3e30] to-[#143025] rounded-lg p-4 w-full max-w-md border-2 border-green-500 shadow-lg shadow-green-500/20">
                <h3 className="font-semibold mb-2">4. PWM Output to EV</h3>
                <div className="text-sm space-y-1">
                  <div>Duty Cycle: {((data.evse.pwm / 1024) * 100).toFixed(1)}%</div>
                  <div>State: {data.evse.state}</div>
                  <div className="text-green-400 mt-2 font-semibold">
                    Charging at {(data.ev_meter.import_active_power / 1000).toFixed(1)} kW
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Solar Mode Flow */}
        {isSolarMode && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-[#FFD700]">Solar Mode Logic</h2>
            
            <div className="flex flex-col items-center gap-4">
              {/* Step 1: Solar & Grid */}
              <div className="bg-gradient-to-br from-[#3e381a] to-[#302a14] rounded-lg p-4 w-full max-w-md border-2 border-[#FFD700] shadow-lg shadow-yellow-500/20">
                <h3 className="font-semibold mb-2">1. Solar Production & Grid Import</h3>
                <div className="text-sm space-y-1">
                  <div>Solar: {(data.solar.power / 1000).toFixed(1)} kW</div>
                  <div>Home: {(data.home.power / 1000).toFixed(1)} kW</div>
                  <div className="text-[#FFD700] mt-2 font-semibold">
                    Grid: {(data.grid.power / 1000).toFixed(1)} kW {data.grid.power < 0 ? '(Export)' : '(Import)'}
                  </div>
                </div>
              </div>

              <div className="text-[#FFD700] text-2xl">↓</div>

              {/* Step 2: Calculate Surplus */}
              <div className="bg-gradient-to-br from-[#3e381a] to-[#302a14] rounded-lg p-4 w-full max-w-md border-2 border-[#FFD700] shadow-lg shadow-yellow-500/20">
                <h3 className="font-semibold mb-2">2. Calculate Surplus Current</h3>
                <div className="text-sm space-y-1">
                  <div>Start Threshold: {(data.settings.solar_start_current / 10).toFixed(1)} A</div>
                  <div>Max Import: {(data.settings.solar_max_import / 10).toFixed(1)} A</div>
                  <div className="text-[#FFD700] mt-2 font-semibold">
                    Surplus: {Math.abs(data.grid.power / 230).toFixed(1)} A
                  </div>
                </div>
              </div>

              <div className="text-[#FFD700] text-2xl">↓</div>

              {/* Step 3: Ramp Logic */}
              <div className="bg-gradient-to-br from-[#3e381a] to-[#302a14] rounded-lg p-4 w-full max-w-md border-2 border-[#FFD700] shadow-lg shadow-yellow-500/20">
                <h3 className="font-semibold mb-2">3. Ramp Logic</h3>
                <div className="text-sm space-y-1">
                  <div>Increase: +0.5A when surplus available</div>
                  <div>Decrease: When import exceeds limit</div>
                  <div>Stop Timer: {data.evse.solar_stop_timer}s / {data.settings.solar_stop_time * 60}s</div>
                </div>
              </div>

              <div className="text-[#FFD700] text-2xl">↓</div>

              {/* Step 4: PWM Output */}
              <div className="bg-gradient-to-br from-[#1a3e30] to-[#143025] rounded-lg p-4 w-full max-w-md border-2 border-green-500 shadow-lg shadow-green-500/20">
                <h3 className="font-semibold mb-2">4. PWM Output to EV</h3>
                <div className="text-sm space-y-1">
                  <div>Duty Cycle: {((data.evse.pwm / 1024) * 100).toFixed(1)}%</div>
                  <div>State: {data.evse.state}</div>
                  <div className="text-green-400 mt-2 font-semibold">
                    Charging at {(data.ev_meter.import_active_power / 1000).toFixed(1)} kW
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual/Normal Mode */}
        {!isSmartMode && !isSolarMode && (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">
              {mode === 'NORMAL' ? 'Manual charging at fixed current' : `Mode: ${mode}`}
            </p>
            <div className="bg-gradient-to-br from-[#1a2f3e] to-[#142530] rounded-lg p-6 inline-block border border-[#2a3544] shadow-lg">
              <div className="text-sm space-y-2">
                <div>Charge Current: <span className="text-[#4A9EFF] font-semibold">{(data.settings.charge_current / 10).toFixed(1)} A</span></div>
                <div>Power: <span className="text-[#4A9EFF] font-semibold">{(data.ev_meter.import_active_power / 1000).toFixed(1)} kW</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* System Status */}
      <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl p-6 border border-[#2a3544] shadow-2xl">
        <h2 className="text-lg font-semibold mb-4">System Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-400">Temperature</div>
            <div className="text-lg font-semibold">{data.evse.temp}°C</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">State</div>
            <div className="text-lg font-semibold">{data.evse.state}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">PWM</div>
            <div className="text-lg font-semibold">{((data.evse.pwm / 1024) * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Error</div>
            <div className="text-lg text-green-400 font-semibold">{data.evse.error}</div>
          </div>
        </div>
      </div>
    </div>
  );
}