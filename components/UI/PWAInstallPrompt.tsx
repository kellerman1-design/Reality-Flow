
import React, { useState, useEffect } from 'react';
import { Download, X, Sparkles, Smartphone } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Immediately show the prompt to satisfy "upon entry" request
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 md:left-auto md:right-8 md:top-auto md:bottom-8 md:translate-x-0 z-[100] w-[calc(100%-2rem)] md:w-[400px] animate-in slide-in-from-top-10 md:slide-in-from-bottom-10 fade-in duration-700">
      <div className="bg-slate-900/90 backdrop-blur-3xl border-2 border-indigo-500/50 rounded-3xl p-6 shadow-[0_30px_60px_rgba(79,70,229,0.4)] flex items-center gap-5 relative overflow-hidden group">
        
        {/* Pulsing Highlight */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-1000 animate-pulse"></div>

        {/* Logo Container - Transparent/Glass */}
        <div className="shrink-0 bg-slate-800/50 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-xl w-16 h-16 flex items-center justify-center relative overflow-hidden">
             {/* Inline SVG Logo - Ensures it always loads */}
             <svg viewBox="0 0 100 100" className="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="pwa_logo_grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#6366F1" />
                        <stop offset="1" stopColor="#A855F7" />
                    </linearGradient>
                </defs>
                <rect width="100" height="100" rx="24" fill="url(#pwa_logo_grad)" />
                <path d="M28 66L42 42L56 58L72 34" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="72" cy="34" r="5" fill="white" />
            </svg>
        </div>

        {/* Content */}
        <div className="flex-1 text-right">
            <div className="flex items-center justify-end gap-1.5 mb-1">
                <h4 className="font-black text-white text-base tracking-tight">REALITY FLOW</h4>
                <Sparkles size={14} className="text-indigo-400" />
            </div>
            <p className="text-xs text-slate-300 leading-normal font-medium">התקן את האפליקציה למסך הבית לגישה מהירה וביצועים מקסימליים</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
            <button 
                onClick={handleInstallClick}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-2xl transition-all shadow-lg shadow-indigo-600/40 hover:scale-110 active:scale-95 flex items-center justify-center"
                title="התקן עכשיו"
            >
                <Download size={24} />
            </button>
            <button 
                onClick={() => setIsVisible(false)}
                className="text-slate-500 hover:text-rose-400 p-1 self-center transition-colors"
                title="סגור"
            >
                <X size={18} />
            </button>
        </div>
      </div>
    </div>
  );
};
