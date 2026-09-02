import React from 'react';
import { STREAMING_PLATFORMS, StreamingPlatform } from '../api/tmdb';
import { Tv, Sparkles, ChevronRight, Film, Flame, Monitor, Video, Clapperboard } from 'lucide-react';

interface PlatformsRowProps {
  onSelectPlatform: (platform: StreamingPlatform) => void;
}

export default function PlatformsRow({ onSelectPlatform }: PlatformsRowProps) {
  const getPlatformIcon = (code: string) => {
    switch (code) {
      case 'NETFLIX':
        return <Film className="w-6 h-6 text-red-600" />;
      case 'DISNEY':
        return <Sparkles className="w-6 h-6 text-blue-400" />;
      case 'MAX':
        return <Flame className="w-6 h-6 text-purple-400" />;
      case 'PRIME':
        return <Video className="w-6 h-6 text-sky-400" />;
      case 'APPLE':
        return <Monitor className="w-6 h-6 text-neutral-200" />;
      case 'HULU':
        return <Clapperboard className="w-6 h-6 text-emerald-400" />;
      case 'PARAMOUNT':
        return <Tv className="w-6 h-6 text-blue-500" />;
      default:
        return <Tv className="w-6 h-6 text-neutral-300" />;
    }
  };

  const getPlatformBrandText = (code: string, name: string) => {
    switch (code) {
      case 'NETFLIX':
        return <span className="text-red-600 font-black tracking-tight text-sm uppercase">NETFLIX</span>;
      case 'DISNEY':
        return <span className="text-blue-400 font-extrabold tracking-wide text-xs">Disney+</span>;
      case 'MAX':
        return <span className="text-purple-400 font-black tracking-wider text-xs uppercase">MAX</span>;
      case 'PRIME':
        return <span className="text-sky-400 font-bold tracking-tight text-xs">Prime Video</span>;
      case 'APPLE':
        return <span className="text-neutral-200 font-semibold tracking-tight text-xs">Apple TV+</span>;
      case 'HULU':
        return <span className="text-emerald-400 font-extrabold tracking-tight text-xs lowercase">hulu</span>;
      case 'PARAMOUNT':
        return <span className="text-blue-500 font-extrabold tracking-tight text-xs">Paramount+</span>;
      default:
        return <span className="text-white font-bold text-xs">{name}</span>;
    }
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto select-none">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tv className="w-5 h-5 text-red-600" />
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Browse Networks & Platforms
          </h2>
          <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-sm">
            Official Catalog
          </span>
        </div>
        <div className="text-xs text-neutral-400 flex items-center gap-1 font-medium">
          <span>Select network</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {STREAMING_PLATFORMS.map((platform) => (
          <button
            key={platform.id}
            onClick={() => onSelectPlatform(platform)}
            className="group relative flex flex-col items-center justify-center p-4 rounded-sm bg-neutral-950/90 border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900 transition-all cursor-pointer shadow-md hover:scale-105"
          >
            {/* Lucide Icon without background color or border */}
            <div className="mb-2 transition-transform group-hover:scale-110">
              {getPlatformIcon(platform.code)}
            </div>
            <div className="text-center">
              {getPlatformBrandText(platform.code, platform.name)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-neutral-500 group-hover:text-neutral-300">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Catalog</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
