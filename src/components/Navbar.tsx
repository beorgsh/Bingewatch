import React, { useState, useEffect } from 'react';
import { Search, Bell, X, Flame, BookmarkCheck, SlidersHorizontal } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchOpen?: boolean;
  setIsSearchOpen?: (open: boolean) => void;
  onOpenCustomStream: () => void;
  myListCount: number;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  isSearchOpen: externalIsSearchOpen,
  setIsSearchOpen: externalSetIsSearchOpen,
  onOpenCustomStream,
  myListCount,
}: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [internalIsSearchOpen, setInternalIsSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const isSearchOpen = externalIsSearchOpen !== undefined ? externalIsSearchOpen : internalIsSearchOpen;
  const setIsSearchOpen = (open: boolean) => {
    if (externalSetIsSearchOpen) {
      externalSetIsSearchOpen(open);
    } else {
      setInternalIsSearchOpen(open);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'browse', label: 'Browse' },
    { id: 'popular', label: 'New & Hot' },
    { id: 'mylist', label: `My List ${myListCount > 0 ? `(${myListCount})` : ''}` },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-black/95 backdrop-blur-md shadow-2xl'
          : 'bg-gradient-to-b from-black via-black/50 to-transparent'
      }`}
    >
      <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Navigation */}
        <div className="flex items-center gap-6 lg:gap-8">
          <button
            onClick={() => {
              setActiveTab('home');
              setSearchQuery('');
            }}
            className="group flex items-center gap-2 cursor-pointer text-left"
          >
            <span className="font-black text-2xl sm:text-3xl tracking-tighter text-white uppercase select-none group-hover:opacity-90 transition-opacity">
              BINGE<span className="text-neutral-400">WATCH</span>
            </span>
            <span className="text-[10px] tracking-widest font-mono text-neutral-400 uppercase hidden sm:inline px-1.5 py-0.5 border border-neutral-700 rounded-xs">
              HLS
            </span>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden xl:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSearchQuery('');
                  }}
                  className={`text-sm tracking-wide font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'text-white font-bold underline decoration-2 underline-offset-8'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Search, PWA Install, Custom HLS Stream, Notifications, Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Live Search Input */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center bg-neutral-900/90 border border-neutral-700 rounded-sm px-3 py-1.5 w-44 sm:w-72 transition-all">
                <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search titles, actors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="bg-transparent text-white placeholder-neutral-500 text-sm focus:outline-hidden ml-2 w-full"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-neutral-400 hover:text-white cursor-pointer ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setIsSearchOpen(false)}
                    className="text-neutral-400 hover:text-white cursor-pointer ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="text-neutral-300 hover:text-white transition-colors cursor-pointer p-1.5"
                title="Search movies & TV shows"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* In-App PWA Install Button */}
          <PWAInstallButton />

          {/* Custom M3U8 Tester Button (Desktop) */}
          <button
            onClick={onOpenCustomStream}
            className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white px-2.5 py-1.5 rounded-sm border border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer"
            title="Play custom HLS m3u8 stream"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-300" />
            <span>Play M3U8</span>
          </button>

          {/* Notifications Popover */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="text-neutral-300 hover:text-white transition-colors cursor-pointer p-1.5 relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-neutral-950 border border-neutral-800 rounded-sm shadow-2xl p-4 text-xs z-50">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-3">
                  <span className="font-semibold text-white tracking-wide uppercase text-[11px]">
                    Notifications
                  </span>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3 items-start pb-2 border-b border-neutral-900">
                    <Flame className="w-4 h-4 text-white shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">New Season Available</p>
                      <p className="text-neutral-400 text-[11px]">Top Trending TV series updated with latest episodes and HLS streams.</p>
                      <span className="text-[10px] text-neutral-600">Today</span>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <BookmarkCheck className="w-4 h-4 text-white shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Multi-Server Engine</p>
                      <p className="text-neutral-400 text-[11px]">Servers Lisbon, Nebula, Solara, Athens, Joy, and Castle ready.</p>
                      <span className="text-[10px] text-neutral-600">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
            <div className="w-8 h-8 rounded-sm bg-neutral-800 flex items-center justify-center font-bold text-xs text-white border border-neutral-700 select-none">
              BW
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
