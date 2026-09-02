import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Plus, Check, ChevronDown, ThumbsUp } from 'lucide-react';
import { TMDBMedia } from '../types';
import { getPosterUrl, getBackdropUrl } from '../api/tmdb';
import ImageWithSkeleton from './ImageWithSkeleton';

interface MediaCardProps {
  key?: React.Key;
  media: TMDBMedia;
  rank?: number;
  onPlay: (media: TMDBMedia) => void;
  onOpenDetails: (media: TMDBMedia) => void;
  isInMyList: (id: number) => boolean;
  onToggleMyList: (media: TMDBMedia) => void;
  isLandscape?: boolean;
}

export default function MediaCard({
  media,
  rank,
  onPlay,
  onOpenDetails,
  isInMyList,
  onToggleMyList,
  isLandscape = false,
}: MediaCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const hoverTimeoutRef = useRef<any>(null);

  const title = media.title || media.name || media.original_title || 'Untitled';
  const posterUrl = getPosterUrl(media.poster_path, 'w500');
  const backdropUrl = getBackdropUrl(media.backdrop_path, 'w780');
  const isSaved = isInMyList(media.id);
  const releaseYear = (media.release_date || media.first_air_date || '').slice(0, 4) || '2024';
  const matchRate = Math.min(99, Math.max(80, Math.round((media.vote_average || 7.2) * 10)));

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(false);
  };

  return (
    <div
      className="relative shrink-0 select-none group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top 10 Numbered Layout */}
      {rank !== undefined ? (
        <div className="flex items-end">
          {/* Big Monochrome Number (1-10) */}
          <span
            className="text-7xl sm:text-8xl md:text-9xl font-black text-neutral-800 tracking-tighter select-none leading-none -mr-4 sm:-mr-6 z-0 font-mono transition-colors group-hover:text-neutral-600"
            style={{
              WebkitTextStroke: '2px #525252',
            }}
          >
            {rank}
          </span>
          {/* Colored Poster */}
          <div
            onClick={() => onOpenDetails(media)}
            className="relative z-10 w-28 sm:w-36 md:w-44 aspect-2/3 rounded-sm overflow-hidden cursor-pointer shadow-md transition-transform duration-300 group-hover:scale-105 border border-neutral-900 group-hover:border-neutral-700 bg-neutral-900"
          >
            <ImageWithSkeleton
              src={posterUrl}
              alt={title}
              className="w-full h-full object-cover rounded-sm"
            />
          </div>
        </div>
      ) : isLandscape ? (
        /* Landscape Card */
        <div
          onClick={() => onOpenDetails(media)}
          className="relative w-48 sm:w-64 md:w-72 aspect-16/9 rounded-sm overflow-hidden cursor-pointer shadow-md transition-all duration-300 group-hover:scale-105 border border-neutral-900 group-hover:border-neutral-700 bg-neutral-900"
        >
          <ImageWithSkeleton
            src={backdropUrl || posterUrl}
            alt={title}
            className="w-full h-full object-cover rounded-sm"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-40 transition-opacity pointer-events-none rounded-sm"></div>
          <div className="absolute bottom-2 left-2 right-2 text-xs font-semibold text-white truncate pointer-events-none">
            {title}
          </div>
        </div>
      ) : (
        /* Standard Portrait Poster Card */
        <div
          onClick={() => onOpenDetails(media)}
          className="relative w-28 sm:w-36 md:w-44 lg:w-48 aspect-2/3 rounded-sm overflow-hidden cursor-pointer shadow-md transition-all duration-300 group-hover:scale-105 border border-neutral-900 group-hover:border-neutral-700 bg-neutral-900"
        >
          <ImageWithSkeleton
            src={posterUrl}
            alt={title}
            className="w-full h-full object-cover rounded-sm"
          />
        </div>
      )}

      {/* Netflix-Style Hover Preview Popover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: '-45%' }}
            animate={{ opacity: 1, scale: 1, y: '-50%' }}
            exit={{ opacity: 0, scale: 0.9, y: '-45%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 z-50 w-64 sm:w-72 bg-neutral-950 border border-neutral-800 rounded-sm shadow-2xl overflow-hidden"
            style={{ width: '280px' }}
          >
            {/* Popover Colored Image Preview */}
            <div className="relative aspect-16/9 w-full bg-neutral-900">
              <ImageWithSkeleton
                src={backdropUrl || posterUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent"></div>
              <div className="absolute bottom-2 left-3 right-3">
                <p className="text-white font-bold text-xs truncate drop-shadow-md">{title}</p>
              </div>
            </div>

            {/* Action Buttons in Black & White */}
            <div className="p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Play Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(media);
                    }}
                    className="p-2 rounded-full bg-white text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                    title="Play"
                  >
                    <Play className="w-4 h-4 text-black fill-current" />
                  </button>

                  {/* Add to List */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMyList(media);
                    }}
                    className={`p-2 rounded-full border transition-colors cursor-pointer ${
                      isSaved
                        ? 'border-white bg-white text-black'
                        : 'border-neutral-700 bg-neutral-900 text-white hover:border-white'
                    }`}
                    title={isSaved ? 'In My List' : 'Add to My List'}
                  >
                    {isSaved ? (
                      <Check className="w-4 h-4 text-black" />
                    ) : (
                      <Plus className="w-4 h-4 text-white" />
                    )}
                  </button>

                  {/* Like Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLiked(!isLiked);
                    }}
                    className={`p-2 rounded-full border transition-colors cursor-pointer ${
                      isLiked
                        ? 'border-white text-white'
                        : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white hover:border-white'
                    }`}
                    title={isLiked ? 'Liked' : 'Like'}
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>
                </div>

                {/* Expand Details Arrow */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(media);
                  }}
                  className="p-2 rounded-full border border-neutral-700 bg-neutral-900 text-white hover:border-white transition-colors cursor-pointer"
                  title="Episode & More info"
                >
                  <ChevronDown className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Quick Meta */}
              <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-300">
                <span className="text-white font-bold">{matchRate}% Match</span>
                <span className="px-1 border border-neutral-700 text-[10px] text-neutral-400">
                  {media.media_type === 'tv' ? 'TV' : 'HD'}
                </span>
                <span className="text-neutral-500">{releaseYear}</span>
              </div>

              {/* Tagline / Overview */}
              <p className="text-neutral-400 text-[11px] line-clamp-2 leading-relaxed">
                {media.overview || 'Stream now in high quality adaptive HLS format.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
