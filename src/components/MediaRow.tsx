import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TMDBMedia } from '../types';
import MediaCard from './MediaCard';

interface MediaRowProps {
  key?: React.Key;
  title: string;
  items: TMDBMedia[];
  isTop10?: boolean;
  isLandscape?: boolean;
  onPlay: (media: TMDBMedia) => void;
  onOpenDetails: (media: TMDBMedia) => void;
  isInMyList: (id: number) => boolean;
  onToggleMyList: (media: TMDBMedia) => void;
}

export default function MediaRow({
  title,
  items,
  isTop10 = false,
  isLandscape = false,
  onPlay,
  onOpenDetails,
  isInMyList,
  onToggleMyList,
}: MediaRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  if (!items || items.length === 0) return null;

  const handleScroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const { scrollLeft, clientWidth } = rowRef.current;
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
    <div className="space-y-2.5 my-6 sm:my-8 group/row relative">
      {/* Row Section Title */}
      <div className="flex items-baseline justify-between px-4 sm:px-6 lg:px-8">
        <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white tracking-tight">
          {title}
        </h2>
        <span className="text-xs text-neutral-500 font-medium tracking-wider uppercase opacity-0 group-hover/row:opacity-100 transition-opacity">
          Explore All
        </span>
      </div>

      {/* Row Container with Scroll Controls */}
      <div className="relative">
        {/* Left Arrow Button */}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-0 bottom-0 z-30 w-10 sm:w-12 bg-black/80 hover:bg-black/95 text-white flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover/row:opacity-100 backdrop-blur-xs border-r border-neutral-900"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Scrollable Items Container */}
        <div
          ref={rowRef}
          onScroll={onScrollCheck}
          className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 py-4 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, index) => (
            <MediaCard
              key={`${item.id}-${index}`}
              media={item}
              rank={isTop10 ? index + 1 : undefined}
              isLandscape={isLandscape}
              onPlay={onPlay}
              onOpenDetails={onOpenDetails}
              isInMyList={isInMyList}
              onToggleMyList={onToggleMyList}
            />
          ))}
        </div>

        {/* Right Arrow Button */}
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
