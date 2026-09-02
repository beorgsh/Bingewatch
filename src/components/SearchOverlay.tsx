import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, X, Film, Tv, Play, Info } from 'lucide-react';
import { TMDBMedia } from '../types';
import { searchMulti, getPosterUrl } from '../api/tmdb';
import ImageWithSkeleton from './ImageWithSkeleton';

interface SearchOverlayProps {
  query: string;
  onClose: () => void;
  onPlay: (media: TMDBMedia) => void;
  onOpenDetails: (media: TMDBMedia) => void;
  isInMyList: (id: number) => boolean;
  onToggleMyList: (media: TMDBMedia) => void;
}

export default function SearchOverlay({
  query,
  onClose,
  onPlay,
  onOpenDetails,
}: SearchOverlayProps) {
  const [results, setResults] = useState<TMDBMedia[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
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

  const filteredResults = results.filter((item) => {
    if (filterType === 'all') return true;
    return item.media_type === filterType;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen"
    >
      {/* Search Header & Filter Pills */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-neutral-900 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-neutral-400" />
            <span>Search Results for "{query}"</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Found {filteredResults.length} titles in TMDB catalog
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {(['all', 'movie', 'tv'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                filterType === type
                  ? 'bg-white text-black'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-neutral-500 text-sm">
          Searching Bingewatch catalogue...
        </div>
      ) : filteredResults.length > 0 ? (
        /* Results Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {filteredResults.map((item) => {
            const title = item.title || item.name || item.original_title || 'Untitled';
            const year = (item.release_date || item.first_air_date || '').slice(0, 4);

            return (
              <div
                key={item.id}
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
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(item);
                      }}
                      className="p-3 rounded-full bg-white text-black hover:scale-110 transition-transform shadow-lg cursor-pointer"
                      title="Play"
                    >
                      <Play className="w-4 h-4 text-black fill-current" />
                    </button>
                  </div>
                </div>

                {/* Card Meta */}
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <p className="text-xs font-bold text-white truncate group-hover:underline">{title}</p>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-1">
                    <span>{year || '2024'}</span>
                    <span className="uppercase px-1 border border-neutral-800 text-[10px] text-neutral-400">
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
          <p className="text-xs text-neutral-600">Try searching for popular titles like "Inception", "Stranger Things", or "Avengers".</p>
        </div>
      )}
    </motion.div>
  );
}
