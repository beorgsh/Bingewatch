import React, { useState } from 'react';
import { Film } from 'lucide-react';

interface ImageWithSkeletonProps {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
}

export default function ImageWithSkeleton({
  src,
  alt,
  className = 'w-full h-full object-cover',
  containerClassName = 'relative w-full h-full overflow-hidden bg-neutral-900',
}: ImageWithSkeletonProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // If no source provided, show clean placeholder
  if (!src || hasError) {
    return (
      <div className={`${containerClassName} flex flex-col items-center justify-center text-neutral-600 select-none`}>
        <Film className="w-8 h-8 text-neutral-600 mb-1" />
        <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">
          {alt || 'Bingewatch'}
        </span>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {/* Animated Skeleton Shimmer (Visible until image loads) */}
      {!isLoaded && (
        <div className="absolute inset-0 z-0 bg-neutral-900 overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 animate-pulse" />
        </div>
      )}

      {/* Render Image with Smooth Fade-in Transition */}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} transition-opacity duration-500 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
