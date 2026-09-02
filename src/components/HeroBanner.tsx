import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Info, Plus, Check, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { TMDBMedia } from '../types';
import { getBackdropUrl, getMediaVideos } from '../api/tmdb';
import ImageWithSkeleton from './ImageWithSkeleton';

interface HeroBannerProps {
  media?: TMDBMedia | null;
  mediaList?: TMDBMedia[];
  onPlay: (media: TMDBMedia) => void;
  onOpenDetails: (media: TMDBMedia) => void;
  isInMyList: (id: number) => boolean;
  onToggleMyList: (media: TMDBMedia) => void;
}

export default function HeroBanner({
  media,
  mediaList = [],
  onPlay,
  onOpenDetails,
  isInMyList,
  onToggleMyList,
}: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [trailersMap, setTrailersMap] = useState<Record<number, string>>({});
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Combine media or mediaList into an active pool (max 8 items for hero carousel)
  const activeItems = mediaList.length > 0 ? mediaList.slice(0, 8) : media ? [media] : [];

  const handleNextSlide = useCallback(() => {
    if (activeItems.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % activeItems.length);
  }, [activeItems.length]);

  // Preload backdrop images and fetch official trailers for hero items
  useEffect(() => {
    if (activeItems.length === 0) return;
    activeItems.forEach((item) => {
      if (item.backdrop_path) {
        const url = getBackdropUrl(item.backdrop_path, 'original');
        const img = new Image();
        img.src = url;
      }
      
      const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
      if (item.id && trailersMap[item.id] === undefined) {
        getMediaVideos(type, item.id).then((videos) => {
          const trailer =
            videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
            videos.find((v) => v.site === 'YouTube' && v.type === 'Teaser') ||
            videos.find((v) => v.site === 'YouTube');
          setTrailersMap((prev) => ({
            ...prev,
            [item.id]: trailer?.key || '',
          }));
        }).catch(() => {});
      }
    });
  }, [activeItems]);

  const currentMedia = activeItems[currentIndex] || activeItems[0] || null;
  const trailerKey = currentMedia ? trailersMap[currentMedia.id] : null;

  // 1. YouTube IFrame postMessage Listener: Detect when the trailer video FINISHES (State 0 / ENDED)
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (!data) return;

        // YouTube Player State 0 is ENDED (video finished)
        if (
          (data.event === 'onStateChange' && data.info === 0) ||
          (data.event === 'infoDelivery' && data.info && data.info.playerState === 0) ||
          data.info === 0
        ) {
          if (!isHovered) {
            handleNextSlide();
          }
        }
      } catch {
        // Ignore non-JSON postMessages
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [handleNextSlide, isHovered]);

  // 2. Automated Fallback Progression:
  // - If NO trailer exists for this title: cycle after 10 seconds.
  // - If trailer DOES exist: set a generous fallback safety timer (e.g., 90s) in case postMessage is blocked,
  //   while waiting for the actual trailer video to end.
  useEffect(() => {
    if (activeItems.length <= 1 || isHovered) return;

    const delayMs = trailerKey ? 90000 : 10000;
    const timer = setTimeout(() => {
      handleNextSlide();
    }, delayMs);

    return () => clearTimeout(timer);
  }, [activeItems.length, currentIndex, isHovered, trailerKey, handleNextSlide]);

  if (!currentMedia) {
    return (
      <div className="relative h-[60vh] sm:h-[80vh] w-full bg-neutral-950 flex items-center justify-center">
        <div className="w-full h-full bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 animate-pulse flex items-center justify-center">
          <div className="text-neutral-600 text-sm font-mono tracking-wider">Loading Featured Cinema...</div>
        </div>
      </div>
    );
  }

  const title = currentMedia.title || currentMedia.name || currentMedia.original_title || 'Featured Title';
  const releaseYear = (currentMedia.release_date || currentMedia.first_air_date || '').slice(0, 4) || '2024';
  const backdropUrl = getBackdropUrl(currentMedia.backdrop_path, 'original');
  const isSaved = isInMyList(currentMedia.id);
  const matchRate = Math.min(99, Math.max(85, Math.round((currentMedia.vote_average || 7.5) * 10)));

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative h-[65vh] sm:h-[82vh] lg:h-[88vh] w-full select-none overflow-hidden bg-black"
    >
      {/* Background Media Backdrop with Silky Smooth Cross-Fade */}
      <div className="absolute inset-0 bg-black overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div
            key={currentMedia.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            className="absolute inset-0 z-0"
          >
            {trailerKey ? (
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&showinfo=0&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
                  title={`${title} Trailer`}
                  allow="autoplay; encrypted-media"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180vw] h-[105vw] min-w-[200vh] min-h-[115vh] object-cover pointer-events-none scale-110"
                />
              </div>
            ) : (
              <img
                src={backdropUrl}
                alt={title}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover object-center transform scale-105"
              />
            )}
            {/* Seamless Black Gradients */}
            <div
              style={{
                background:
                  'linear-gradient(to right, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.75) 30%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0) 100%)',
              }}
              className="absolute inset-0 w-full md:w-3/4 pointer-events-none z-10"
            ></div>
            <div
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.15) 75%, rgba(0,0,0,0) 100%)',
              }}
              className="absolute inset-0 pointer-events-none z-10"
            ></div>
            <div
              style={{
                background:
                  'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0) 100%)',
              }}
              className="absolute top-0 left-0 right-0 h-20 sm:h-32 pointer-events-none z-10"
            ></div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Hero Content Overlay with Seamless Cross-Fade */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`content-${currentMedia.id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="absolute inset-0 z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-12 sm:pb-20 pointer-events-none"
        >
          <div className="max-w-2xl space-y-2.5 sm:space-y-4 pointer-events-auto">
            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-semibold text-neutral-300">
              <span className="flex items-center gap-1.5 text-white bg-neutral-900/90 px-2 py-0.5 rounded-sm border border-neutral-700">
                <Sparkles className="w-3 h-3 text-white" />
                <span>TOP 10 TODAY</span>
              </span>
              <span className="text-white font-bold">{matchRate}% Match</span>
              <span className="text-neutral-400">{releaseYear}</span>
              <span className="px-1.5 py-0.2 border border-neutral-600 rounded-sm text-[10px] text-neutral-300">
                {currentMedia.media_type === 'tv' ? 'TV-MA' : 'PG-13'}
              </span>
              <span className="px-1.5 py-0.2 border border-neutral-600 rounded-sm text-[10px] text-neutral-300 font-mono hidden xs:inline-block">
                4K ULTRA HD
              </span>
            </div>

            {/* Main Title */}
            <h1 className="text-2xl xs:text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-none drop-shadow-md">
              {title}
            </h1>

            {/* Overview Synopsis */}
            <p className="text-xs sm:text-base text-neutral-200 line-clamp-2 sm:line-clamp-3 font-normal leading-relaxed max-w-xl drop-shadow-sm">
              {currentMedia.overview ||
                'Explore this acclaimed title now streaming in high definition adaptive HLS audio and video on Bingewatch.'}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
              <button
                onClick={() => onPlay(currentMedia)}
                className="flex items-center gap-2 px-5 sm:px-8 py-2.5 sm:py-3 bg-white text-black font-bold text-xs sm:text-base rounded-sm hover:bg-neutral-200 active:scale-95 transition-all cursor-pointer shadow-lg"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-black fill-current" />
                <span>Play</span>
              </button>

              <button
                onClick={() => onOpenDetails(currentMedia)}
                className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-neutral-800/80 text-white font-semibold text-xs sm:text-base rounded-sm hover:bg-neutral-700 active:scale-95 transition-all cursor-pointer backdrop-blur-xs border border-neutral-700"
              >
                <Info className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <span>More Info</span>
              </button>

              <button
                onClick={() => onToggleMyList(currentMedia)}
                className={`flex items-center justify-center p-2.5 sm:p-3 rounded-sm border cursor-pointer transition-colors ${
                  isSaved
                    ? 'border-white bg-white text-black'
                    : 'border-neutral-600 bg-neutral-900/70 text-white hover:border-white'
                }`}
                title={isSaved ? 'Remove from My List' : 'Add to My List'}
              >
                {isSaved ? (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                ) : (
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom Controls: Carousel Pill Indicators + Mute & Maturity Box */}
      <div className="absolute left-4 sm:left-8 right-4 sm:right-8 bottom-4 sm:bottom-8 z-30 flex items-center justify-between pointer-events-auto">
        {/* Carousel Indicators */}
        {activeItems.length > 1 && (
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-neutral-800/80">
            {activeItems.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex
                    ? 'w-6 bg-white'
                    : 'w-1.5 bg-neutral-600 hover:bg-neutral-400'
                }`}
                title={`Go to item ${idx + 1}`}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 sm:p-2.5 rounded-full bg-neutral-900/80 border border-neutral-700 hover:border-white text-neutral-300 hover:text-white transition-all cursor-pointer"
            title={isMuted ? 'Unmute preview' : 'Mute preview'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            )}
          </button>

          <div className="bg-neutral-900/90 border-l-2 border-white px-2 sm:px-3 py-1 text-[10px] sm:text-xs text-neutral-300 font-semibold tracking-wider rounded-r-xs">
            {currentMedia.media_type === 'tv' ? 'TV-MA' : '16+'}
          </div>
        </div>
      </div>
    </div>
  );
}
