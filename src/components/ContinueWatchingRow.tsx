import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Info, X, Sparkles, Trash2 } from 'lucide-react';
import { TMDBMedia } from '../types';
import { getBackdropUrl, getPosterUrl } from '../api/tmdb';
import ImageWithSkeleton from './ImageWithSkeleton';

export interface ContinueWatchingItem {
  id: number;
  media: TMDBMedia;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  savedTime?: number;
  duration?: number;
  progressPercent: number;
  remainingTime?: string;
  backdropPath?: string | null;
}

interface ContinueWatchingRowProps {
  items: ContinueWatchingItem[];
  onPlay: (media: TMDBMedia, season?: number, episode?: number) => void;
  onOpenDetails: (media: TMDBMedia) => void;
  onRemoveItem?: (id: number) => void;
}

export default function ContinueWatchingRow({
  items,
  onPlay,
  onOpenDetails,
  onRemoveItem,
}: ContinueWatchingRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  if (!items || items.length === 0) return null;

  const handleScroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const { clientWidth } = rowRef.current;
    const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
    rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const onScrollCheck = () => {
    if (!rowRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    setShowLeftArrow(scrollLeft > 20);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
  };

  return (
    <div className="space-y-3 my-8 group/row relative select-none">
      {/* Row Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-red-600" />
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Continue Watching
          </h2>
        </div>
        <span className="text-xs text-neutral-400 font-medium tracking-wider uppercase hidden sm:inline-block">
          Resume Session
        </span>
      </div>

      {/* Landscape Scroll Container */}
      <div className="relative">
        {/* Left Scroll Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-0 bottom-0 z-30 w-10 sm:w-12 bg-black/80 hover:bg-black/95 text-white flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover/row:opacity-100 backdrop-blur-xs border-r border-neutral-900"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Scrollable Landscape Cards */}
        <div
          ref={rowRef}
          onScroll={onScrollCheck}
          className="flex items-center gap-4 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 py-2 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => {
            const mediaTitle = item.media.title || item.media.name || item.media.original_title || 'Untitled';
            const imageUrl = getBackdropUrl(item.backdropPath || item.media.backdrop_path, 'w780') || getPosterUrl(item.media.poster_path, 'w500');

            return (
              <div
                key={`cw-${item.id}-${item.season || 1}-${item.episode || 1}`}
                className="group relative w-64 sm:w-80 md:w-96 shrink-0 aspect-16/9 bg-neutral-950 rounded-sm overflow-hidden border border-neutral-900 hover:border-neutral-700 transition-all duration-300 shadow-lg hover:scale-105 cursor-pointer"
              >
                {/* Landscape Episode Thumbnail / Backdrop Image */}
                <ImageWithSkeleton
                  src={imageUrl}
                  alt={mediaTitle}
                  className="w-full h-full object-cover rounded-sm"
                />

                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none"></div>

                {/* Top Action Controls: Remove Button & Season/Episode Tag */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-auto">
                  <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold text-white bg-black/80 backdrop-blur-xs rounded-xs font-mono tracking-wider">
                    {item.media.media_type === 'tv'
                      ? `S${item.season || 1}:E${item.episode || 1}`
                      : 'Movie'}
                  </span>

                  {onRemoveItem && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setConfirmDeleteId(item.id);
                      }}
                      className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-neutral-300 hover:text-white transition-colors cursor-pointer z-20"
                      title="Remove from Continue Watching"
                    >
                      <X className="w-4 h-4 text-white pointer-events-none" />
                    </button>
                  )}
                </div>

                {/* Deletion Confirmation Overlay */}
                {confirmDeleteId === item.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 z-30 bg-neutral-950/95 backdrop-blur-md p-4 flex flex-col justify-between items-center text-center animate-fadeIn"
                  >
                    <div className="flex flex-col items-center justify-center gap-1 my-auto">
                      <Trash2 className="w-5 h-5 text-red-500 mb-1" />
                      <p className="text-xs font-bold text-white line-clamp-1">
                        Remove "{mediaTitle}"?
                      </p>
                      <p className="text-[11px] text-neutral-400 max-w-[200px]">
                        This item will be deleted from your Continue Watching row.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full max-w-xs">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="flex-1 py-1.5 px-3 rounded text-xs font-medium bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveItem?.(item.id);
                          setConfirmDeleteId(null);
                        }}
                        className="flex-1 py-1.5 px-3 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer shadow-md"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                {/* Center Hover Play Button */}
                <div
                  onClick={() => onPlay(item.media, item.season, item.episode)}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-xs z-10"
                >
                  <div className="p-3 sm:p-4 rounded-full bg-white text-black hover:scale-110 active:scale-95 transition-transform shadow-2xl">
                    <Play className="w-6 h-6 sm:w-7 sm:h-7 text-black fill-current ml-0.5" />
                  </div>
                </div>

                {/* Bottom Content Metadata */}
                <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between gap-2 pointer-events-none">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-md">
                      {mediaTitle}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-neutral-300 truncate font-medium drop-shadow-sm">
                      {item.episodeTitle || (item.media.media_type === 'tv' ? `Episode ${item.episode || 1}` : 'Resume Playback')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pointer-events-auto shrink-0">
                    {item.remainingTime && (
                      <span className="text-[10px] font-mono text-neutral-300 bg-black/70 px-1.5 py-0.5 rounded-xs">
                        {item.remainingTime}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetails(item.media);
                      }}
                      className="p-1.5 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                      title="More Info"
                    >
                      <Info className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>

                {/* Bottom Red Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800 z-20">
                  <div
                    className="h-full bg-red-600 rounded-r-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(5, item.progressPercent))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Scroll Arrow */}
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-0 bottom-0 z-30 w-10 sm:w-12 bg-black/80 hover:bg-black/95 text-white flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover/row:opacity-100 backdrop-blur-xs border-l border-neutral-900"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
