import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Tv, Film, Clapperboard, Loader2, Sparkles, Flame, Video, Monitor } from 'lucide-react';
import { TMDBMedia } from '../types';
import { StreamingPlatform, getDiscover } from '../api/tmdb';
import MediaCard from './MediaCard';

interface PlatformModalProps {
  platform: StreamingPlatform | null;
  onClose: () => void;
  onPlay: (media: TMDBMedia) => void;
  onOpenDetails: (media: TMDBMedia) => void;
  isInMyList: (id: number) => boolean;
  onToggleMyList: (media: TMDBMedia) => void;
}

export default function PlatformModal({
  platform,
  onClose,
  onPlay,
  onOpenDetails,
  isInMyList,
  onToggleMyList,
}: PlatformModalProps) {
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');
  const [items, setItems] = useState<TMDBMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const getPlatformIcon = (code: string) => {
    switch (code) {
      case 'NETFLIX':
        return <Film className="w-7 h-7 text-red-600" />;
      case 'DISNEY':
        return <Sparkles className="w-7 h-7 text-blue-400" />;
      case 'MAX':
        return <Flame className="w-7 h-7 text-purple-400" />;
      case 'PRIME':
        return <Video className="w-7 h-7 text-sky-400" />;
      case 'APPLE':
        return <Monitor className="w-7 h-7 text-neutral-200" />;
      case 'HULU':
        return <Clapperboard className="w-7 h-7 text-emerald-400" />;
      case 'PARAMOUNT':
        return <Tv className="w-7 h-7 text-blue-500" />;
      default:
        return <Tv className="w-7 h-7 text-neutral-300" />;
    }
  };

  useEffect(() => {
    if (!platform) return;

    let isMounted = true;
    const loadPlatformCatalog = async () => {
      setIsLoading(true);
      try {
        let fetched: TMDBMedia[] = [];

        if (filterType === 'all') {
          const [movies, series] = await Promise.all([
            getDiscover('movie', undefined, 1, platform.id, platform.networkId),
            getDiscover('tv', undefined, 1, platform.id, platform.networkId),
          ]);
          // Interleave movies and series
          const maxLen = Math.max(movies.length, series.length);
          for (let i = 0; i < maxLen; i++) {
            if (movies[i]) fetched.push(movies[i]);
            if (series[i]) fetched.push(series[i]);
          }
        } else {
          fetched = await getDiscover(filterType, undefined, 1, platform.id, platform.networkId);
        }

        if (isMounted) {
          setItems(fetched);
          setPage(1);
          setHasMore(fetched.length > 0);
        }
      } catch (err) {
        console.error('Failed to load platform media:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPlatformCatalog();

    return () => {
      isMounted = false;
    };
  }, [platform, filterType]);

  const handleLoadMore = async () => {
    if (!platform || isLoading) return;
    const nextPage = page + 1;
    setIsLoading(true);
    try {
      let fetched: TMDBMedia[] = [];
      if (filterType === 'all') {
        const [movies, series] = await Promise.all([
          getDiscover('movie', undefined, nextPage, platform.id, platform.networkId),
          getDiscover('tv', undefined, nextPage, platform.id, platform.networkId),
        ]);
        const maxLen = Math.max(movies.length, series.length);
        for (let i = 0; i < maxLen; i++) {
          if (movies[i]) fetched.push(movies[i]);
          if (series[i]) fetched.push(series[i]);
        }
      } else {
        fetched = await getDiscover(filterType, undefined, nextPage, platform.id, platform.networkId);
      }

      if (fetched.length > 0) {
        setItems((prev) => [...prev, ...fetched]);
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more platform media:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!platform) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-6xl bg-neutral-950 border border-neutral-800 rounded-sm shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur-md px-4 sm:px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                {getPlatformIcon(platform.code)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">{platform.name}</h2>
                  <span className="text-xs px-2 py-0.5 rounded-sm bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono">
                    Provider Catalog
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Showing top movies and series streaming on {platform.name}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-neutral-900 border border-neutral-800 hover:border-white text-neutral-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="px-4 sm:px-6 py-3 bg-neutral-900/60 border-b border-neutral-900 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setFilterType('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white text-black font-bold'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>All Titles</span>
            </button>

            <button
              onClick={() => setFilterType('movie')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'movie'
                  ? 'bg-white text-black font-bold'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Movies</span>
            </button>

            <button
              onClick={() => setFilterType('tv')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'tv'
                  ? 'bg-white text-black font-bold'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <Clapperboard className="w-3.5 h-3.5" />
              <span>TV Series</span>
            </button>
          </div>

          {/* Catalog Grid */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-[350px]">
            {items.length === 0 && !isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-neutral-500">
                <Tv className="w-12 h-12 mb-2 stroke-1 text-neutral-600" />
                <p className="text-sm font-medium">No titles found for {platform.name}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
                {items.map((media) => (
                  <MediaCard
                    key={`${media.id}-${media.media_type}`}
                    media={media}
                    onPlay={onPlay}
                    onOpenDetails={onOpenDetails}
                    isInMyList={isInMyList}
                    onToggleMyList={onToggleMyList}
                  />
                ))}
              </div>
            )}

            {/* Load More Button */}
            {hasMore && items.length > 0 && (
              <div className="mt-8 text-center pb-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-6 py-2.5 rounded-sm bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load More Titles</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
