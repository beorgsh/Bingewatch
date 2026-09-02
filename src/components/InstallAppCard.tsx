import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Zap,
  Film,
  Wifi,
  CheckCircle2,
  Share,
  PlusSquare,
  X,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export default function InstallAppCard() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // If already running in standalone PWA mode or user dismissed this card session
  if (isDismissed || isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
    } else if (isInstallable) {
      await install();
    } else {
      setShowIOSGuide(true);
    }
  };

  return (
    <div className="relative mx-4 sm:mx-6 lg:mx-10 my-6 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
      {/* Liquid Gradient Animated Background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-indigo-900/90 via-purple-900/80 to-rose-900/90 animate-liquid-flow">
        {/* Floating Liquid Glow Blobs */}
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-cyan-500/30 rounded-full blur-3xl animate-liquid-blob-1 pointer-events-none" />
        <div className="absolute -bottom-20 right-10 w-72 h-72 bg-pink-500/25 rounded-full blur-3xl animate-liquid-blob-2 pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-violet-600/30 rounded-full blur-2xl animate-liquid-blob-1 pointer-events-none" />
      </div>

      {/* Dark Translucent Shimmer Glass Layer */}
      <div className="relative z-10 p-5 sm:p-7 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 backdrop-blur-md bg-black/40">
        {/* Left Info Column */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-white bg-white/20 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Native App Experience</span>
            </span>
            <span className="text-xs text-neutral-300 font-mono hidden sm:inline">
              Ultra-light • Instant Load
            </span>
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md">
              Install Bingewatch on Your Device
            </h3>
            <p className="text-xs sm:text-sm text-neutral-200 mt-1 max-w-2xl leading-relaxed">
              Experience zero-buffering 4K HLS playback, full landscape cinema mode, offline trailer caching, and one-tap launch directly from your home screen.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-neutral-200">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Instant 4K Playback</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-200">
              <Film className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Landscape Theater</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-200 col-span-2 sm:col-span-1">
              <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Offline Ready</span>
            </div>
          </div>
        </div>

        {/* Right Action Column */}
        <div className="flex flex-row md:flex-col items-center sm:items-end gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0">
          <button
            onClick={handleInstallClick}
            className="flex-1 md:flex-initial w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white text-black font-extrabold text-sm sm:text-base hover:bg-neutral-100 active:scale-95 transition-all shadow-2xl cursor-pointer"
          >
            <Download className="w-5 h-5 text-black" />
            <span>Install App</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-2.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Dismiss Card"
          >
            <X className="w-5 h-5 text-neutral-300" />
          </button>
        </div>
      </div>

      {/* iOS Safari Guided Install Modal / Tooltip */}
      {showIOSGuide && (
        <div className="relative z-20 px-5 py-4 bg-black/80 border-t border-white/10 backdrop-blur-md text-xs sm:text-sm text-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-1">To install on iOS Safari:</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
                <span>1. Tap the Share button</span>
                <Share className="w-3.5 h-3.5 text-sky-400 inline" />
                <span>2. Scroll down & select &quot;Add to Home Screen&quot;</span>
                <PlusSquare className="w-3.5 h-3.5 text-emerald-400 inline" />
                <span>3. Tap &quot;Add&quot;</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowIOSGuide(false)}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold self-end sm:self-auto cursor-pointer"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
