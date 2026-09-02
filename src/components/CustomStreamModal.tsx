import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Play, SlidersHorizontal, ShieldCheck, HelpCircle } from 'lucide-react';
import { TMDBMedia } from '../types';

interface CustomStreamModalProps {
  onClose: () => void;
  onPlayCustom: (customMedia: TMDBMedia, streamUrl: string) => void;
}

const POPULAR_TEST_STREAMS = [
  {
    title: "Big Buck Bunny (Master Multi-Bitrate HLS)",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    type: "movie" as const,
  },
  {
    title: "Sintel Multi-Audio & Subtitles (HLS Master)",
    url: "https://bitmovin-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    type: "movie" as const,
  },
  {
    title: "Tears of Steel (Adaptive 1080p HLS)",
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    type: "movie" as const,
  },
  {
    title: "4K MPEG-TS Stream Test",
    url: "https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8",
    type: "movie" as const,
  }
];

export default function CustomStreamModal({ onClose, onPlayCustom }: CustomStreamModalProps) {
  const [streamUrl, setStreamUrl] = useState('');
  const [title, setTitle] = useState('Custom Stream');
  const [useProxy, setUseProxy] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamUrl.trim()) return;

    let finalUrl = streamUrl.trim();
    if (useProxy) {
      finalUrl = `/api/proxy-m3u8?url=${encodeURIComponent(finalUrl)}`;
    }

    const mockMedia: TMDBMedia = {
      id: Math.floor(Math.random() * 900000) + 100000,
      title: title.trim() || 'Custom M3U8 Stream',
      overview: `Playing custom HLS stream: ${finalUrl}`,
      poster_path: null,
      backdrop_path: null,
      media_type: 'movie',
      vote_average: 8.5,
      vote_count: 100,
    };

    onPlayCustom(mockMedia, finalUrl);
    onClose();
  };

  const handleSelectPreset = (preset: typeof POPULAR_TEST_STREAMS[0]) => {
    setStreamUrl(preset.url);
    setTitle(preset.title);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-950 border border-neutral-800 rounded-sm max-w-lg w-full p-6 space-y-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-white" />
            <h2 className="text-lg font-bold text-white">Play Custom M3U8 Stream</h2>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Stream Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. My Test Movie / Stream"
              className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white rounded-xs focus:outline-hidden focus:border-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              M3U8 Stream URL (.m3u8)
            </label>
            <input
              type="url"
              required
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://example.com/live/stream.m3u8"
              className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white rounded-xs focus:outline-hidden focus:border-white font-mono"
            />
          </div>

          {/* CORS Proxy Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="corsProxy"
              checked={useProxy}
              onChange={(e) => setUseProxy(e.target.checked)}
              className="w-4 h-4 accent-white rounded-xs cursor-pointer"
            />
            <label htmlFor="corsProxy" className="text-xs text-neutral-300 cursor-pointer select-none">
              Route through Bingewatch CORS Proxy (/api/proxy-m3u8)
            </label>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
              Or Try Verified HLS Test Streams:
            </span>
            <div className="grid grid-cols-1 gap-2">
              {POPULAR_TEST_STREAMS.map((preset, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleSelectPreset(preset)}
                  className="text-left text-xs p-2.5 bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  <p className="font-semibold">{preset.title}</p>
                  <p className="text-[10px] text-neutral-500 truncate font-mono">{preset.url}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-white text-black font-bold text-xs rounded-xs hover:bg-neutral-200 cursor-pointer shadow-md"
            >
              <Play className="w-3.5 h-3.5 text-black fill-current" />
              <span>Launch Stream</span>
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
