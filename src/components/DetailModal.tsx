import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Play,
  Plus,
  Check,
  ThumbsUp,
  Clock,
  Sparkles,
  ChevronDown,
  Film,
  Video,
} from 'lucide-react';
import { TMDBMedia, SeasonDetails, Episode } from '../types';
import { getMediaDetails, getSeasonDetails, getBackdropUrl, getPosterUrl, getProfileUrl, getStillUrl } from '../api/tmdb';
import ImageWithSkeleton from './ImageWithSkeleton';

interface DetailModalProps {
  media: TMDBMedia;
  onClose: () => void;
  onPlay: (media: TMDBMedia, season?: number, episode?: number) => void;
  isInMyList: (id: number) => boolean;
  onToggleMyList: (media: TMDBMedia) => void;
  onSelectRelated: (media: TMDBMedia) => void;
}

export default function DetailModal({
  media,
  onClose,
  onPlay,
  isInMyList,
  onToggleMyList,
  onSelectRelated,
}: DetailModalProps) {
  const [details, setDetails] = useState<TMDBMedia | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonData, setSeasonData] = useState<SeasonDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [activeTrailerKey, setActiveTrailerKey] = useState<string | null>(null);

  const mediaType = media.media_type || (media.first_air_date ? 'tv' : 'movie');

  // Load detailed TMDB info (credits, seasons, recommendations)
  useEffect(() => {
    if (!media?.id) {
      setIsLoadingDetails(false);
      return;
    }

    let isMounted = true;
    setIsLoadingDetails(true);
    setActiveTrailerKey(null);

    getMediaDetails(mediaType, media.id)
      .then((data) => {
        if (isMounted) {
          if (data) setDetails(data);
          setIsLoadingDetails(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load full media details:', err);
        if (isMounted) setIsLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [media.id, mediaType]);

  // Load season details when selected season changes
  useEffect(() => {
    if (mediaType !== 'tv' || !media?.id) return;

    let isMounted = true;
    getSeasonDetails(media.id, selectedSeason)
      .then((sData) => {
        if (isMounted && sData) setSeasonData(sData);
      })
      .catch((err) => console.error('Season details error:', err));

    return () => {
      isMounted = false;
    };
  }, [media.id, selectedSeason, mediaType]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const fullData = details || media;
  const title = fullData.title || fullData.name || fullData.original_title || 'Untitled Title';
  const backdropUrl = getBackdropUrl(fullData.backdrop_path, 'w1280');
  const releaseYear = (fullData.release_date || fullData.first_air_date || '').slice(0, 4) || '2024';
  const matchRate = Math.min(99, Math.max(82, Math.round((fullData.vote_average || 7.5) * 10)));
  const isSaved = isInMyList(fullData.id);

  const seasonsCount = fullData.number_of_seasons || (fullData.seasons ? fullData.seasons.length : 1);
  const runtime = fullData.runtime ? `${Math.floor(fullData.runtime / 60)}h ${fullData.runtime % 60}m` : null;

  const youtubeVideos = (fullData.videos?.results || []).filter(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip' || v.type === 'Featurette')
  );
  const mainTrailer =
    youtubeVideos.find((v) => v.type === 'Trailer') ||
    youtubeVideos.find((v) => v.type === 'Teaser') ||
    youtubeVideos[0] ||
    null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto bg-black/90 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-none sm:rounded-sm shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-40 p-2 rounded-full bg-neutral-900/90 border border-neutral-700 text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-neutral-800 bg-neutral-950">
          {/* Hero Backdrop / Active Trailer Header */}
          <div className="relative aspect-16/9 sm:aspect-21/9 w-full bg-neutral-950 overflow-hidden select-none">
            {activeTrailerKey ? (
              <div className="relative w-full h-full bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${activeTrailerKey}?autoplay=1&rel=0&enablejsapi=1`}
                  title={`${title} Trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
                <button
                  onClick={() => setActiveTrailerKey(null)}
                  className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 bg-black/85 hover:bg-black text-white text-xs font-semibold rounded-sm border border-neutral-700 transition-colors cursor-pointer shadow-lg"
                >
                  <X className="w-4 h-4 text-white" />
                  <span>Close Trailer</span>
                </button>
              </div>
            ) : (
              <>
                <ImageWithSkeleton
                  src={backdropUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                {/* Extended Gradient Fade to ensure cover never surpasses bottom gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent pointer-events-none"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/40 to-transparent pointer-events-none"></div>

                {/* Title & Action Overlay on Banner */}
                <div className="absolute bottom-6 left-6 right-6 space-y-4">
                  <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                    {title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => {
                        onClose();
                        onPlay(fullData, selectedSeason, 1);
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-bold text-sm rounded-sm hover:bg-neutral-200 active:scale-95 transition-all cursor-pointer shadow-lg"
                    >
                      <Play className="w-4 h-4 text-black fill-current" />
                      <span>Play</span>
                    </button>

                    {mainTrailer && (
                      <button
                        onClick={() => setActiveTrailerKey(mainTrailer.key)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900/90 text-white border border-neutral-700 font-semibold text-sm rounded-sm hover:border-white hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer shadow-lg"
                      >
                        <Film className="w-4 h-4 text-red-500" />
                        <span>Watch Trailer</span>
                      </button>
                    )}

                    <button
                      onClick={() => onToggleMyList(fullData)}
                      className={`flex items-center justify-center p-2.5 rounded-sm border cursor-pointer transition-colors ${
                        isSaved
                          ? 'border-white bg-white text-black'
                          : 'border-neutral-700 bg-neutral-900/80 text-white hover:border-white'
                      }`}
                      title={isSaved ? 'In My List' : 'Add to My List'}
                    >
                      {isSaved ? (
                        <Check className="w-4 h-4 text-black" />
                      ) : (
                        <Plus className="w-4 h-4 text-white" />
                      )}
                    </button>

                    <button
                      onClick={() => setIsLiked(!isLiked)}
                      className={`flex items-center justify-center p-2.5 rounded-sm border cursor-pointer transition-colors ${
                        isLiked
                          ? 'border-white text-white bg-neutral-800'
                          : 'border-neutral-700 bg-neutral-900/80 text-neutral-400 hover:text-white hover:border-white'
                      }`}
                      title="Rate Title"
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Modal Main Body Grid */}
          <div className="p-6 sm:p-8 space-y-8">
            {/* Top Meta & Synopsis Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left 2 Cols: Details & Overview */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-neutral-300">
                  <span className="text-white font-bold">{matchRate}% Match</span>
                  <span className="text-neutral-400">{releaseYear}</span>
                  <span className="px-1.5 py-0.5 border border-neutral-700 text-[10px] text-neutral-300 rounded-xs">
                    {mediaType === 'tv' ? 'TV-MA' : 'PG-13'}
                  </span>
                  {runtime && <span className="text-neutral-400">{runtime}</span>}
                  {mediaType === 'tv' && (
                    <span className="text-neutral-400">
                      {seasonsCount} {seasonsCount === 1 ? 'Season' : 'Seasons'}
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 border border-neutral-700 text-[10px] text-neutral-300 rounded-xs font-mono">
                    ULTRA HD 4K
                  </span>
                  <span className="px-1.5 py-0.5 border border-neutral-700 text-[10px] text-neutral-300 rounded-xs font-mono">
                    5.1 AUDIO
                  </span>
                </div>

                {fullData.tagline && (
                  <p className="text-sm font-medium text-neutral-400 italic">
                    "{fullData.tagline}"
                  </p>
                )}

                <p className="text-sm text-neutral-200 leading-relaxed">
                  {fullData.overview || 'No synopsis is available for this title.'}
                </p>
              </div>

              {/* Right Col: Cast, Genres, Mood */}
              <div className="space-y-3 text-xs border-t md:border-t-0 md:border-l border-neutral-800 pt-4 md:pt-0 md:pl-6">
                <div>
                  <span className="text-neutral-500 font-medium">Cast: </span>
                  <span className="text-neutral-300">
                    {fullData.cast && fullData.cast.length > 0
                      ? fullData.cast.slice(0, 4).map((c) => c.name).join(', ')
                      : 'Featured Cast'}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500 font-medium">Genres: </span>
                  <span className="text-neutral-300">
                    {fullData.genres?.map((g) => g.name).join(', ') || 'Action, Drama, Thriller'}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500 font-medium">Audio: </span>
                  <span className="text-neutral-300">English [Original], Dolby Digital 5.1</span>
                </div>

                <div>
                  <span className="text-neutral-500 font-medium">Subtitles: </span>
                  <span className="text-neutral-300">English, Spanish, French, German</span>
                </div>
              </div>
            </div>

            {/* TV Series Episodes List Section */}
            {mediaType === 'tv' && (
              <div className="space-y-4 pt-4 border-t border-neutral-900">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white tracking-tight">Episodes</h3>

                  {/* Season Dropdown Selector */}
                  {seasonsCount > 1 && (
                    <div className="relative">
                      <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(Number(e.target.value))}
                        className="bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold px-3 py-1.5 rounded-sm appearance-none pr-8 cursor-pointer focus:outline-hidden focus:border-white"
                      >
                        {Array.from({ length: seasonsCount }, (_, i) => i + 1).map((sNum) => (
                          <option key={sNum} value={sNum} className="bg-neutral-950 text-white">
                            Season {sNum}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  )}
                </div>

                {/* Episodes List Grid */}
                <div className="space-y-3">
                  {seasonData?.episodes && seasonData.episodes.length > 0 ? (
                    seasonData.episodes.map((ep: Episode) => (
                      <div
                        key={ep.id}
                        onClick={() => {
                          onClose();
                          onPlay(fullData, selectedSeason, ep.episode_number);
                        }}
                        className="group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 rounded-sm border border-neutral-900 hover:border-neutral-700 bg-neutral-950 hover:bg-neutral-900/60 transition-all cursor-pointer"
                      >
                        {/* Episode Number */}
                        <span className="text-lg font-mono font-bold text-neutral-500 group-hover:text-white shrink-0 w-6 text-center hidden sm:block">
                          {ep.episode_number}
                        </span>

                        {/* Colored Episode Thumbnail */}
                        <div className="relative w-full sm:w-36 aspect-16/9 bg-neutral-900 rounded-sm overflow-hidden shrink-0">
                          <ImageWithSkeleton
                            src={getStillUrl(ep.still_path, 'w500')}
                            alt={ep.name}
                            className="w-full h-full object-cover rounded-sm group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                            <div className="p-2 rounded-full bg-black/70 text-white group-hover:scale-110 transition-transform">
                              <Play className="w-4 h-4 text-white fill-current" />
                            </div>
                          </div>
                        </div>

                        {/* Episode Details */}
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-white group-hover:underline truncate">
                              {ep.episode_number}. {ep.name}
                            </h4>
                            {ep.runtime && (
                              <span className="text-xs text-neutral-400 font-mono shrink-0">
                                {ep.runtime}m
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                            {ep.overview || 'No episode summary available.'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-neutral-500">
                      Loading episodes for Season {selectedSeason}...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cast Members Grid */}
            {fullData.cast && fullData.cast.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-neutral-900">
                <h3 className="text-lg font-bold text-white tracking-tight">Top Billed Cast</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {fullData.cast.slice(0, 6).map((actor) => (
                    <div key={actor.id} className="space-y-1.5 text-center">
                      <div className="aspect-square rounded-full overflow-hidden bg-neutral-900 border border-neutral-800 mx-auto w-16 sm:w-20">
                        <ImageWithSkeleton
                          src={getProfileUrl(actor.profile_path, 'w185')}
                          alt={actor.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs font-semibold text-white truncate">{actor.name}</p>
                      <p className="text-[10px] text-neutral-500 truncate">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Official Trailers & Clips Gallery */}
            {youtubeVideos.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-neutral-900">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-red-500" />
                  <h3 className="text-lg font-bold text-white tracking-tight">Trailers & Clips</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {youtubeVideos.map((vid) => (
                    <div
                      key={vid.id}
                      onClick={() => {
                        setActiveTrailerKey(vid.key);
                        // Scroll top of modal to view trailer player
                        const scrollContainer = document.querySelector('.scrollbar-thin');
                        if (scrollContainer) {
                          scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className="group relative bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-sm overflow-hidden cursor-pointer transition-all"
                    >
                      <div className="relative aspect-16/9 bg-neutral-950">
                        <img
                          src={`https://img.youtube.com/vi/${vid.key}/mqdefault.jpg`}
                          alt={vid.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                          <div className="p-3 rounded-full bg-red-600/90 text-white group-hover:scale-110 transition-transform shadow-lg">
                            <Play className="w-5 h-5 text-white fill-current" />
                          </div>
                        </div>
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] font-semibold text-neutral-300 rounded-xs uppercase tracking-wider">
                          {vid.type}
                        </span>
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                          {vid.name}
                        </h4>
                        <p className="text-[10px] text-neutral-400 mt-1">YouTube • Official {vid.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
