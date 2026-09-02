import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { TMDBMedia, CategoryRow } from './types';
import {
  getTrending,
  getPopularMovies,
  getPopularSeries,
  getTopRated,
  getDiscover,
  StreamingPlatform,
} from './api/tmdb';

import Navbar from './components/Navbar';
import FloatingBottomNav from './components/FloatingBottomNav';
import HeroBanner from './components/HeroBanner';
import MediaRow from './components/MediaRow';
import DetailModal from './components/DetailModal';
import NetflixPlayer from './components/NetflixPlayer';
import SearchOverlay from './components/SearchOverlay';
import MyListView from './components/MyListView';
import CustomStreamModal from './components/CustomStreamModal';
import PlatformsRow from './components/PlatformsRow';
import PlatformModal from './components/PlatformModal';
import NewAndHotReels from './components/NewAndHotReels';
import BrowseView from './components/BrowseView';
import InstallAppCard from './components/InstallAppCard';
import { OfflineBanner } from './components/PWAInstallButton';
import { useOnlineStatus } from './hooks/usePWAInstall';

import ContinueWatchingRow, { ContinueWatchingItem } from './components/ContinueWatchingRow';

export default function App() {
  const isOnline = useOnlineStatus();

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'home' | 'browse' | 'popular' | 'mylist'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);

  // Active Interactive Overlays
  const [activeMediaDetails, setActiveMediaDetails] = useState<TMDBMedia | null>(null);
  const [activePlayerMedia, setActivePlayerMedia] = useState<{
    media: TMDBMedia;
    season?: number;
    episode?: number;
    startTime?: number;
  } | null>(null);
  const [showCustomStreamModal, setShowCustomStreamModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<StreamingPlatform | null>(null);

  // Media Catalog Data State
  const [heroMedia, setHeroMedia] = useState<TMDBMedia | null>(null);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Local Storage for "Continue Watching"
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>(() => {
    try {
      const saved = localStorage.getItem('bingewatch_continue_watching');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save "Continue Watching" to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem('bingewatch_continue_watching', JSON.stringify(continueWatching));
    } catch (e) {
      console.error('Failed to save continue watching to localStorage:', e);
    }
  }, [continueWatching]);

  const removeFromContinueWatching = useCallback((id: number) => {
    setContinueWatching((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Local Storage for "My List"
  const [myList, setMyList] = useState<TMDBMedia[]>(() => {
    try {
      const saved = localStorage.getItem('bingewatch_my_list');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save "My List" to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem('bingewatch_my_list', JSON.stringify(myList));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [myList]);

  const isInMyList = useCallback(
    (id: number) => myList.some((item) => item.id === id),
    [myList]
  );

  const toggleMyList = useCallback((media: TMDBMedia) => {
    setMyList((prev) => {
      const exists = prev.some((item) => item.id === media.id);
      if (exists) {
        return prev.filter((item) => item.id !== media.id);
      } else {
        return [media, ...prev];
      }
    });
  }, []);

  const removeFromMyList = useCallback((id: number) => {
    setMyList((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Fetch data based on active tab
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadCatalog() {
      try {
        if (activeTab === 'home') {
          const [trending, popMovies, popSeries, topRated, actionMovies, scifiSeries] =
            await Promise.all([
              getTrending(),
              getPopularMovies(1),
              getPopularSeries(1),
              getTopRated('movie', 1),
              getDiscover('movie', 28, 1), // Action
              getDiscover('tv', 10765, 1), // Sci-Fi & Fantasy TV
            ]);

          if (!isMounted) return;

          // Pick top featured item
          if (trending && trending.length > 0) {
            setHeroMedia(trending[0]);
          }

          setRows([
            { id: 'top10', title: 'Top 10 in Bingewatch Today', items: trending.slice(0, 10), isTop10: true },
            { id: 'trending', title: 'Trending Now', items: trending },
            { id: 'popMovies', title: 'Popular Movies', items: popMovies },
            { id: 'popSeries', title: 'Critically Acclaimed TV Series', items: popSeries },
            { id: 'action', title: 'High-Octane Action & Thrillers', items: actionMovies },
            { id: 'scifi', title: 'Sci-Fi & Cyberpunk Sagas', items: scifiSeries },
            { id: 'topRated', title: 'Award Winners & Masterpieces', items: topRated },
          ]);
        }
      } catch (err) {
        console.error('Failed to load media catalog:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Handlers for playing and real-time progress updates
  const handleUpdateProgress = useCallback(
    (media: TMDBMedia, season = 1, episode = 1, currentTime: number, duration: number) => {
      if (!media || !currentTime || currentTime < 1) return;

      setContinueWatching((prev) => {
        const filtered = prev.filter((item) => item.id !== media.id);
        const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
        const remainingSecs = Math.max(0, duration - currentTime);

        const formatRemaining = (secs: number) => {
          if (!secs || secs <= 0) return '';
          const m = Math.ceil(secs / 60);
          if (m >= 60) {
            const h = Math.floor(m / 60);
            const rm = m % 60;
            return `${h}h ${rm}m left`;
          }
          return `${m}m left`;
        };

        const title = media.title || media.name || media.original_title || 'Untitled';
        const updatedItem: ContinueWatchingItem = {
          id: media.id,
          media,
          season,
          episode,
          episodeTitle: media.media_type === 'tv' ? `S${season}:E${episode} '${title}'` : `${title}`,
          savedTime: Math.floor(currentTime),
          duration: Math.floor(duration),
          progressPercent: Math.min(100, Math.max(1, progressPercent)),
          remainingTime: formatRemaining(remainingSecs),
          backdropPath: media.backdrop_path,
        };

        return [updatedItem, ...filtered];
      });
    },
    []
  );

  const handlePlayMedia = (media: TMDBMedia, season = 1, episode = 1, startTime?: number) => {
    let resolvedStartTime = startTime;
    if (resolvedStartTime === undefined) {
      const existing = continueWatching.find(
        (item) =>
          item.id === media.id &&
          (media.media_type !== 'tv' || (item.season === season && item.episode === episode))
      );
      if (existing && existing.savedTime && existing.savedTime > 5) {
        resolvedStartTime = existing.savedTime;
      }
    }

    setActivePlayerMedia({
      media,
      season,
      episode,
      startTime: resolvedStartTime,
    });
  };

  const handleClosePlayer = () => {
    if (activePlayerMedia?.media) {
      setActiveMediaDetails(activePlayerMedia.media);
    }
    setActivePlayerMedia(null);
  };

  const handleOpenDetails = (media: TMDBMedia) => {
    setActiveMediaDetails(media);
  };

  const handlePlayCustomStream = (customMedia: TMDBMedia, streamUrl: string) => {
    setActivePlayerMedia({ media: customMedia });
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black antialiased font-sans">
      {/* 1. Netflix Navigation Bar (Hidden when on dedicated full screen Reels mode) */}
      {activeTab !== 'popular' && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={(tab: any) => {
            setActiveTab(tab);
            setIsSearchOpen(false);
            setSearchQuery('');
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
          onOpenCustomStream={() => setShowCustomStreamModal(true)}
          myListCount={myList.length}
        />
      )}

      {/* 2. Main Content Routing (Constrained in max-w-7xl 2xl:max-w-screen-2xl mx-auto w-full to prevent stretching on wide screens) */}
      <div className="w-full max-w-7xl 2xl:max-w-screen-2xl mx-auto">
        {isSearchOpen || searchQuery.trim() ? (
          /* Live Search & Default Top 10 Container View */
          <SearchOverlay
            query={searchQuery}
            onClose={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
            }}
            onPlay={handlePlayMedia}
            onOpenDetails={handleOpenDetails}
            isInMyList={isInMyList}
            onToggleMyList={toggleMyList}
            defaultTop10={rows[0]?.items || []}
          />
        ) : activeTab === 'browse' ? (
          /* Browse All Titles with Filters and Infinite Discovery */
          <BrowseView
            onPlay={handlePlayMedia}
            onOpenDetails={handleOpenDetails}
            isInMyList={isInMyList}
            onToggleMyList={toggleMyList}
          />
        ) : activeTab === 'mylist' ? (
          /* My List View */
          <MyListView
            items={myList}
            onPlay={handlePlayMedia}
            onOpenDetails={handleOpenDetails}
            onRemoveFromList={removeFromMyList}
          />
        ) : activeTab === 'popular' ? (
          /* New & Hot Reel Stream with Auto-playing Trailers */
          <NewAndHotReels
            onPlay={handlePlayMedia}
            onOpenDetails={handleOpenDetails}
            isInMyList={isInMyList}
            onToggleMyList={toggleMyList}
            onBack={() => setActiveTab('home')}
          />
        ) : (
          /* Standard Home Catalog View */
          <main className="pb-24">
            {/* Billboard Hero Banner */}
            <HeroBanner
              media={heroMedia}
              mediaList={rows[0]?.items?.length ? rows[0].items.slice(0, 8) : (heroMedia ? [heroMedia] : [])}
              onPlay={handlePlayMedia}
              onOpenDetails={handleOpenDetails}
              isInMyList={isInMyList}
              onToggleMyList={toggleMyList}
            />

            {/* Netflix Media Rows with Proper Gap Spacing (No collision on wide or mobile) */}
            <div className="relative z-20 mt-4 sm:mt-6 lg:mt-8 space-y-4 sm:space-y-6">
              {/* Streaming Networks & Platforms Row (Netflix, Disney+, Prime, HBO Max, Apple TV+, etc.) */}
              <PlatformsRow onSelectPlatform={(platform) => setSelectedPlatform(platform)} />

              {/* Dedicated Continue Watching Landscape Slide Row */}
              {activeTab === 'home' && continueWatching.length > 0 && (
                <ContinueWatchingRow
                  items={continueWatching}
                  onPlay={(med, s, ep) => handlePlayMedia(med, s, ep)}
                  onOpenDetails={handleOpenDetails}
                  onRemoveItem={removeFromContinueWatching}
                />
              )}

              {/* Install App Card with Liquid Gradient Background above Top 10 Slide */}
              {activeTab === 'home' && <InstallAppCard />}

              {/* Catalog Categories */}
              {isLoading ? (
                <div className="py-24 text-center text-sm font-mono text-neutral-500 animate-pulse">
                  Synchronizing Bingewatch HLS Streaming Catalog...
                </div>
              ) : (
                rows.map((row) => (
                  <MediaRow
                    key={row.id}
                    title={row.title}
                    items={row.items}
                    isTop10={row.isTop10}
                    onPlay={handlePlayMedia}
                    onOpenDetails={handleOpenDetails}
                    isInMyList={isInMyList}
                    onToggleMyList={toggleMyList}
                  />
                ))
              )}
            </div>
          </main>
        )}
      </div>

      {/* 3. Detail "More Info" Modal */}
      <AnimatePresence>
        {activeMediaDetails && (
          <DetailModal
            media={activeMediaDetails}
            onClose={() => setActiveMediaDetails(null)}
            onPlay={(med, s, ep) => {
              handlePlayMedia(med, s, ep);
            }}
            isInMyList={isInMyList}
            onToggleMyList={toggleMyList}
            onSelectRelated={(related) => setActiveMediaDetails(related)}
          />
        )}
      </AnimatePresence>

      {/* 4. Fullscreen Netflix HLS Player */}
      <AnimatePresence>
        {activePlayerMedia && (
          <NetflixPlayer
            media={activePlayerMedia.media}
            initialSeason={activePlayerMedia.season || 1}
            initialEpisode={activePlayerMedia.episode || 1}
            initialStartTime={activePlayerMedia.startTime}
            onClose={handleClosePlayer}
            onProgress={handleUpdateProgress}
            onPlayNext={(nextS, nextEp) => {
              const existing = continueWatching.find(
                (item) =>
                  item.id === activePlayerMedia.media.id &&
                  item.season === nextS &&
                  item.episode === nextEp
              );
              setActivePlayerMedia((prev) =>
                prev
                  ? {
                      ...prev,
                      season: nextS,
                      episode: nextEp,
                      startTime: existing?.savedTime || 0,
                    }
                  : null
              );
            }}
          />
        )}
      </AnimatePresence>

      {/* 5. Custom M3U8 Tester Modal */}
      <AnimatePresence>
        {showCustomStreamModal && (
          <CustomStreamModal
            onClose={() => setShowCustomStreamModal(false)}
            onPlayCustom={handlePlayCustomStream}
          />
        )}
      </AnimatePresence>

      {/* 6. Platform Content Browser Modal */}
      <AnimatePresence>
        {selectedPlatform && (
          <PlatformModal
            platform={selectedPlatform}
            onClose={() => setSelectedPlatform(null)}
            onPlay={handlePlayMedia}
            onOpenDetails={handleOpenDetails}
            isInMyList={isInMyList}
            onToggleMyList={toggleMyList}
          />
        )}
      </AnimatePresence>

      {/* 6. Monochrome Netflix Footer */}
      <footer className="border-t border-neutral-900 py-12 px-4 sm:px-6 lg:px-8 2xl:px-12 max-w-7xl 2xl:max-w-screen-2xl mx-auto text-xs text-neutral-600 space-y-6 mb-16 md:mb-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-neutral-400 uppercase tracking-wider text-sm">
              BINGEWATCH
            </span>
            <p className="text-[11px] text-neutral-600">
              Netflix-style adaptive HLS streaming platform powered by TMDB metadata.
            </p>
          </div>
          <div className="text-[10px] font-mono text-neutral-700">
            Streaming Servers: Lisbon • Nebula • Solara
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] text-neutral-500 pt-4 border-t border-neutral-950">
          <div>Audio and Subtitles</div>
          <div>Help Center</div>
          <div>Media Center</div>
          <div>Terms of Use</div>
          <div>Privacy & Cookies</div>
          <div>Corporate Information</div>
          <div>Contact Us</div>
          <div>Speed Test</div>
        </div>

        <div className="text-[10px] text-neutral-700">
          © {new Date().getFullYear()} Bingewatch. Monochromatic UI with vivid color posters & adaptive HLS streaming.
        </div>
      </footer>

      {/* 7. Floating Bottom Navigation Bar for Mobile & Tablet Portrait Screens (Hidden in Reels Mode) */}
      {!activePlayerMedia && activeTab !== 'popular' && (
        <FloatingBottomNav
          activeTab={activeTab}
          setActiveTab={(tab: any) => {
            setActiveTab(tab);
            setSearchQuery('');
          }}
          onOpenCustomStream={() => setShowCustomStreamModal(true)}
          myListCount={myList.length}
        />
      )}

      {/* 8. PWA Offline Indicator */}
      {!isOnline && <OfflineBanner />}
    </div>
  );
}
