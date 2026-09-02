import express, { Router, Request, Response, NextFunction } from "express";
import axios from "axios";

const app = express();
const TMDB_API_KEY = process.env.TMDB_API_KEY || "0ad803880e6b039907683824e369d54a";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const MOVIE_API_BASE = process.env.MOVIE_API_BASE || "https://movieapis.vercel.app";

app.use(express.json());

// Comprehensive CORS & Byte-Range Header Middleware for Vercel & Container environments
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range, X-Api-Version"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type"
  );
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

// Helper for TMDB API calls
async function fetchTmdb(endpoint: string, params: Record<string, any> = {}) {
  const queryParams = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: "en-US",
    ...params,
  });
  const url = `${TMDB_BASE_URL}${endpoint}?${queryParams.toString()}`;
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      Accept: "application/json",
      "User-Agent": "Bingewatch/1.0",
    },
  });
  return response.data;
}

// Stream servers failover list
const AVAILABLE_STREAM_SERVERS = ["lisbon", "nebula", "solara"];

async function fetchUpstreamMovieStream(tmdbId: string | number, preferredServer?: string) {
  const serversToTry = [
    preferredServer,
    ...AVAILABLE_STREAM_SERVERS,
    "auto",
    ""
  ].filter((s, i, arr): s is string => typeof s === "string" && arr.indexOf(s) === i);

  for (const s of serversToTry) {
    try {
      const url = `${MOVIE_API_BASE}/api/movie/${tmdbId}${s ? `?server=${encodeURIComponent(s)}` : ""}`;
      const streamRes = await axios.get(url, {
        timeout: 8000,
        headers: { Accept: "application/json" },
        validateStatus: () => true,
      });
      if (streamRes.status === 200 && streamRes.data && (streamRes.data.m3u8 || streamRes.data.success)) {
        return streamRes.data;
      }
      if (streamRes.data && (streamRes.data.tracks?.length || streamRes.data.sources?.length)) {
        return streamRes.data;
      }
    } catch {
      // try next server
    }
  }
  return null;
}

async function fetchUpstreamSeriesStream(
  tmdbId: string | number,
  season: number,
  episode: number,
  preferredServer?: string
) {
  const serversToTry = [
    preferredServer,
    ...AVAILABLE_STREAM_SERVERS,
    "auto",
    ""
  ].filter((s, i, arr): s is string => typeof s === "string" && arr.indexOf(s) === i);

  for (const s of serversToTry) {
    try {
      const url = `${MOVIE_API_BASE}/api/series/${tmdbId}/${season}/${episode}${s ? `?server=${encodeURIComponent(s)}` : ""}`;
      const streamRes = await axios.get(url, {
        timeout: 8000,
        headers: { Accept: "application/json" },
        validateStatus: () => true,
      });
      if (streamRes.status === 200 && streamRes.data && (streamRes.data.m3u8 || streamRes.data.success)) {
        return streamRes.data;
      }
      if (streamRes.data && (streamRes.data.tracks?.length || streamRes.data.sources?.length)) {
        return streamRes.data;
      }
    } catch {
      // try next server
    }
  }
  return null;
}

const apiRouter = Router();

// Health Check Endpoint
apiRouter.get("/health", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-cache");
  res.json({ status: "ok", cdn: true, vercel: true });
});

// Movie Details & Stream
apiRouter.get("/movie/:tmdb", async (req: Request, res: Response) => {
  const tmdbId = req.params.tmdb;
  const requestedServer = (req.query.server as string) || "lisbon";

  try {
    const upstreamStream = await fetchUpstreamMovieStream(tmdbId, requestedServer);

    let movieData: any = null;
    try {
      movieData = await fetchTmdb(`/movie/${tmdbId}`, {
        append_to_response: "credits,videos,recommendations,similar",
      });
    } catch (err: any) {
      console.warn(`TMDB fetch failed for movie ${tmdbId}:`, err.message);
    }

    const title = movieData?.title || `Movie #${tmdbId}`;
    const overview = movieData?.overview || "No overview available for this title.";
    const posterPath = movieData?.poster_path || null;
    const backdropPath = movieData?.backdrop_path || null;

    let sources: any[] = [];
    const hasStream = Boolean(upstreamStream?.m3u8 || (upstreamStream?.sources && upstreamStream.sources.length > 0));

    if (upstreamStream?.sources && Array.isArray(upstreamStream.sources) && upstreamStream.sources.length > 0) {
      sources = upstreamStream.sources.map((src: any) => ({
        ...src,
        url: src.file || src.url,
      }));
    } else if (upstreamStream?.m3u8) {
      sources = [
        {
          label: `Playable Master HLS (${upstreamStream.server || requestedServer})`,
          file: upstreamStream.m3u8,
          url: upstreamStream.m3u8,
          quality: "Auto HD",
          type: "hls",
        },
      ];
      if (upstreamStream.rawM3u8) {
        sources.push({
          label: "Raw Origin Stream",
          file: upstreamStream.rawM3u8,
          url: upstreamStream.rawM3u8,
          quality: "Direct Origin",
          type: "hls",
        });
      }
    }

    const tracks = (upstreamStream?.tracks || []).map((t: any) => ({
      ...t,
      file: t.file?.startsWith("/") ? t.file : `/api/sub-vtt?url=${encodeURIComponent(t.id || t.file)}`,
    }));

    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400");
    res.json({
      success: hasStream,
      error: hasStream ? null : (upstreamStream?.error || `No streaming sources found for "${title}" on server ${requestedServer}.`),
      isFallback: false,
      server: upstreamStream?.server || requestedServer,
      m3u8: hasStream ? (upstreamStream?.m3u8 || sources[0]?.url) : null,
      rawM3u8: upstreamStream?.rawM3u8 || null,
      proxiedM3u8: upstreamStream?.proxiedM3u8 || upstreamStream?.m3u8 || null,
      tmdbId: parseInt(tmdbId, 10),
      mediaType: "movie",
      title,
      overview,
      posterPath,
      backdropPath,
      releaseDate: movieData?.release_date,
      runtime: movieData?.runtime,
      voteAverage: movieData?.vote_average,
      genres: movieData?.genres,
      cast: movieData?.credits?.cast?.slice(0, 10),
      sources,
      tracks,
      subtitlesTotal: upstreamStream?.subtitlesTotal || tracks.length,
      durationMs: upstreamStream?.durationMs,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to fetch movie details", message: error.message });
  }
});

// Series Episode Details & Stream
apiRouter.get("/series/:tmdb/:season/:episode", async (req: Request, res: Response) => {
  const tmdbId = req.params.tmdb;
  const season = parseInt(req.params.season, 10) || 1;
  const episode = parseInt(req.params.episode, 10) || 1;
  const requestedServer = (req.query.server as string) || "lisbon";

  try {
    const upstreamStream = await fetchUpstreamSeriesStream(tmdbId, season, episode, requestedServer);

    let showData: any = null;
    let seasonData: any = null;

    try {
      showData = await fetchTmdb(`/tv/${tmdbId}`);
    } catch (e: any) {
      console.warn(`TMDB series fetch failed for tv/${tmdbId}:`, e.message);
    }

    try {
      seasonData = await fetchTmdb(`/tv/${tmdbId}/season/${season}`);
    } catch (e: any) {
      console.warn(`TMDB season fetch failed for tv/${tmdbId}/season/${season}:`, e.message);
    }

    const currentEpisode = seasonData?.episodes?.find((ep: any) => ep.episode_number === episode);
    const hasNextInSeason = seasonData?.episodes?.some((ep: any) => ep.episode_number === episode + 1);
    const totalSeasons = showData?.number_of_seasons || 1;

    let nextEpisode = null;
    if (hasNextInSeason) {
      const nextEpData = seasonData?.episodes?.find((ep: any) => ep.episode_number === episode + 1);
      nextEpisode = {
        season,
        episode: episode + 1,
        title: nextEpData?.name || `Episode ${episode + 1}`,
      };
    } else if (season < totalSeasons) {
      nextEpisode = {
        season: season + 1,
        episode: 1,
        title: `Season ${season + 1}, Episode 1`,
      };
    }

    const title = showData?.name || `TV Series #${tmdbId}`;
    const episodeTitle = currentEpisode?.name || `Season ${season}, Episode ${episode}`;
    const overview = currentEpisode?.overview || showData?.overview || "No description available.";
    const posterPath = showData?.poster_path || null;
    const backdropPath = currentEpisode?.still_path || showData?.backdrop_path || null;

    let sources: any[] = [];
    const hasStream = Boolean(upstreamStream?.m3u8 || (upstreamStream?.sources && upstreamStream.sources.length > 0));

    if (upstreamStream?.sources && Array.isArray(upstreamStream.sources) && upstreamStream.sources.length > 0) {
      sources = upstreamStream.sources.map((src: any) => ({
        ...src,
        url: src.file || src.url,
      }));
    } else if (upstreamStream?.m3u8) {
      sources = [
        {
          label: `Playable Master HLS (${upstreamStream.server || requestedServer})`,
          file: upstreamStream.m3u8,
          url: upstreamStream.m3u8,
          quality: "Auto HD",
          type: "hls",
        },
      ];
      if (upstreamStream.rawM3u8) {
        sources.push({
          label: "Raw Origin Stream",
          file: upstreamStream.rawM3u8,
          url: upstreamStream.rawM3u8,
          quality: "Direct Origin",
          type: "hls",
        });
      }
    }

    const tracks = (upstreamStream?.tracks || []).map((t: any) => ({
      ...t,
      file: t.file?.startsWith("/") ? t.file : `/api/sub-vtt?url=${encodeURIComponent(t.id || t.file)}`,
    }));

    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400");
    res.json({
      success: hasStream,
      error: hasStream ? null : (upstreamStream?.error || `No streaming sources found for ${title} S${season}E${episode} on server ${requestedServer}.`),
      isFallback: false,
      server: upstreamStream?.server || requestedServer,
      m3u8: hasStream ? (upstreamStream?.m3u8 || sources[0]?.url) : null,
      rawM3u8: upstreamStream?.rawM3u8 || null,
      proxiedM3u8: upstreamStream?.proxiedM3u8 || upstreamStream?.m3u8 || null,
      tmdbId: parseInt(tmdbId, 10),
      mediaType: "tv",
      title,
      season,
      episode,
      episodeTitle,
      episodeOverview: overview,
      posterPath,
      backdropPath,
      voteAverage: currentEpisode?.vote_average || showData?.vote_average,
      sources,
      tracks,
      subtitlesTotal: upstreamStream?.subtitlesTotal || tracks.length,
      durationMs: upstreamStream?.durationMs,
      nextEpisode,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to fetch series episode details", message: error.message });
  }
});

// Subtitle VTT Proxy Endpoint
apiRouter.get("/sub-vtt", async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send("Missing target URL parameter");
    return;
  }

  try {
    const upstreamUrl = `${MOVIE_API_BASE}/api/sub-vtt?url=${encodeURIComponent(targetUrl)}`;
    const response = await axios.get(upstreamUrl, {
      responseType: "text",
      timeout: 12000,
      headers: {
        Accept: "text/vtt, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    res.send(response.data);
  } catch (err: any) {
    console.error("Sub VTT Proxy Error:", err.message);
    res.status(502).send("Failed to proxy subtitle VTT");
  }
});

// CORS Proxy for M3U8 Manifests
apiRouter.get("/proxy-m3u8", async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send("Missing target URL parameter");
    return;
  }

  try {
    const origin = new URL(targetUrl).origin;
    const response = await axios.get(targetUrl, {
      responseType: "text",
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: origin,
        Origin: origin,
        Accept: "*/*",
      },
    });

    const m3u8Content = response.data;
    if (typeof m3u8Content !== "string") {
      res.status(502).send("Invalid M3U8 content received from source");
      return;
    }

    const baseUrl = new URL(targetUrl);

    const lines = m3u8Content.split(/\r?\n/);
    const rewrittenLines = lines.map((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        if (trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
            try {
              const fullUrl = new URL(uri, baseUrl.href).href;
              if (uri.includes(".m3u8") || uri.includes("m3u8")) {
                return `URI="/api/proxy-m3u8?url=${encodeURIComponent(fullUrl)}"`;
              }
              return `URI="/api/proxy-segment?url=${encodeURIComponent(fullUrl)}"`;
            } catch {
              return match;
            }
          });
        }
        return line;
      }

      try {
        const fullItemUrl = new URL(trimmed, baseUrl.href).href;
        if (trimmed.includes(".m3u8") || trimmed.includes("m3u8")) {
          return `/api/proxy-m3u8?url=${encodeURIComponent(fullItemUrl)}`;
        }
        return `/api/proxy-segment?url=${encodeURIComponent(fullItemUrl)}`;
      } catch {
        return line;
      }
    });

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600");
    res.send(rewrittenLines.join("\n"));
  } catch (err: any) {
    console.error("M3U8 Proxy Error:", err.message);
    res.status(502).json({ error: "Failed to proxy M3U8 stream", details: err.message });
  }
});

// Proxy for binary segments (.ts, .m4s, .mp4, encryption keys)
apiRouter.get("/proxy-segment", async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send("Missing target URL parameter");
    return;
  }

  try {
    const origin = new URL(targetUrl).origin;
    const forwardHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Referer: origin,
      Origin: origin,
      Accept: "*/*",
    };

    if (req.headers.range) {
      forwardHeaders["Range"] = req.headers.range as string;
    }

    const response = await axios.get(targetUrl, {
      responseType: "stream",
      timeout: 20000,
      headers: forwardHeaders,
      validateStatus: (status) => status < 400,
    });

    res.status(response.status);

    const contentType = response.headers["content-type"];
    if (typeof contentType === "string") {
      res.setHeader("Content-Type", contentType);
    }
    if (response.headers["content-range"]) {
      res.setHeader("Content-Range", response.headers["content-range"] as string);
    }
    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"] as string);
    }
    if (response.headers["accept-ranges"]) {
      res.setHeader("Accept-Ranges", response.headers["accept-ranges"] as string);
    } else {
      res.setHeader("Accept-Ranges", "bytes");
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges"
    );
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=2592000, immutable");

    response.data.pipe(res);
  } catch (err: any) {
    console.error("Segment Proxy Error:", err.message);
    res.status(502).send(`Error fetching segment: ${err.message}`);
  }
});

// TMDB Proxy Endpoints
apiRouter.get("/tmdb/trending", async (req: Request, res: Response) => {
  try {
    const data = await fetchTmdb("/trending/all/day");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/tmdb/popular/movies", async (req: Request, res: Response) => {
  try {
    const data = await fetchTmdb("/movie/popular", { page: req.query.page || 1 });
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/tmdb/popular/series", async (req: Request, res: Response) => {
  try {
    const data = await fetchTmdb("/tv/popular", { page: req.query.page || 1 });
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/tmdb/top-rated", async (req: Request, res: Response) => {
  try {
    const type = req.query.type === "tv" ? "/tv/top_rated" : "/movie/top_rated";
    const data = await fetchTmdb(type, { page: req.query.page || 1 });
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/tmdb/discover", async (req: Request, res: Response) => {
  try {
    const type = req.query.type === "tv" ? "/discover/tv" : "/discover/movie";
    const params: any = {
      sort_by: req.query.sort_by || "popularity.desc",
      page: req.query.page || 1,
    };
    if (req.query.with_genres) params.with_genres = req.query.with_genres;
    if (req.query.with_watch_providers) {
      params.with_watch_providers = req.query.with_watch_providers;
      params.watch_region = (req.query.watch_region as string) || "US";
    }
    if (req.query.with_networks) params.with_networks = req.query.with_networks;
    const data = await fetchTmdb(type, params);
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/tmdb/search", async (req: Request, res: Response) => {
  const query = req.query.query as string;
  if (!query) {
    res.json({ results: [] });
    return;
  }
  try {
    const data = await fetchTmdb("/search/multi", { query, page: req.query.page || 1 });
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=7200, stale-while-revalidate=3600");
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/tmdb/genres", async (req: Request, res: Response) => {
  try {
    const [movieGenres, tvGenres] = await Promise.all([
      fetchTmdb("/genre/movie/list"),
      fetchTmdb("/genre/tv/list"),
    ]);
    const merged = new Map();
    movieGenres.genres?.forEach((g: any) => merged.set(g.id, g));
    tvGenres.genres?.forEach((g: any) => merged.set(g.id, g));
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    res.json({ genres: Array.from(merged.values()) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/tmdb/videos/:type/:id", async (req: Request, res: Response) => {
  const { type, id } = req.params;
  if (!id || id === "undefined" || id === "null" || isNaN(Number(id))) {
    res.status(400).json({ error: "Invalid ID", results: [] });
    return;
  }
  const cleanType = type === "tv" ? "tv" : "movie";
  try {
    const data = await fetchTmdb(`/${cleanType}/${id}/videos`);
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message, results: [] });
  }
});

apiRouter.get("/tmdb/details/:type/:id", async (req: Request, res: Response) => {
  const { type, id } = req.params;
  if (!id || id === "undefined" || id === "null" || isNaN(Number(id))) {
    res.status(400).json({ error: "Invalid media ID parameter" });
    return;
  }
  const cleanType = type === "tv" ? "tv" : "movie";
  try {
    const data = await fetchTmdb(`/${cleanType}/${id}`, {
      append_to_response: "credits,videos,recommendations,similar",
    });
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    res.json(data);
  } catch (err: any) {
    try {
      const basicData = await fetchTmdb(`/${cleanType}/${id}`);
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
      res.json(basicData);
    } catch (innerErr: any) {
      res.status(err.response?.status || 500).json({
        error: "Failed to fetch media details",
        message: err.message,
      });
    }
  }
});

apiRouter.get("/tmdb/tv/:id/season/:season_number", async (req: Request, res: Response) => {
  const { id, season_number } = req.params;
  if (!id || id === "undefined" || id === "null" || isNaN(Number(id))) {
    res.status(400).json({ error: "Invalid TV ID parameter" });
    return;
  }
  const cleanSeason = Math.max(1, parseInt(season_number, 10) || 1);
  try {
    const data = await fetchTmdb(`/tv/${id}/season/${cleanSeason}`);
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    res.json(data);
  } catch (err: any) {
    res.status(err.response?.status || 500).json({
      error: "Failed to fetch season details",
      message: err.message,
      episodes: [],
    });
  }
});

// Mount router under both '/api' and '/' so it works seamlessly on Vercel Functions & Local Dev
// YouTube Real Transcript Fetcher Endpoint
apiRouter.get("/youtube-transcript/:videoId", async (req: Request, res: Response) => {
  const { videoId } = req.params;
  if (!videoId || videoId.length < 5 || videoId === "undefined" || videoId === "null") {
    res.status(400).json({ error: "Invalid video ID", cues: [] });
    return;
  }

  try {
    let cues: { start: number; end: number; text: string }[] = [];

    // 1. Attempt direct TimedText JSON fetch from YouTube
    try {
      const timedTextRes = await axios.get(
        `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=json3`,
        {
          timeout: 4000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
          validateStatus: (s) => s < 400,
        }
      );
      if (timedTextRes.data?.events && Array.isArray(timedTextRes.data.events)) {
        cues = timedTextRes.data.events
          .filter((e: any) => e.segs && Array.isArray(e.segs))
          .map((e: any) => ({
            start: Number(((e.tStartMs || 0) / 1000).toFixed(2)),
            end: Number((((e.tStartMs || 0) + (e.dDurationMs || 3000)) / 1000).toFixed(2)),
            text: e.segs
              .map((s: any) => s.utf8 || "")
              .join("")
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .trim(),
          }))
          .filter((c: any) => c.text && c.text !== "\n");
      }
    } catch {
      // Continue to fallback
    }

    // 2. If direct timedtext was empty, scrape initial player response caption tracks
    if (!cues.length) {
      try {
        const watchRes = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
          timeout: 5000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
          validateStatus: (s) => s < 400,
        });
        const match = watchRes.data?.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match && match[1]) {
          const playerResponse = JSON.parse(match[1]);
          const tracks =
            playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (tracks && tracks.length > 0) {
            const englishTrack =
              tracks.find((t: any) => t.languageCode === "en") || tracks[0];
            if (englishTrack?.baseUrl) {
              const captionRes = await axios.get(`${englishTrack.baseUrl}&fmt=json3`, {
                timeout: 5000,
                headers: { "User-Agent": "Mozilla/5.0" },
                validateStatus: (s) => s < 400,
              });
              if (captionRes.data?.events && Array.isArray(captionRes.data.events)) {
                cues = captionRes.data.events
                  .filter((e: any) => e.segs && Array.isArray(e.segs))
                  .map((e: any) => ({
                    start: Number(((e.tStartMs || 0) / 1000).toFixed(2)),
                    end: Number((((e.tStartMs || 0) + (e.dDurationMs || 3000)) / 1000).toFixed(2)),
                    text: e.segs
                      .map((s: any) => s.utf8 || "")
                      .join("")
                      .replace(/&#39;/g, "'")
                      .replace(/&quot;/g, '"')
                      .replace(/&amp;/g, '&')
                      .trim(),
                  }))
                  .filter((c: any) => c.text && c.text !== "\n");
              }
            }
          }
        }
      } catch (err: any) {
        console.warn("YouTube player caption scrape error:", err.message);
      }
    }

    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.json({ videoId, success: cues.length > 0, cues });
  } catch (err: any) {
    res.status(500).json({ error: err.message, cues: [] });
  }
});

app.use("/api", apiRouter);
app.use("/", apiRouter);

// Fallback for unmatched API routes
app.all("/api/*", (req: Request, res: Response) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

export default app;
