export interface TMDBMedia {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type?: 'movie' | 'tv';
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  tagline?: string;
  status?: string;
  cast?: CastMember[];
  videos?: { results: VideoResult[] };
  seasons?: SeasonSummary[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface VideoResult {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
}

export interface SeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  overview: string;
  poster_path: string | null;
  air_date: string;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  runtime?: number;
  air_date?: string;
  vote_average?: number;
}

export interface SeasonDetails {
  id: number;
  name: string;
  season_number: number;
  overview: string;
  poster_path: string | null;
  episodes: Episode[];
}

export interface SubtitleTrack {
  id: string;
  file: string;
  label: string;
  language: string;
  kind: string;
  type?: string;
  source?: string;
  display?: string;
  default?: boolean;
}

export interface StreamSource {
  file: string;
  label: string;
  type?: string;
  quality?: string;
  proxiedUrl?: string;
  url?: string;
  isProxied?: boolean;
}

export interface MediaStreamData {
  success?: boolean;
  error?: string | null;
  isFallback?: boolean;
  server?: string;
  m3u8?: string;
  rawM3u8?: string;
  proxiedM3u8?: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  episodeOverview?: string;
  sources: StreamSource[];
  tracks?: SubtitleTrack[];
  subtitlesTotal?: number;
  nextEpisode?: {
    season: number;
    episode: number;
    title: string;
  } | null;
}

export interface CategoryRow {
  id: string;
  title: string;
  items: TMDBMedia[];
  isTop10?: boolean;
}
