import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Play,
  Plus,
  Check,
  Info,
  Star,
  Film,
  Tv,
  LayoutGrid,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { TMDBMedia } from '../types';
import { getDiscover, getPosterUrl, GENRE_LIST, getBackdropUrl } from '../api/tmdb';

interface BrowseViewProps {
  onPlay: (media: TMDBMedia) => void;
  onOpenDetails: (media: TMDBMedia) => void;
  isInMyList: (id: number) => boolean;
  onToggleMyList: (media: TMDBMedia) => void;
}

type MediaTypeFilter = 'all' | 'movie' | 'tv';
type SortOption = 'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc';

export default function BrowseView({
  onPlay,
  onOpenDetails,
  isInMyList,
  onToggleMyList,
}: BrowseViewProps) {
  const [mediaType, setMediaType] = useState<MediaTypeFilter>('all');
  const [selectedGenre, setSelectedGenre] = useState<number>(0);
  const [sortBy, setSortBy] = useState<SortOption>('popularity.desc');
  const [items, setItems] = useState<TMDBMedia[]>([]);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState<string>('');

  // Fetch browse items when filters change
  const fetchBrowseItems = useCallback(
    async (currentPage: number, isNewFilter = false) => {
      if (isNewFilter) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        let results: TMDBMedia[] = [];

        if (mediaType === 'all') {
          // Fetch both movies and tv shows
          const [movies, tv] = await Promise.all([
            getDiscover('movie', selectedGenre || undefined, currentPage),
            getDiscover('tv', selectedGenre || undefined, currentPage),
          ]);
          // Interleave results
          const maxLen = Math.max(movies.length, tv.length);
          for (let i = 0; i < maxLen; i++) {
            if (movies[i]) results.push(movies[i]);
            if (tv[i]) results.push(tv[i]);
          }
        } else {
          results = await getDiscover(
            mediaType,
            selectedGenre || undefined,
            currentPage
          );
        }

        // Filter out items without images
        const validResults = results.filter(
          (item) => Boolean(item.poster_path || item.backdrop_path)
        );

        if (isNewFilter) {
          setItems(validResults);
        } else {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newItems = validResults.filter((i) => !existingIds.has(i.id));
            return [...prev, ...newItems];
          });
        }

        setHasMore(validResults.length > 0 && currentPage < 25);
      } catch (err) {
        console.error('Failed to load browse catalog:', err);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [mediaType, selectedGenre, sortBy]
  );

  // Trigger initial or filter-change load
  useEffect(() => {
    setPage(1);
    fetchBrowseItems(1, true);
  }, [fetchBrowseItems]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchBrowseItems(nextPage, false);
  };

  // Filter items by search text within browse view
  const displayedItems = filterQuery.trim()
    ? items.filter((item) => {
        const title = (item.title || item.name || '').toLowerCase();
        return title.includes(filterQuery.toLowerCase());
      })
    : items;

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-28 px-4 sm:px-6 lg:px-10 max-w-7xl 2xl:max-w-screen-2xl mx-auto">
      {/* 1. Header & Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="w-5 h-5 text-white" />
            <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
              Complete Catalog
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Browse All Titles
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm mt-1 max-w-xl">
            Explore thousands of blockbuster films, award-winning series, anime, and hidden gems with adaptive HLS streaming.
          </p>
        </div>

        {/* Quick Filter Search within Browse */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-1.5 w-full md:w-64">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="text"
              placeholder="Filter current view..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-transparent text-white placeholder-neutral-500 text-xs focus:outline-none ml-2 w-full"
            />
          </div>
        </div>
      </div>

      {/* 2. Filter Controls: Type Selector & Sort Options */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        {/* Media Type Tabs: All / Movies / TV Shows */}
        <div className="flex items-center p-1 bg-neutral-900/90 border border-neutral-800 rounded-lg">
          <button
            onClick={() => setMediaType('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              mediaType === 'all'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>All Titles</span>
          </button>

          <button
            onClick={() => setMediaType('movie')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              mediaType === 'movie'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Movies</span>
          </button>

          <button
            onClick={() => setMediaType('tv')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              mediaType === 'tv'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>TV Shows</span>
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <SlidersHorizontal className="w-4 h-4 text-neutral-400" />
          <span className="text-neutral-400 hidden sm:inline">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-neutral-900 border border-neutral-800 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-neutral-600 cursor-pointer"
          >
            <option value="popularity.desc">Most Popular</option>
            <option value="vote_average.desc">Top Rated</option>
            <option value="primary_release_date.desc">Release Date</option>
          </select>
        </div>
      </div>

      {/* 3. Horizontal Slidable Genre Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-2 pb-4 -mx-2 px-2">
        {GENRE_LIST.map((genre) => {
          const isSelected = selectedGenre === genre.id;
          return (
            <button
              key={genre.id}
              onClick={() => setSelectedGenre(genre.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-neutral-200 text-black font-bold shadow-md'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
              }`}
            >
              {genre.name}
            </button>
          );
        })}
      </div>

      {/* 4. Main Media Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 mt-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-lg bg-neutral-900 animate-pulse border border-neutral-800"
            />
          ))}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="py-24 text-center">
          <Film className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No titles found</h3>
          <p className="text-neutral-400 text-xs mt-1">
            Try resetting your genre or search filters.
          </p>
          <button
            onClick={() => {
              setSelectedGenre(0);
              setFilterQuery('');
              setMediaType('all');
            }}
            className="mt-4 px-4 py-2 bg-neutral-800 text-white rounded-lg text-xs font-semibold hover:bg-neutral-700 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4 mt-4">
          {displayedItems.map((item) => {
            const title = item.title || item.name || item.original_title || 'Untitled';
            const posterUrl = getPosterUrl(item.poster_path, 'w500');
            const releaseYear = (item.release_date || item.first_air_date || '').slice(0, 4);
            const isTv = item.media_type === 'tv' || Boolean(item.first_air_date);
            const isSaved = isInMyList(item.id);
            const rating = item.vote_average ? item.vote_average.toFixed(1) : null;

            return (
              <div
                key={`${item.media_type || 'm'}-${item.id}`}
                className="group relative rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800/80 hover:border-neutral-600 transition-all duration-300 hover:shadow-2xl hover:scale-[1.03] cursor-pointer flex flex-col"
                onClick={() => onOpenDetails(item)}
              >
                {/* Poster Image */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950">
                  <img
                    src={posterUrl}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Format Badge (TV / Movie) */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-neutral-200">
                    {isTv ? (
                      <>
                        <Tv className="w-3 h-3 text-sky-400" />
                        <span>SERIES</span>
                      </>
                    ) : (
                      <>
                        <Film className="w-3 h-3 text-amber-400" />
                        <span>MOVIE</span>
                      </>
                    )}
                  </div>

                  {/* Rating Badge */}
                  {rating && (
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{rating}</span>
                    </div>
                  )}

                  {/* Hover Overlay with Quick Action Buttons */}
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(item);
                      }}
                      className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 transition-transform active:scale-95 shadow-xl cursor-pointer"
                      title="Watch Now"
                    >
                      <Play className="w-5 h-5 text-black fill-current ml-0.5" />
                    </button>

                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMyList(item);
                        }}
                        className="p-2 rounded-full bg-black/70 border border-neutral-700 text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                        title={isSaved ? 'Remove from My List' : 'Add to My List'}
                      >
                        {isSaved ? (
                          <Check className="w-4 h-4 text-white" />
                        ) : (
                          <Plus className="w-4 h-4 text-white" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetails(item);
                        }}
                        className="p-2 rounded-full bg-black/70 border border-neutral-700 text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Info className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Info Title & Meta */}
                <div className="p-2.5 bg-neutral-950 flex-1 flex flex-col justify-between">
                  <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-neutral-200">
                    {title}
                  </h3>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-neutral-400">
                    <span>{releaseYear || 'HD'}</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 bg-neutral-900 border border-neutral-800 rounded text-neutral-300">
                      4K HLS
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Load More Button */}
      {!isLoading && hasMore && (
        <div className="mt-12 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-xs sm:text-sm transition-all shadow-xl active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
                <span>Loading More Titles...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 text-white" />
                <span>Load More Titles</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
