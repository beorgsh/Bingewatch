import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Flame, Play, X } from 'lucide-react';
import { TMDBMedia } from '../types';
import { searchMulti, getTrending, getPosterUrl } from '../api/tmdb';
import ImageWithSkeleton from './ImageWithSkeleton';

interface SearchOverlayProps {
  query: string;
  onClose: () => void;
  onPlay: (media: TMDBMedia) => void;
  onOpenDetails: (media: TMDBMedia) => void;
  isInMyList: (id: number) => boolean;
  onToggleMyList: (media: TMDBMedia) => void;
  defaultTop10?: TMDBMedia[];
}

export default function SearchOverlay({
  query,
  onClose,
  onPlay,
  onOpenDetails,
  defaultTop10 = [],
}: SearchOverlayProps) {
  const [results, setResults] = useState<TMDBMedia[]>([]);
  const [top10Items, setTop10Items] = useState<TMDBMedia[]>(defaultTop10);
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Fallback fetch for Top 10 if defaultTop10 isn't supplied
  useEffect(() => {
    if (defaultTop10 && defaultTop10.length > 0) {
      setTop10Items(defaultTop10);
      return;
    }
    let isMounted = true;
    getTrending()
      .then((data) => {
        if (isMounted && data) {
          setTop10Items(data.slice(0, 10));
        }
      })
      .catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [defaultTop10]);

  // Execute TMDB Search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await searchMulti(query);
        setResults(data);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const isQueryActive = Boolean(query.trim());

  const filteredResults = results.filter((item) => {
    if (filterType === 'all') return true;
    return item.media_type === filterType;
  });

  const displayItems = isQueryActive ? filteredResults : top10Items.slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="pt-20 sm:pt-24 pb-16 px-3 sm:px-6 lg:px-8 w-full max-w-7xl 2xl:max-w-screen-2xl mx-auto min-h-screen"
    >
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 border-b border-neutral-900 pb-4 sm:pb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
            {isQueryActive ? (
              <>
                <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                <span className="truncate">Search Results for "{query}"</span>
              </>
            ) : (
              <>
                <Flame className="w-5 h-5 text-white shrink-0" />
                <span>Top 10 in Bingewatch Today</span>
              </>
            )}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {isQueryActive
              ? `Found ${filteredResults.length} titles in TMDB catalog`
              : 'Trending movies & TV series right now'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-between w-full sm:w-auto justify-between sm:justify-end">
          {/* Filter Pills (Active when searching) */}
          {isQueryActive && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {(['all', 'movie', 'tv'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-sm text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                    filterType === type
                      ? 'bg-white text-black'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer ml-auto"
            title="Close Search"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Grid Content: 3 items per row on mobile, max 7 items per row on wide screen */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-neutral-500 text-sm font-mono animate-pulse">
          Searching Bingewatch catalogue...
        </div>
      ) : displayItems.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 sm:gap-4 md:gap-5">
          {displayItems.map((item, index) => {
            const title = item.title || item.name || item.original_title || 'Untitled';
            const year = (item.release_date || item.first_air_date || '').slice(0, 4);

            return (
              <div
                key={`${item.id}-${index}`}
                onClick={() => onOpenDetails(item)}
                className="group relative bg-neutral-950 rounded-xs overflow-hidden border border-neutral-900 hover:border-neutral-700 transition-all cursor-pointer flex flex-col"
              >
                {/* Colored Poster */}
                <div className="relative aspect-2/3 w-full bg-neutral-900 overflow-hidden">
                  <ImageWithSkeleton
                    src={getPosterUrl(item.poster_path, 'w500')}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Rank Badge for Top 10 items */}
                  {!isQueryActive && (
                    <div className="absolute top-0 left-0 bg-white text-black font-extrabold text-[10px] sm:text-xs px-1.5 py-0.5 rounded-br-xs shadow-md">
                      #{index + 1}
                    </div>
                  )}

                  {/* Hover/Tap Play Button */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(item);
                      }}
                      className="p-2.5 sm:p-3 rounded-full bg-white text-black hover:scale-110 transition-transform shadow-lg cursor-pointer"
                      title="Play"
                    >
                      <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black fill-current" />
                    </button>
                  </div>
                </div>

                {/* Card Metadata */}
                <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between">
                  <p className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:underline">
                    {title}
                  </p>
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-500 mt-1">
                    <span>{year || '2024'}</span>
                    <span className="uppercase px-1 border border-neutral-800 text-[9px] sm:text-[10px] text-neutral-400">
                      {item.media_type === 'tv' ? 'Series' : 'Movie'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-24 space-y-3">
          <p className="text-base text-neutral-400">No matching movies or TV shows found.</p>
          <p className="text-xs text-neutral-600">
            Try searching for popular titles like "Inception", "Stranger Things", or "Avengers".
          </p>
        </div>
      )}
    </motion.div>
  );
}
