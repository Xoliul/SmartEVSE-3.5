import { useState } from 'react';

interface InfoDialogProps {
  title: string;
  description: string;
}

export function InfoDialog({ title, description }: InfoDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Info Icon Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-[#4A9EFF]/20 transition-colors group"
        aria-label="More information"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-[#4A9EFF] group-hover:text-[#6BB4FF] transition-colors">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 7 L8 12 M8 4 L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Dialog Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Dialog Content */}
          <div
            className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6 L18 18 M6 18 L18 6"/>
              </svg>
            </button>

            {/* Title */}
            <h3 className="text-xl font-semibold text-[#4A9EFF] mb-4 pr-8">{title}</h3>

            {/* Description */}
            <div className="text-gray-300 text-sm leading-relaxed space-y-2">
              {description}
            </div>

            {/* Close Button (bottom) */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-gradient-to-r from-[#4A9EFF] to-[#3A8EEF] text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium text-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}