import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Plus,
  Check,
  Info,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Flame,
  Calendar,
  ThumbsUp,
  Share2,
  ArrowLeft,
  Shuffle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { TMDBMedia, VideoResult } from '../types';
import {
  getTrending,
  getPopularMovies,
  getPopularSeries,
  getTopRated,
  getMediaVideos,
  getRandomMovies,
  getBackdropUrl,
  getPosterUrl,
} from '../api/tmdb';

interface NewAndHotReelsProps {
  onPlay: (media: TMDBMedia) => void;
  onOpenDetails: (media: TMDBMedia) => void;
  isInMyList: (id: number) => boolean;
  onToggleMyList: (media: TMDBMedia) => void;
  onBack?: () => void;
}

type ReelCategory = 'hot' | 'coming' | 'top' | 'reels';

export default function NewAndHotReels({
  onPlay,
  onOpenDetails,
  isInMyList,
  onToggleMyList,
  onBack,
}: NewAndHotReelsProps) {
  const [activeCategory, setActiveCategory] = useState<ReelCategory>('hot');
  const [items, setItems] = useState<TMDBMedia[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Audio State: managed via YouTube JS API postMessage to avoid restarting iframe
  const [isMuted, setIsMuted] = useState(true);
  const [muteToastVisible, setMuteToastVisible] = useState(false);
  const muteToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [trailersMap, setTrailersMap] = useState<Record<number, string>>({});
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>({});
  const [expandedOverviewIndex, setExpandedOverviewIndex] = useState<number | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const isScrollingRef = useRef(false);

  // Touch gesture swipe tracking for closing reel and returning home
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);

  // Function to send YouTube API commands to active trailer iframe
  const sendIframeCommand = useCallback((command: string, args: any[] = []) => {
    const activeIframe = document.querySelector(
      `#reel-item-${activeIndex} iframe`
    ) as HTMLIFrameElement | null;

    if (activeIframe && activeIframe.contentWindow) {
      activeIframe.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: command,
          args: args,
        }),
        '*'
      );
    }
  }, [activeIndex]);

  // Seamless mute toggle handler: does NOT modify iframe src, preventing video restart
  const toggleMute = useCallback(() => {
    setIsMuted((prevMuted) => {
      const newMuted = !prevMuted;
      
      if (newMuted) {
        sendIframeCommand('mute');
      } else {
        sendIframeCommand('unMute');
        sendIframeCommand('setVolume', [100]);
      }

      setMuteToastVisible(true);
      if (muteToastTimeoutRef.current) {
        clearTimeout(muteToastTimeoutRef.current);
      }
      muteToastTimeoutRef.current = setTimeout(() => {
        setMuteToastVisible(false);
      }, 1000);

      return newMuted;
    });
  }, [sendIframeCommand]);

  // If user unmuted, automatically unmute newly active reel trailer once loaded
  useEffect(() => {
    if (!isMuted) {
      const timer = setTimeout(() => {
        sendIframeCommand('unMute');
        sendIframeCommand('setVolume', [100]);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [activeIndex, isMuted, sendIframeCommand]);

  // 1. History popstate interceptor: Intercept device back button / back swipe
  useEffect(() => {
    window.history.pushState({ reelOpen: true }, '');

    const handlePopState = () => {
      if (onBack) {
        onBack();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onBack]);

  // 2. Fetch catalog for selected category
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setActiveIndex(0);

    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }

    async function loadCategoryItems() {
      try {
        let results: TMDBMedia[] = [];
        if (activeCategory === 'hot') {
          results = await getTrending();
        } else if (activeCategory === 'coming') {
          const [movies, tv] = await Promise.all([getPopularMovies(1), getPopularSeries(1)]);
          const combined: TMDBMedia[] = [];
          const maxLen = Math.max(movies.length, tv.length);
          for (let i = 0; i < maxLen; i++) {
            if (movies[i]) combined.push(movies[i]);
            if (tv[i]) combined.push(tv[i]);
          }
          results = combined;
        } else if (activeCategory === 'top') {
          const top = await getTopRated('movie', 1);
          results = top.slice(0, 10);
        } else if (activeCategory === 'reels') {
          results = await getRandomMovies();
        }

        if (isMounted) {
          setItems(results.filter((item) => item.backdrop_path || item.poster_path));
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load reels data:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    loadCategoryItems();

    return () => {
      isMounted = false;
    };
  }, [activeCategory]);

  // 3. Fetch trailers for active and neighboring items
  useEffect(() => {
    if (items.length === 0) return;

    const itemsToFetch = [
      items[activeIndex],
      items[activeIndex + 1],
      items[activeIndex + 2],
      items[activeIndex - 1],
    ].filter(Boolean);

    itemsToFetch.forEach((item) => {
      if (item && item.id && trailersMap[item.id] === undefined) {
        const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        getMediaVideos(type, item.id)
          .then((videos: VideoResult[]) => {
            const trailer =
              videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
              videos.find((v) => v.site === 'YouTube' && v.type === 'Teaser') ||
              videos.find((v) => v.site === 'YouTube');
            setTrailersMap((prev) => ({
              ...prev,
              [item.id]: trailer?.key || '',
            }));
          })
          .catch(() => {
            setTrailersMap((prev) => ({ ...prev, [item.id]: '' }));
          });
      }
    });
  }, [activeIndex, items, trailersMap]);

  // 4. Scroll to target index helper
  const scrollToIndex = useCallback(
    (index: number) => {
      if (!containerRef.current || items.length === 0) return;
      const targetIndex = Math.max(0, Math.min(index, items.length - 1));
      const targetEl = document.getElementById(`reel-item-${targetIndex}`);
      if (targetEl) {
        isScrollingRef.current = true;
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveIndex(targetIndex);
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 600);
      }
    },
    [items.length]
  );

  const handleNext = useCallback(() => {
    if (activeIndex < items.length - 1) {
      scrollToIndex(activeIndex + 1);
    }
  }, [activeIndex, items.length, scrollToIndex]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      scrollToIndex(activeIndex - 1);
    }
  }, [activeIndex, scrollToIndex]);

  // 5. Track scroll position to update active index dynamically
  const handleScroll = useCallback(() => {
    if (isScrollingRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    if (itemHeight > 0) {
      const newIndex = Math.round(scrollTop / itemHeight);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < items.length) {
        setActiveIndex(newIndex);
      }
    }
  }, [activeIndex, items.length]);

  // 6. YouTube IFrame postMessage Listener: Auto-advance to next video when trailer finishes
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (!data) return;

        // Player State 0: ENDED
        if (
          (data.event === 'onStateChange' && data.info === 0) ||
          (data.event === 'infoDelivery' && data.info && data.info.playerState === 0) ||
          data.info === 0
        ) {
          handleNext();
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [handleNext]);

  // 7. Keyboard navigation (Up/Down/Left/Escape, J/K, M for mute toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
        if (onBack) onBack();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onBack, toggleMute]);

  // 8. Horizontal Swipe gesture handlers to close Reels screen (Swipe Right to dismiss) + Tap for Mute/Unmute
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = currentY - touchStartRef.current.y;

    // Only initiate horizontal swipe dismiss if movement is predominantly horizontal
    if (deltaX > 20 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      setSwipeOffsetX(Math.max(0, deltaX));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touchEnd = e.changedTouches[0];
    const deltaX = touchEnd.clientX - touchStartRef.current.x;
    const deltaY = touchEnd.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Detect if this was a stationary tap (< 12px move and < 300ms)
    const isTap = Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12 && deltaTime < 300;

    // Trigger close if swiped right more than 80px or quick flick to the right
    const isQuickSwipeRight = deltaX > 60 && deltaTime < 300 && Math.abs(deltaX) > Math.abs(deltaY);
    const isLongSwipeRight = deltaX > 110;

    if ((isQuickSwipeRight || isLongSwipeRight) && onBack) {
      onBack();
    } else if (isTap) {
      const target = e.target as HTMLElement;
      const isInteractive = target.closest('button') || target.closest('a') || target.closest('input');
      if (!isInteractive) {
        toggleMute();
      }
    }
    setSwipeOffsetX(0);
    touchStartRef.current = null;
  };

  // Toggle Like state for reel
  const toggleLike = (id: number) => {
    setLikedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Share reel URL toast
  const handleShare = (item: TMDBMedia) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/?media=${item.id}`);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-center px-4">
        <Flame className="w-12 h-12 text-red-500 animate-pulse mb-3" />
        <h2 className="text-lg font-bold text-white tracking-wide">Loading Netflix Reels...</h2>
        <p className="text-xs font-mono text-neutral-400 mt-1">Fetching live high-speed trailer stream</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-neutral-400 px-4">
        <p>No video reels available at this moment.</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-neutral-800 text-white rounded-md text-sm hover:bg-neutral-700 cursor-pointer"
          >
            Back to Catalog
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 bg-black select-none overflow-hidden flex justify-center transition-transform duration-150 ease-out"
      style={{
        transform: swipeOffsetX > 0 ? `translateX(${swipeOffsetX}px)` : 'none',
      }}
    >
      {/* 1. Fixed Top Header Overlay with Edge Vanishing Fade Effect */}
      <div className="absolute top-0 left-0 right-0 z-40 px-3 sm:px-6 pt-3 sm:pt-4 pb-12 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none flex items-center justify-between">
        <div className="flex items-center gap-2 pointer-events-auto flex-1 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Back to Home (Swipe right or Esc)"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Slidable Category Switcher with Vanishing Gradient Edge Fade Masks */}
          <div className="relative flex-1 min-w-0 max-w-[72vw] sm:max-w-md">
            {/* Left Fade Edge */}
            <div className="absolute left-0 top-0 bottom-0 w-5 bg-gradient-to-r from-black/90 to-transparent pointer-events-none z-10" />

            {/* Scrollable Container with CSS Mask for Smooth Edge Vanishing */}
            <div
              ref={categoryScrollRef}
              className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-1 px-3 snap-x touch-pan-x"
              style={{
                maskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
              }}
            >
              <button
                onClick={() => setActiveCategory('hot')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap snap-start shrink-0 ${
                  activeCategory === 'hot'
                    ? 'bg-white text-black font-bold shadow-lg scale-105'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-red-500" />
                <span>Hot</span>
              </button>

              <button
                onClick={() => setActiveCategory('coming')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap snap-start shrink-0 ${
                  activeCategory === 'coming'
                    ? 'bg-white text-black font-bold shadow-lg scale-105'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                <span>Coming</span>
              </button>

              <button
                onClick={() => setActiveCategory('top')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap snap-start shrink-0 ${
                  activeCategory === 'top'
                    ? 'bg-white text-black font-bold shadow-lg scale-105'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Top</span>
              </button>

              <button
                onClick={() => {
                  if (activeCategory === 'reels') {
                    // If already in reels, refresh with a new random batch
                    setIsLoading(true);
                    getRandomMovies().then((results) => {
                      setItems(results.filter((item) => item.backdrop_path || item.poster_path));
                      setActiveIndex(0);
                      if (containerRef.current) containerRef.current.scrollTop = 0;
                      setIsLoading(false);
                    });
                  } else {
                    setActiveCategory('reels');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap snap-start shrink-0 ${
                  activeCategory === 'reels'
                    ? 'bg-white text-black font-bold shadow-lg scale-105'
                    : 'text-neutral-300 hover:text-white'
                }`}
                title="Random movies across TMDB"
              >
                <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Reels</span>
              </button>
            </div>

            {/* Right Fade Edge */}
            <div className="absolute right-0 top-0 bottom-0 w-5 bg-gradient-to-l from-black/90 to-transparent pointer-events-none z-10" />
          </div>
        </div>

        {/* Quick Mute / Unmute Button in Top Right */}
        <div className="pointer-events-auto flex items-center shrink-0 ml-2">
          <button
            onClick={toggleMute}
            className="p-2.5 rounded-full text-white hover:text-neutral-200 transition-all cursor-pointer shadow-lg active:scale-95"
            title={isMuted ? 'Unmute video (Tap screen or press M)' : 'Mute video (Tap screen or press M)'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>

      {/* 2. Visual Audio Toggle Toast Feedback */}
      {muteToastVisible && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-black/80 backdrop-blur-md text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {isMuted ? (
              <VolumeX className="w-10 h-10 text-white" />
            ) : (
              <Volume2 className="w-10 h-10 text-white" />
            )}
            <span className="text-xs font-bold tracking-wider uppercase text-neutral-200">
              {isMuted ? 'Muted' : 'Sound On'}
            </span>
          </div>
        </div>
      )}

      {/* 3. Full-Screen Vertical Scroll Snapping Reel Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onClick={(e) => {
          // On desktop clicks on background/video canvas
          const target = e.target as HTMLElement;
          const isInteractive = target.closest('button') || target.closest('a') || target.closest('input');
          if (!isInteractive) {
            toggleMute();
          }
        }}
        className="w-full max-w-lg md:max-w-xl lg:max-w-2xl h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-none relative bg-black cursor-pointer"
        style={{ scrollBehavior: 'smooth' }}
      >
        {items.map((item, index) => {
          const title = item.title || item.name || item.original_title || 'Untitled';
          const releaseYear = (item.release_date || item.first_air_date || '').slice(0, 4) || '2024';
          const backdropUrl = getBackdropUrl(item.backdrop_path, 'original');
          const posterUrl = getPosterUrl(item.poster_path, 'w500');
          const isSaved = isInMyList(item.id);
          const isLiked = likedMap[item.id] || false;
          const matchRate = Math.min(99, Math.max(85, Math.round((item.vote_average || 7.5) * 10)));
          const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
          const isCurrentActive = index === activeIndex;
          const isNearby = Math.abs(index - activeIndex) <= 1;
          const trailerKey = trailersMap[item.id];
          const isOverviewExpanded = expandedOverviewIndex === index;

          return (
            <div
              key={item.id}
              id={`reel-item-${index}`}
              className="relative w-full h-screen snap-start snap-always shrink-0 overflow-hidden flex flex-col justify-end bg-neutral-950"
            >
              {/* Background Video Trailer / Backdrop Poster */}
              <div className="absolute inset-0 z-0 bg-neutral-950 overflow-hidden">
                {isCurrentActive && trailerKey ? (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                    <iframe
                      src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(
                        typeof window !== 'undefined' ? window.location.origin : ''
                      )}`}
                      title={`${title} Trailer`}
                      allow="autoplay; encrypted-media"
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180vw] h-[105vw] min-w-[200vh] min-h-[115vh] object-cover pointer-events-none scale-110"
                    />
                  </div>
                ) : (
                  (isNearby || isCurrentActive) && (
                    <img
                      src={backdropUrl || posterUrl}
                      alt={title}
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                  )
                )}

                {/* Dark Vignette Gradients for Crisp Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none z-10"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-transparent pointer-events-none z-10"></div>
              </div>

              {/* Reel Right Action Sidebar (Netflix Fast Laughs style) */}
              <div className="absolute right-3 sm:right-5 bottom-8 sm:bottom-12 z-30 flex flex-col items-center gap-5 pointer-events-auto">
                {/* 1. LOL / Thumbs Up Reaction */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(item.id);
                  }}
                  className="flex flex-col items-center gap-1 cursor-pointer transition-transform active:scale-85 group"
                  title="Like Title"
                >
                  <div className="p-3 rounded-full text-white group-hover:text-amber-400 transition-colors shadow-xl">
                    <ThumbsUp className={`w-5 h-5 ${isLiked ? 'text-amber-400 fill-current' : 'text-white'}`} />
                  </div>
                  <span className="text-[10px] font-semibold text-white drop-shadow-md">
                    {isLiked ? 'Liked' : 'Like'}
                  </span>
                </button>

                {/* 2. Add to My List */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMyList(item);
                  }}
                  className="flex flex-col items-center gap-1 cursor-pointer transition-transform active:scale-85 group"
                  title={isSaved ? 'In My List' : 'Add to My List'}
                >
                  <div className="p-3 rounded-full text-white transition-colors shadow-xl">
                    {isSaved ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <Plus className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-white drop-shadow-md">
                    {isSaved ? 'Saved' : 'My List'}
                  </span>
                </button>

                {/* 3. Share URL */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(item);
                  }}
                  className="flex flex-col items-center gap-1 cursor-pointer transition-transform active:scale-85 group"
                  title="Share Title"
                >
                  <div className="p-3 rounded-full text-white group-hover:text-sky-400 transition-colors shadow-xl">
                    <Share2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold text-white drop-shadow-md">Share</span>
                </button>

                {/* 4. More Details Modal */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(item);
                  }}
                  className="flex flex-col items-center gap-1 cursor-pointer transition-transform active:scale-85 group"
                  title="More Details"
                >
                  <div className="p-3 rounded-full text-white group-hover:text-neutral-200 transition-colors shadow-xl">
                    <Info className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold text-white drop-shadow-md">Info</span>
                </button>

                {/* 5. Direct Play Action */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(item);
                  }}
                  className="flex flex-col items-center gap-1 cursor-pointer transition-transform active:scale-85 group"
                  title="Watch Full Stream"
                >
                  <div className="p-3 rounded-full bg-white text-black hover:bg-neutral-200 transition-colors shadow-2xl">
                    <Play className="w-5 h-5 text-black fill-current" />
                  </div>
                  <span className="text-[10px] font-bold text-white drop-shadow-md">Play</span>
                </button>
              </div>

              {/* Reel Bottom Details & Metadata (Left Column) */}
              <div className="relative z-20 p-4 sm:p-6 pr-20 sm:pr-24 pb-8 sm:pb-12 space-y-2 pointer-events-auto">
                {/* Meta Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-neutral-300">
                  <span className="flex items-center gap-1 text-white bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full text-[11px] font-bold">
                    <Flame className="w-3.5 h-3.5 text-red-500 fill-current" />
                    <span>
                      {activeCategory === 'top'
                        ? `TOP ${index + 1}`
                        : activeCategory === 'coming'
                        ? 'COMING SOON'
                        : 'HOT REEL'}
                    </span>
                  </span>
                  <span className="text-white font-bold">{matchRate}% Match</span>
                  <span className="text-neutral-400">{releaseYear}</span>
                  <span className="px-1.5 py-0.2 bg-black/50 text-[10px] text-neutral-300 rounded-sm">
                    {mediaType === 'tv' ? 'TV-MA' : 'PG-13'}
                  </span>
                  <span className="px-1.5 py-0.2 bg-black/50 text-[10px] text-neutral-300 rounded-sm font-mono">
                    4K HDR
                  </span>
                </div>

                {/* Reel Title */}
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-xl">
                  {title}
                </h2>

                {/* Synopsis with expandable full view */}
                <div className="text-xs sm:text-sm text-neutral-200 leading-relaxed drop-shadow-md max-w-md">
                  <p className={isOverviewExpanded ? '' : 'line-clamp-2 sm:line-clamp-3'}>
                    {item.overview ||
                      'Explore this acclaimed title now streaming with adaptive HLS video and audio on Bingewatch.'}
                  </p>
                  {item.overview && item.overview.length > 90 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedOverviewIndex(isOverviewExpanded ? null : index);
                      }}
                      className="text-neutral-400 hover:text-white text-xs font-semibold mt-1 cursor-pointer underline underline-offset-2"
                    >
                      {isOverviewExpanded ? 'Show less' : 'More info'}
                    </button>
                  )}
                </div>

                {/* Direct Watch Stream Call to Action */}
                <div className="pt-2 flex items-center gap-2.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(item);
                    }}
                    className="flex items-center gap-2 px-5 py-2 bg-white text-black font-bold text-xs sm:text-sm rounded-full hover:bg-neutral-200 active:scale-95 transition-all cursor-pointer shadow-xl"
                  >
                    <Play className="w-4 h-4 text-black fill-current" />
                    <span>Watch Now</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetails(item);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900/80 text-white font-semibold text-xs sm:text-sm rounded-full hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer backdrop-blur-md"
                  >
                    <Info className="w-4 h-4 text-white" />
                    <span>Episodes & Info</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Desktop Floating Next / Prev Chevrons */}
      <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          disabled={activeIndex === 0}
          className={`p-3 rounded-full text-white transition-all cursor-pointer shadow-2xl ${
            activeIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'
          }`}
          title="Previous Reel (Up Arrow)"
        >
          <ChevronUp className="w-5 h-5 text-white" />
        </button>

        <span className="text-xs font-mono text-neutral-400 bg-black/60 px-2 py-1 rounded-full">
          {activeIndex + 1} / {items.length}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          disabled={activeIndex === items.length - 1}
          className={`p-3 rounded-full text-white transition-all cursor-pointer shadow-2xl ${
            activeIndex === items.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'
          }`}
          title="Next Reel (Down Arrow)"
        >
          <ChevronDown className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* 5. Link Copied Toast Notification */}
      {copiedToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-full shadow-2xl flex items-center gap-2 border border-neutral-700">
          <Check className="w-4 h-4 text-white" />
          <span>Link copied to clipboard!</span>
        </div>
      )}
    </div>
  );
}
