import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { Control } from './components/Control';
import { Log } from './components/Log';
import { Flow } from './components/Flow';

type Page = 'home' | 'settings' | 'control' | 'log' | 'flow';

// Mock data matching the API structure
const mockData = {
  version: '3.0.12',
  serialnr: 'SmartEVSE-12345',
  mode: 'SMART',
  mode_id: 3,
  car_connected: true,
  evse: {
    temp: 42,
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
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [data, setData] = useState(mockData);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Handle hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || 'home';
      setCurrentPage(hash as Page);
      setMobileMenuOpen(false);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Simulate polling /settings every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // In real implementation: fetch('/settings').then(res => res.json()).then(setData)
      // For now, just update with slight variations
      setData(prev => ({
        ...prev,
        evse: {
          ...prev.evse,
          temp: 42 + Math.floor(Math.random() * 3),
        },
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'settings', label: 'Settings' },
    { id: 'control', label: 'Control' },
  ];

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#0f1924] text-white' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <header className={`${isDarkMode ? 'bg-gradient-to-b from-[#1a2332] to-[#141d28] border-b border-[#2a3544]' : 'bg-gradient-to-b from-gray-100 to-gray-50 border-b border-gray-200'} shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              
              <span className={`text-xl font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>SmartEVSE</span>
            </div>

            {/* Desktop Navigation and Theme Toggle */}
            <div className="hidden md:flex items-center gap-6">
              <nav className="flex gap-6">
                {navItems.map(item => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`px-4 py-2 rounded-lg transition-all relative ${
                      currentPage === item.id
                        ? 'text-[#4A9EFF]'
                        : `${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
                    }`}
                  >
                    {item.label}
                    {currentPage === item.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A9EFF] rounded-t"></span>
                    )}
                  </a>
                ))}
              </nav>
              
              {/* Theme Toggle Button - Hidden */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`hidden p-2 rounded-lg transition-all ${isDarkMode ? 'bg-[#0f1924]/50 hover:bg-[#0f1924]' : 'bg-gray-200 hover:bg-gray-300'}`}
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? (
                  // Sun icon for light mode
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="4" fill="#FDB813"/>
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#FDB813" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  // Moon icon for dark mode
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#4A9EFF"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Mobile Menu Button and Theme Toggle */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`hidden p-2 rounded-lg transition-all ${isDarkMode ? 'bg-[#0f1924]/50 hover:bg-[#0f1924]' : 'bg-gray-200 hover:bg-gray-300'}`}
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="4" fill="#FDB813"/>
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#FDB813" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#4A9EFF"/>
                  </svg>
                )}
              </button>
              <button
                className={`p-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {mobileMenuOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path d="M3 12h18M3 6h18M3 18h18" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className={`md:hidden py-4 border-t ${isDarkMode ? 'border-[#2a3544]' : 'border-gray-200'}`}>
              {navItems.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`block px-4 py-3 rounded transition-colors ${
                    currentPage === item.id
                      ? 'text-[#4A9EFF]'
                      : `${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {currentPage === 'home' && <Dashboard data={data} isDarkMode={isDarkMode} />}
        {currentPage === 'settings' && <Settings data={data} isDarkMode={isDarkMode} />}
        {currentPage === 'control' && <Control data={data} />}
        {currentPage === 'log' && <Log />}
        {currentPage === 'flow' && <Flow data={data} />}
      </main>
    </div>
  );
}