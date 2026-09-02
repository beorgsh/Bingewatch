import React from 'react';
import { motion } from 'motion/react';
import { Bookmark, Play, Trash2, Info } from 'lucide-react';
import { TMDBMedia } from '../types';
import { getPosterUrl } from '../api/tmdb';
import ImageWithSkeleton from './ImageWithSkeleton';

interface MyListViewProps {
  items: TMDBMedia[];
  onPlay: (media: TMDBMedia) => void;
  onOpenDetails: (media: TMDBMedia) => void;
  onRemoveFromList: (id: number) => void;
}

export default function MyListView({
  items,
  onPlay,
  onOpenDetails,
  onRemoveFromList,
}: MyListViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen"
    >
      <div className="flex items-center justify-between border-b border-neutral-900 pb-6 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">My List</h1>
          <p className="text-xs text-neutral-500 mt-1">
            {items.length} {items.length === 1 ? 'title' : 'titles'} saved for binge watching
          </p>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {items.map((media) => {
            const title = media.title || media.name || media.original_title || 'Untitled';
            const year = (media.release_date || media.first_air_date || '').slice(0, 4);

            return (
              <div
                key={media.id}
                onClick={() => onOpenDetails(media)}
                className="group relative bg-neutral-950 rounded-xs overflow-hidden border border-neutral-900 hover:border-neutral-700 transition-all cursor-pointer flex flex-col"
              >
                {/* Colored Poster */}
                <div className="relative aspect-2/3 w-full bg-neutral-900 overflow-hidden">
                  <ImageWithSkeleton
                    src={getPosterUrl(media.poster_path, 'w500')}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(media);
                      }}
                      className="p-3 rounded-full bg-white text-black hover:scale-110 transition-transform shadow-lg cursor-pointer"
                      title="Play"
                    >
                      <Play className="w-4 h-4 text-black fill-current" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromList(media.id);
                      }}
                      className="p-3 rounded-full bg-neutral-900/90 text-neutral-400 hover:text-white border border-neutral-700 hover:scale-110 transition-transform cursor-pointer"
                      title="Remove from My List"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Card Information */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <p className="text-xs font-bold text-white truncate group-hover:underline">{title}</p>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-1">
                    <span>{year || '2024'}</span>
                    <span className="uppercase px-1 border border-neutral-800 text-[10px] text-neutral-400">
                      {media.media_type === 'tv' ? 'Series' : 'Movie'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-32 space-y-4 max-w-md mx-auto">
          <Bookmark className="w-12 h-12 text-neutral-700 mx-auto" />
          <h2 className="text-lg font-bold text-white">Your list is currently empty</h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Browse through trending movies and top TV series on Bingewatch, and click the "+" icon to add your favorite titles to your watchlist.
          </p>
        </div>
      )}
    </motion.div>
  );
}
