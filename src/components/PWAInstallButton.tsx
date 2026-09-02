import React, { useState } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running inside installed standalone PWA app, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
        title="Install Bingewatch App"
      >
        <Download className="w-3.5 h-3.5 text-black" />
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">Install</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-semibold transition-all border border-neutral-700 active:scale-95 cursor-pointer"
          title="Install Bingewatch on iOS"
        >
          <Smartphone className="w-3.5 h-3.5 text-white" />
          <span className="hidden sm:inline">Install App</span>
          <span className="sm:hidden">Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-sm rounded-xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-red-500" />
                  <h3 className="text-base font-bold text-white">Install on iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800">
                  <div className="p-1 text-white">
                    <Share className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">1. Tap Share</p>
                    <p className="text-neutral-400">Tap the Share icon at the bottom of your Safari browser.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800">
                  <div className="p-1 text-white">
                    <Download className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">2. Add to Home Screen</p>
                    <p className="text-neutral-400">Scroll down the options list and select <strong>"Add to Home Screen"</strong>.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2 rounded-lg bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineBanner: React.FC = () => {
  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-neutral-900/90 border border-neutral-700 px-3.5 py-1.5 text-xs font-semibold text-amber-400 shadow-2xl backdrop-blur-md">
      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
      <span>Offline Mode — Cached trailers & catalog available</span>
    </div>
  );
};
