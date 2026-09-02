import express from "express";
import path from "path";
import axios from "axios";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const TMDB_API_KEY = process.env.TMDB_API_KEY || "0ad803880e6b039907683824e369d54a";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const MOVIE_API_BASE = process.env.MOVIE_API_BASE || "https://movieapis.vercel.app";

app.use(express.json());

// Enable CORS for all API endpoints
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Helper for TMDB requests
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

// ----------------------------------------------------
// Upstream Stream Fetchers with Multi-Server Failover
// ----------------------------------------------------
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
        validateStatus: () => true, // Avoid throwing on 404
      });
      if (streamRes.status === 200 && streamRes.data && (streamRes.data.m3u8 || streamRes.data.success)) {
        return streamRes.data;
      }
      if (streamRes.data && (streamRes.data.tracks?.length || streamRes.data.sources?.length)) {
        return streamRes.data;
      }
    } catch (e: any) {
      // try next server
    }
  }
  return null;
}

async function fetchUpstreamSeriesStream(tmdbId: string | number, season: number, episode: number, preferredServer?: string) {
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
        validateStatus: () => true, // Avoid throwing on 404
      });
      if (streamRes.status === 200 && streamRes.data && (streamRes.data.m3u8 || streamRes.data.success)) {
        return streamRes.data;
      }
      if (streamRes.data && (streamRes.data.tracks?.length || streamRes.data.sources?.length)) {
        return streamRes.data;
      }
    } catch (e: any) {
      // try next server
    }
  }
  return null;
}

// ----------------------------------------------------
// 1. Specific requested endpoint: GET /api/movie/:tmdb
// ----------------------------------------------------
app.get("/api/movie/:tmdb", async (req, res) => {
  const tmdbId = req.params.tmdb;
  const requestedServer = (req.query.server as string) || "lisbon";

  try {
    // 1. Fetch live stream data from upstream movieapis.vercel.app with multi-server failover
    const upstreamStream = await fetchUpstreamMovieStream(tmdbId, requestedServer);

    // 2. Fetch TMDB metadata
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

    // Format stream sources (Strict: only use real upstream streams, no demo fallback)
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

    // Process subtitle tracks
    const tracks = (upstreamStream?.tracks || []).map((t: any) => ({
      ...t,
      file: t.file?.startsWith("/") ? t.file : `/api/sub-vtt?url=${encodeURIComponent(t.id || t.file)}`,
    }));

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

// ----------------------------------------------------
// 2. Specific requested endpoint: GET /api/series/:tmdb/:season/:episode
// ----------------------------------------------------
app.get("/api/series/:tmdb/:season/:episode", async (req, res) => {
  const tmdbId = req.params.tmdb;
  const season = parseInt(req.params.season, 10) || 1;
  const episode = parseInt(req.params.episode, 10) || 1;
  const requestedServer = (req.query.server as string) || "lisbon";

  try {
    // 1. Fetch live stream data from upstream movieapis.vercel.app with multi-server failover
    const upstreamStream = await fetchUpstreamSeriesStream(tmdbId, season, episode, requestedServer);

    // 2. Fetch TMDB metadata
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

    // Format stream sources (Strict: only use real upstream streams, no demo fallback)
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

    // Process subtitle tracks
    const tracks = (upstreamStream?.tracks || []).map((t: any) => ({
      ...t,
      file: t.file?.startsWith("/") ? t.file : `/api/sub-vtt?url=${encodeURIComponent(t.id || t.file)}`,
    }));

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

// ----------------------------------------------------
// 2.5 Subtitle VTT Proxy Endpoint
// ----------------------------------------------------
app.get("/api/sub-vtt", async (req, res) => {
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
    res.send(response.data);
  } catch (err: any) {
    console.error("Sub VTT Proxy Error:", err.message);
    res.status(502).send("Failed to proxy subtitle VTT");
  }
});

// ----------------------------------------------------
// 3. CORS Proxy for M3U8 Manifests & Segments
// ----------------------------------------------------
app.get("/api/proxy-m3u8", async (req, res) => {
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

    // Rewrite relative URLs inside the playlist to proxy endpoints so HLS can fetch them safely
    const lines = m3u8Content.split(/\r?\n/);
    const rewrittenLines = lines.map((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        // Handle URI attribute in tags like #EXT-X-KEY, #EXT-X-MEDIA, #EXT-X-MAP, #EXT-X-I-FRAME-STREAM-INF
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

      // It's a segment or sub-playlist URL
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
    res.send(rewrittenLines.join("\n"));
  } catch (err: any) {
    console.error("M3U8 Proxy Error:", err.message);
    res.status(502).json({ error: "Failed to proxy M3U8 stream", details: err.message });
  }
});

// Proxy for binary segments (.ts, .m4s, .mp4, encryption keys) with byte range support
app.get("/api/proxy-segment", async (req, res) => {
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

    // Forward byte Range request from HLS client if present
    if (req.headers.range) {
      forwardHeaders["Range"] = req.headers.range as string;
    }

    const response = await axios.get(targetUrl, {
      responseType: "stream",
      timeout: 20000,
      headers: forwardHeaders,
      validateStatus: (status) => status < 400, // Accept 200, 206 Partial Content, etc.
    });

    // Forward response status (e.g. 200 or 206)
    res.status(response.status);

    // Forward crucial headers for HLS streaming & range requests
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

    response.data.pipe(res);
  } catch (err: any) {
    console.error("Segment Proxy Error:", err.message);
    res.status(502).send(`Error fetching segment: ${err.message}`);
  }
});

// ----------------------------------------------------
// 4. TMDB Proxy Endpoints
// ----------------------------------------------------
app.get("/api/tmdb/trending", async (req, res) => {
  try {
    const data = await fetchTmdb("/trending/all/day");
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tmdb/popular/movies", async (req, res) => {
  try {
    const data = await fetchTmdb("/movie/popular", { page: req.query.page || 1 });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tmdb/popular/series", async (req, res) => {
  try {
    const data = await fetchTmdb("/tv/popular", { page: req.query.page || 1 });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tmdb/top-rated", async (req, res) => {
  try {
    const type = req.query.type === "tv" ? "/tv/top_rated" : "/movie/top_rated";
    const data = await fetchTmdb(type, { page: req.query.page || 1 });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tmdb/discover", async (req, res) => {
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
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tmdb/search", async (req, res) => {
  const query = req.query.query as string;
  if (!query) {
    res.json({ results: [] });
    return;
  }
  try {
    const data = await fetchTmdb("/search/multi", { query, page: req.query.page || 1 });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tmdb/genres", async (req, res) => {
  try {
    const [movieGenres, tvGenres] = await Promise.all([
      fetchTmdb("/genre/movie/list"),
      fetchTmdb("/genre/tv/list"),
    ]);
    const merged = new Map();
    movieGenres.genres?.forEach((g: any) => merged.set(g.id, g));
    tvGenres.genres?.forEach((g: any) => merged.set(g.id, g));
    res.json({ genres: Array.from(merged.values()) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tmdb/details/:type/:id", async (req, res) => {
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
    res.json(data);
  } catch (err: any) {
    try {
      // Fallback without append_to_response if sub-resource failed
      const basicData = await fetchTmdb(`/${cleanType}/${id}`);
      res.json(basicData);
    } catch (innerErr: any) {
      res.status(err.response?.status || 500).json({
        error: "Failed to fetch media details",
        message: err.message,
      });
    }
  }
});

app.get("/api/tmdb/tv/:id/season/:season_number", async (req, res) => {
  const { id, season_number } = req.params;
  if (!id || id === "undefined" || id === "null" || isNaN(Number(id))) {
    res.status(400).json({ error: "Invalid TV ID parameter" });
    return;
  }
  const cleanSeason = Math.max(1, parseInt(season_number, 10) || 1);
  try {
    const data = await fetchTmdb(`/tv/${id}/season/${cleanSeason}`);
    res.json(data);
  } catch (err: any) {
    res.status(err.response?.status || 500).json({
      error: "Failed to fetch season details",
      message: err.message,
      episodes: [],
    });
  }
});

// Ensure any unmatched /api/* requests return JSON 404 instead of Vite index.html
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// ----------------------------------------------------
// 5. Vite Integration for Dev / Static for Prod
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bingewatch Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
