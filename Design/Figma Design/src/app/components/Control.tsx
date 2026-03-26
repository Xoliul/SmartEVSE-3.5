import { useState } from 'react';
import controlImage from 'figma:asset/d47545c219c0ad6579f9a389f18df527f41d2ecf.png';

interface ControlProps {
  data: any;
}

export function Control({ data }: ControlProps) {
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In real implementation: verify PIN against backend
    if (pin === '0000') {
      setIsUnlocked(true);
    } else {
      setShowErrorDialog(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Dialog */}
      {showErrorDialog && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowErrorDialog(false)}
        >
          {/* Dialog Content */}
          <div
            className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowErrorDialog(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6 L18 18 M6 18 L18 6"/>
              </svg>
            </button>

            {/* Title with Error Icon */}
            <div className="flex items-center gap-3 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2"/>
                <path d="M12 7v6M12 16v.5" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <h3 className="text-xl font-semibold text-red-400 pr-8">Incorrect PIN</h3>
            </div>

            {/* Description */}
            <div className="text-gray-300 text-sm leading-relaxed space-y-2">
              <p>The PIN you entered is incorrect. Please try again.</p>
            </div>

            {/* Close Button (bottom) */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowErrorDialog(false)}
                className="px-4 py-2 bg-gradient-to-r from-[#4A9EFF] to-[#3A8EEF] text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side - Image */}
        <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl overflow-hidden flex items-center justify-center p-8">
          <img src={controlImage} alt="SmartEVSE Control Unit" className="w-full max-w-md object-contain" />
        </div>

        {/* Right Side - PIN Entry */}
        <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl overflow-hidden p-8">
          {!isUnlocked ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              {/* Warning Message */}
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-6 py-4 w-full">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2"/>
                  <path d="M12 7v6M12 16v.5" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <div className="text-left">
                  <p className="text-red-400 font-semibold">Access Restricted</p>
                  <p className="text-red-300/70 text-sm">Enter PIN to unlock control panel</p>
                </div>
              </div>

              {/* PIN Entry Form */}
              <form onSubmit={handlePinSubmit} className="w-full space-y-6">
                <div>
                  <label htmlFor="pin" className="block text-sm text-gray-400 mb-2">PIN Code</label>
                  <input
                    id="pin"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter 4-digit PIN"
                    maxLength={4}
                    className="w-full px-4 py-3 bg-[#0f1924] border border-[#2a3544] rounded-xl text-white placeholder-gray-500 focus:border-[#4A9EFF] focus:outline-none focus:ring-2 focus:ring-[#4A9EFF]/20 transition-all text-center text-2xl tracking-widest"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-[#4A9EFF] to-[#3A8EEF] text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                >
                  Unlock
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-6 py-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#10B981" strokeWidth="2"/>
                  <path d="M8 12l3 3 5-5" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-left">
                  <p className="text-green-400 font-semibold">Access Granted</p>
                  <p className="text-green-300/70 text-sm">Control panel unlocked</p>
                </div>
              </div>

              {/* Control Options */}
              <div className="space-y-4">
                <h3 className="text-lg text-white font-semibold">Control Actions</h3>
                
                <button className="w-full py-3 bg-gradient-to-br from-[#1e2836] to-[#16202b] border border-[#2a3544] rounded-xl text-white hover:border-[#4A9EFF] transition-all text-left px-4">
                  <div className="flex items-center justify-between">
                    <span>Reset EVSE</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12a8 8 0 0 1 14.5-4.5M20 12a8 8 0 0 1-14.5 4.5M4 8v4h4M20 16v-4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>

                <button className="w-full py-3 bg-gradient-to-br from-[#1e2836] to-[#16202b] border border-[#2a3544] rounded-xl text-white hover:border-[#4A9EFF] transition-all text-left px-4">
                  <div className="flex items-center justify-between">
                    <span>Reboot System</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>

                <button className="w-full py-3 bg-gradient-to-br from-[#1e2836] to-[#16202b] border border-[#2a3544] rounded-xl text-white hover:border-[#4A9EFF] transition-all text-left px-4">
                  <div className="flex items-center justify-between">
                    <span>Factory Reset</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>

                <button 
                  onClick={() => setIsUnlocked(false)}
                  className="w-full py-3 bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-500/30 rounded-xl text-red-400 hover:border-red-500 transition-all text-left px-4"
                >
                  <div className="flex items-center justify-between">
                    <span>Lock Control Panel</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}