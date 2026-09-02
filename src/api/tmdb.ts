import { TMDBMedia, SeasonDetails, MediaStreamData } from '../types';

export interface StreamServerOption {
  id: string;
  name: string;
  desc: string;
}

export const STREAM_SERVERS: StreamServerOption[] = [
  { id: 'lisbon', name: 'Lisbon', desc: 'Primary Fast CDN' },
  { id: 'nebula', name: 'Nebula', desc: 'Edge Relay Server' },
  { id: 'solara', name: 'Solara', desc: 'High Bitrate HD' },
];

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export function getPosterUrl(path: string | null, size: 'w342' | 'w500' | 'original' = 'w500'): string {
  if (!path) return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(path: string | null, size: 'w780' | 'w1280' | 'original' = 'w1280'): string {
  if (!path) return 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=1600&auto=format&fit=crop';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getStillUrl(path: string | null, size: 'w300' | 'w500' = 'w500'): string {
  if (!path) return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800&auto=format&fit=crop';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getProfileUrl(path: string | null, size: 'w185' | 'h632' = 'w185'): string {
  if (!path) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// Helper for safe JSON fetching that avoids "Unexpected token <" HTML errors
async function fetchSafeJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return fallback;
    }
    const data = await res.json();
    return (data as T) ?? fallback;
  } catch (err) {
    return fallback;
  }
}

// API Fetchers
export async function getTrending(): Promise<TMDBMedia[]> {
  const data = await fetchSafeJson<{ results?: any[] }>('/api/tmdb/trending', { results: [] });
  return (data.results || []).filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv' || !item.media_type);
}

export async function getPopularMovies(page = 1): Promise<TMDBMedia[]> {
  const data = await fetchSafeJson<{ results?: any[] }>(`/api/tmdb/popular/movies?page=${page}`, { results: [] });
  return (data.results || []).map((item: any) => ({ ...item, media_type: 'movie' }));
}

export async function getPopularSeries(page = 1): Promise<TMDBMedia[]> {
  const data = await fetchSafeJson<{ results?: any[] }>(`/api/tmdb/popular/series?page=${page}`, { results: [] });
  return (data.results || []).map((item: any) => ({ ...item, media_type: 'tv' }));
}

export async function getTopRated(type: 'movie' | 'tv' = 'movie', page = 1): Promise<TMDBMedia[]> {
  const data = await fetchSafeJson<{ results?: any[] }>(`/api/tmdb/top-rated?type=${type}&page=${page}`, { results: [] });
  return (data.results || []).map((item: any) => ({ ...item, media_type: type }));
}

export interface StreamingPlatform {
  id: number;
  name: string;
  code: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  networkId?: number;
}

export const STREAMING_PLATFORMS: StreamingPlatform[] = [
  { id: 8, name: 'Netflix', code: 'NETFLIX', badgeBg: 'bg-red-600', badgeText: 'text-white', borderColor: 'border-red-600', networkId: 213 },
  { id: 337, name: 'Disney+', code: 'DISNEY', badgeBg: 'bg-blue-600', badgeText: 'text-white', borderColor: 'border-blue-500', networkId: 2739 },
  { id: 384, name: 'HBO Max', code: 'MAX', badgeBg: 'bg-purple-700', badgeText: 'text-white', borderColor: 'border-purple-600', networkId: 3186 },
  { id: 119, name: 'Prime Video', code: 'PRIME', badgeBg: 'bg-sky-600', badgeText: 'text-white', borderColor: 'border-sky-500', networkId: 1024 },
  { id: 350, name: 'Apple TV+', code: 'APPLE', badgeBg: 'bg-neutral-800', badgeText: 'text-white', borderColor: 'border-neutral-600', networkId: 2552 },
  { id: 15, name: 'Hulu', code: 'HULU', badgeBg: 'bg-emerald-600', badgeText: 'text-white', borderColor: 'border-emerald-500', networkId: 453 },
  { id: 531, name: 'Paramount+', code: 'PARAMOUNT', badgeBg: 'bg-blue-800', badgeText: 'text-white', borderColor: 'border-blue-700', networkId: 4330 },
];

export async function getDiscover(
  type: 'movie' | 'tv' = 'movie',
  genreId?: number,
  page = 1,
  providerId?: number,
  networkId?: number
): Promise<TMDBMedia[]> {
  const genreParam = genreId ? `&with_genres=${genreId}` : '';
  const providerParam = providerId ? `&with_watch_providers=${providerId}` : '';
  const networkParam = networkId && type === 'tv' ? `&with_networks=${networkId}` : '';
  const data = await fetchSafeJson<{ results?: any[] }>(
    `/api/tmdb/discover?type=${type}&page=${page}${genreParam}${providerParam}${networkParam}`,
    { results: [] }
  );
  return (data.results || []).map((item: any) => ({ ...item, media_type: type }));
}

export async function searchMulti(query: string): Promise<TMDBMedia[]> {
  if (!query.trim()) return [];
  const data = await fetchSafeJson<{ results?: any[] }>(`/api/tmdb/search?query=${encodeURIComponent(query)}`, { results: [] });
  return (data.results || []).filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
}

export async function getMediaDetails(type: 'movie' | 'tv', id: number): Promise<TMDBMedia | null> {
  if (!id) return null;
  const cleanType = type === 'tv' ? 'tv' : 'movie';
  const data = await fetchSafeJson<TMDBMedia | null>(`/api/tmdb/details/${cleanType}/${id}`, null);
  if (data && !data.media_type) {
    data.media_type = cleanType;
  }
  return data;
}

export async function getSeasonDetails(tvId: number, seasonNumber: number): Promise<SeasonDetails> {
  const safeSeason = seasonNumber || 1;
  const defaultSeason: SeasonDetails = {
    id: 0,
    season_number: safeSeason,
    name: `Season ${safeSeason}`,
    overview: '',
    poster_path: null,
    episodes: [],
  };
  if (!tvId) return defaultSeason;
  return await fetchSafeJson<SeasonDetails>(`/api/tmdb/tv/${tvId}/season/${safeSeason}`, defaultSeason);
}

export async function getMovieStream(tmdbId: number, server = 'lisbon'): Promise<MediaStreamData> {
  const defaultMovieStream: MediaStreamData = {
    success: false,
    error: 'Failed to fetch stream data',
    isFallback: false,
    tmdbId: tmdbId || 0,
    mediaType: 'movie',
    title: '',
    overview: '',
    posterPath: null,
    backdropPath: null,
    sources: [],
    tracks: [],
  };
  if (!tmdbId) return { ...defaultMovieStream, error: 'Invalid Movie ID' };
  return await fetchSafeJson<MediaStreamData>(
    `/api/movie/${tmdbId}?server=${encodeURIComponent(server)}`,
    defaultMovieStream
  );
}

export async function getSeriesStream(tmdbId: number, season = 1, episode = 1, server = 'lisbon'): Promise<MediaStreamData> {
  const defaultSeriesStream: MediaStreamData = {
    success: false,
    error: 'Failed to fetch stream data',
    isFallback: false,
    tmdbId: tmdbId || 0,
    mediaType: 'tv',
    title: '',
    overview: '',
    posterPath: null,
    backdropPath: null,
    season,
    episode,
    sources: [],
    tracks: [],
  };
  if (!tmdbId) return { ...defaultSeriesStream, error: 'Invalid Series ID' };
  return await fetchSafeJson<MediaStreamData>(
    `/api/series/${tmdbId}/${season}/${episode}?server=${encodeURIComponent(server)}`,
    defaultSeriesStream
  );
}
