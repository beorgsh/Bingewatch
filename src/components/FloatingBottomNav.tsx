import React from 'react';
import { Home, LayoutGrid, Flame, BookmarkCheck, SlidersHorizontal } from 'lucide-react';

interface FloatingBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCustomStream: () => void;
  myListCount: number;
}

export default function FloatingBottomNav({
  activeTab,
  setActiveTab,
  onOpenCustomStream,
  myListCount,
}: FloatingBottomNavProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'browse', label: 'Browse', icon: LayoutGrid },
    { id: 'popular', label: 'New & Hot', icon: Flame },
    { id: 'mylist', label: 'My List', icon: BookmarkCheck, badge: myListCount },
  ];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 block xl:hidden w-[94%] max-w-lg">
      <div className="bg-neutral-950/90 backdrop-blur-xl border border-neutral-800 shadow-2xl rounded-full px-4 py-2.5 flex items-center justify-around gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                isActive ? 'text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-white text-black font-extrabold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={onOpenCustomStream}
          className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-neutral-400 hover:text-white cursor-pointer transition-colors"
          title="Play M3U8 Stream"
        >
          <SlidersHorizontal className="w-5 h-5 text-neutral-400" />
          <span className="text-[10px] tracking-tight">M3U8</span>
        </button>
      </div>
    </div>
  );
}
