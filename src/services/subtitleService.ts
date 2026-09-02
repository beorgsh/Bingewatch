// Subtitle and Closed Caption Service for Reels Video Trailers
import { TMDBMedia } from '../types';

export interface SubtitleCue {
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

// In-memory cache for subtitle tracks
const subtitlesCache = new Map<string, SubtitleCue[]>();

/**
 * Break overview or narration sentences into paced subtitle lines (4-7 words per line)
 */
function createPacedCues(sentences: string[], startOffset = 0): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let currentTime = startOffset;

  sentences.forEach((sentence) => {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) return;
    const words = cleanSentence.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    const chunkSize = 5;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunkWords = words.slice(i, i + chunkSize).join(' ');
      const duration = Math.max(2.4, Math.min(4.5, chunkWords.length * 0.08 + 1.2));
      cues.push({
        start: Number(currentTime.toFixed(1)),
        end: Number((currentTime + duration).toFixed(1)),
        text: chunkWords,
      });
      currentTime += duration + 0.3; // natural breath pause
    }
  });

  return cues;
}

/**
 * Generates fallback dialogue & narrative subtitle cues
 */
export function generateTrailerSubtitles(media: TMDBMedia): SubtitleCue[] {
  const title = media.title || media.name || 'Feature Presentation';
  const cues: SubtitleCue[] = [];
  let t = 0.5;

  // 1. Initial soundtrack / atmosphere cue
  cues.push({
    start: t,
    end: t + 3.0,
    text: '♪ [Dramatic trailer soundtrack playing] ♪',
  });
  t += 3.4;

  // 2. Tagline or dramatic hook
  if (media.tagline) {
    cues.push({
      start: t,
      end: t + 3.6,
      text: `"${media.tagline}"`,
    });
    t += 4.0;
  }

  // 3. Overview breakdown with cinematic phrasing
  if (media.overview) {
    const rawSentences = media.overview.match(/[^.!?]+[.!?]+/g) || [media.overview];
    const overviewCues = createPacedCues(rawSentences, t);
    cues.push(...overviewCues);
    if (overviewCues.length > 0) {
      t = overviewCues[overviewCues.length - 1].end + 0.8;
    }
  }

  // 4. Climax & Call to Action
  cues.push({
    start: t,
    end: t + 3.2,
    text: '♪ [Intense music builds to crescendo] ♪',
  });
  t += 3.6;

  cues.push({
    start: t,
    end: t + 3.8,
    text: `Experience ${title}`,
  });
  t += 4.2;

  cues.push({
    start: t,
    end: t + 4.0,
    text: 'Now Streaming on Bingewatch',
  });

  return cues;
}

/**
 * Async fetch for real YouTube dialogue transcript cues from the server
 */
export async function fetchRealTrailerSubtitles(videoId: string, media: TMDBMedia): Promise<SubtitleCue[]> {
  const cacheKey = `${videoId}_${media.id}`;
  if (subtitlesCache.has(cacheKey)) {
    return subtitlesCache.get(cacheKey)!;
  }

  if (videoId && videoId.length >= 5 && videoId !== 'active') {
    try {
      const response = await fetch(`/api/youtube-transcript/${encodeURIComponent(videoId)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.cues && Array.isArray(data.cues) && data.cues.length > 0) {
          subtitlesCache.set(cacheKey, data.cues);
          return data.cues;
        }
      }
    } catch {
      // fallback
    }
  }

  const fallback = generateTrailerSubtitles(media);
  subtitlesCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Synchronous getter with immediate fallback while async fetch resolves
 */
export function getTrailerSubtitles(videoId: string, media: TMDBMedia): SubtitleCue[] {
  const cacheKey = `${videoId}_${media.id}`;
  if (subtitlesCache.has(cacheKey)) {
    return subtitlesCache.get(cacheKey)!;
  }

  const cues = generateTrailerSubtitles(media);
  subtitlesCache.set(cacheKey, cues);
  return cues;
}

/**
 * Get the currently active subtitle line based on the playback seconds
 */
export function getActiveSubtitleText(cues: SubtitleCue[], currentSeconds: number): string | null {
  if (!cues || cues.length === 0) return null;

  const lastCue = cues[cues.length - 1];
  const maxEnd = lastCue ? lastCue.end : 30;
  const effectiveTime = maxEnd > 0 ? currentSeconds % (maxEnd + 2) : currentSeconds;

  const active = cues.find((cue) => effectiveTime >= cue.start && effectiveTime <= cue.end);
  return active ? active.text : null;
}

