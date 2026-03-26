import { useState, useEffect } from 'react';

export function Log() {
  const [logs, setLogs] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [levels, setLevels] = useState({
    A: true,
    E: true,
    W: true,
    I: true,
    D: true,
    V: true,
    Other: true,
  });
  const [pollInterval, setPollInterval] = useState(5);

  useEffect(() => {
    // Simulate fetching logs
    const mockLogs = [
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
      '[D] Solar surplus: 2.5kW',
      '[I] Home consumption: 1.8kW',
      '[D] Grid import: -1.0kW (exporting)',
      '[I] EV charging at 3.7kW',
    ];

    setLogs(mockLogs);

    // Poll for new logs
    const interval = setInterval(() => {
      // In real implementation: fetch(`/api/logs?lines=80`).then(res => res.json()).then(data => setLogs(data.lines))
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => [...prev, `[D] ${timestamp} - Status update`]);
    }, pollInterval * 1000);

    return () => clearInterval(interval);
  }, [pollInterval]);

  const getLevelColor = (line: string) => {
    if (line.includes('[E]')) return 'text-red-400';
    if (line.includes('[W]')) return 'text-yellow-400';
    if (line.includes('[I]')) return 'text-green-400';
    if (line.includes('[D]')) return 'text-blue-400';
    if (line.includes('[V]')) return 'text-purple-400';
    if (line.includes('[A]')) return 'text-orange-400';
    return 'text-gray-400';
  };

  const filteredLogs = logs.filter(log => {
    // Level filter
    const level = log.match(/\[([A-Z])\]/)?.[1];
    if (level && !levels[level as keyof typeof levels] && !levels.Other) {
      return false;
    }

    // Text filter
    if (filter && !log.toLowerCase().includes(filter.toLowerCase())) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-6">Log Viewer</h1>

      {/* Controls */}
      <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl p-6 border border-[#2a3544] shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Level Filters */}
          <div>
            <h3 className="text-sm text-gray-400 font-medium mb-3">Log Levels</h3>
            <div className="flex flex-wrap gap-3">
              {Object.keys(levels).map(level => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={levels[level as keyof typeof levels]}
                    onChange={(e) => setLevels({ ...levels, [level]: e.target.checked })}
                    className="rounded text-[#4A9EFF]"
                  />
                  <span className="text-sm">{level}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Text Filter and Poll Interval */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 font-medium mb-1">Text Filter</label>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                placeholder="Search logs..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 font-medium mb-1">Poll Interval (seconds)</label>
              <input
                type="number"
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                min="1"
                max="60"
                className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Log Display */}
      <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2a3544] bg-[#141d28]">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {filteredLogs.length} lines
            </span>
            <button
              onClick={() => setLogs([])}
              className="text-sm text-[#4A9EFF] hover:text-[#3a8eef] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="p-4 max-h-[600px] overflow-y-auto font-mono text-sm">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No logs to display</div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log, index) => (
                <div key={index} className={getLevelColor(log)}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}