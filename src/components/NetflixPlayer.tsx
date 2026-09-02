import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ArrowLeft,
  SkipForward,
  SkipBack,
  Loader2,
  FastForward,
  Tv,
  MessageSquare,
  Gauge,
  AlertCircle,
  SlidersHorizontal,
  Check,
  Sparkles,
  Settings,
  X,
  Maximize,
  Minimize,
} from 'lucide-react';
import { TMDBMedia, MediaStreamData, SeasonDetails, Episode } from '../types';
import { getMovieStream, getSeriesStream, getSeasonDetails, STREAM_SERVERS } from '../api/tmdb';

interface NetflixPlayerProps {
  media: TMDBMedia;
  initialSeason?: number;
  initialEpisode?: number;
  initialStartTime?: number;
  onClose: () => void;
  onPlayNext?: (season: number, episode: number) => void;
  onProgress?: (media: TMDBMedia, season: number, episode: number, currentTime: number, duration: number) => void;
}

export default function NetflixPlayer({
  media,
  initialSeason = 1,
  initialEpisode = 1,
  initialStartTime = 0,
  onClose,
  onPlayNext,
  onProgress,
}: NetflixPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const hasSeekedToInitialRef = useRef<boolean>(false);
  const lastSavedTimeRef = useRef<number>(0);

  // Gesture state
  const [seekRipple, setSeekRipple] = useState<{ direction: 'left' | 'right'; id: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const tapTimeoutRef = useRef<any>(null);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: -1, y: -1 });

  // Stream Data & Navigation State
  const [streamData, setStreamData] = useState<MediaStreamData | null>(null);
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [currentSeason, setCurrentSeason] = useState(initialSeason);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);
  const [seasonDetails, setSeasonDetails] = useState<SeasonDetails | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Menus and Popovers
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showAudioSubtitlesMenu, setShowAudioSubtitlesMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(false);
  const [showSourceSelector, setShowSourceSelector] = useState(false);

  // HLS & API Tracks
  const [qualityLevels, setQualityLevels] = useState<string[]>([]);
  const [currentQualityIndex, setCurrentQualityIndex] = useState<number>(-1); // -1 = Auto
  const [detectedQuality, setDetectedQuality] = useState<string>('1080p');
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(0);
  const [subtitleTracks, setSubtitleTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<number>(-1); // -1 = Off
  const [selectedApiSubIndex, setSelectedApiSubIndex] = useState<number>(-1); // -1 = Off
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [activeSubtitleText, setActiveSubtitleText] = useState<string>('');

  // Subtitle Customization State
  const [subFontSizePx, setSubFontSizePx] = useState<number>(24);
  const [subHeightPx, setSubHeightPx] = useState<number>(20);
  const [subBg, setSubBg] = useState<'none' | 'black-semi' | 'black-solid' | 'gray' | 'blue'>('black-semi');
  const [subColor, setSubColor] = useState<'white' | 'yellow' | 'cyan' | 'green'>('white');
  const [settingsTab, setSettingsTab] = useState<'tracks' | 'style' | 'quality'>('tracks');

  // Next Episode Auto-Countdown State
  const [showNextPrompt, setShowNextPrompt] = useState(false);

  // Hold Press 2x Speed Boost State
  const [isHolding2x, setIsHolding2x] = useState(false);
  const holdTimerRef = useRef<any>(null);
  const preHoldSpeedRef = useRef<number>(1);

  // Custom Stream URL & Server Selection
  const [customStreamInput, setCustomStreamInput] = useState('');
  const [selectedServer, setSelectedServer] = useState<string>('lisbon');
  const preservedTimeRef = useRef<number>(0);

  // Helper to seek to initial timestamp or preserved timestamp across server switches
  const applyInitialSeek = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (preservedTimeRef.current > 0) {
      const target = preservedTimeRef.current;
      if (video.duration && target >= video.duration - 5) {
        video.currentTime = 0;
      } else {
        video.currentTime = target;
      }
      return;
    }

    if (!hasSeekedToInitialRef.current && initialStartTime && initialStartTime > 0) {
      if (video.duration && initialStartTime >= video.duration - 5) {
        video.currentTime = 0;
      } else {
        video.currentTime = initialStartTime;
      }
      hasSeekedToInitialRef.current = true;
    }
  }, [initialStartTime]);

  // Reset seek state when season or episode changes
  useEffect(() => {
    hasSeekedToInitialRef.current = false;
    preservedTimeRef.current = 0;
    lastSavedTimeRef.current = 0;
  }, [currentSeason, currentEpisode, media.id]);

  // Report progress on cleanup/unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && onProgress) {
        const ct = videoRef.current.currentTime;
        const dur = videoRef.current.duration || 0;
        if (ct > 0) {
          onProgress(media, currentSeason, currentEpisode, ct, dur);
        }
      }
    };
  }, [media, currentSeason, currentEpisode, onProgress]);

  // 1. Fetch metadata and stream sources from the requested endpoints
  const loadStreamData = useCallback(async (seasonNum: number, episodeNum: number, serverName = selectedServer) => {
    if (videoRef.current && videoRef.current.currentTime > 0) {
      preservedTimeRef.current = videoRef.current.currentTime;
    }
    setIsLoadingStream(true);
    setStreamError(null);
    setShowNextPrompt(false);

    try {
      if (media.media_type === 'tv') {
        const data = await getSeriesStream(media.id, seasonNum, episodeNum, serverName);
        setStreamData(data);
        if (!data.m3u8 && (!data.sources || data.sources.length === 0)) {
          setStreamError(data.error || `No stream available for Season ${seasonNum}, Episode ${episodeNum} on server "${serverName}".`);
        }
        // Also fetch season details for in-player episodes list
        const sDetails = await getSeasonDetails(media.id, seasonNum);
        setSeasonDetails(sDetails);
      } else {
        const data = await getMovieStream(media.id, serverName);
        setStreamData(data);
        if (!data.m3u8 && (!data.sources || data.sources.length === 0)) {
          setStreamError(data.error || `No stream available for "${data.title || 'this title'}" on server "${serverName}".`);
        }
      }
    } catch (err: any) {
      console.error('Failed to load stream data:', err);
      setStreamError('Could not fetch streaming data from API. Please try switching servers or enter a custom stream URL.');
    } finally {
      setIsLoadingStream(false);
    }
  }, [media.id, media.media_type, selectedServer]);

  useEffect(() => {
    loadStreamData(currentSeason, currentEpisode, selectedServer);
  }, [currentSeason, currentEpisode, selectedServer, loadStreamData]);

  // 2. Initialize HLS when stream source or video element changes
  const initHls = useCallback((streamUrl: string) => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    // Clean up existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIsBuffering(true);
    setStreamError(null);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsBuffering(false);
        const levels = data.levels.map((lvl) => (lvl.height ? `${lvl.height}p` : 'Auto'));
        setQualityLevels(levels);
        if (data.levels[0]?.height) {
          setDetectedQuality(`${data.levels[0].height}p`);
        }
        applyInitialSeek();
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (data.level !== undefined && hls.levels[data.level]) {
          const lvlHeight = hls.levels[data.level].height;
          if (lvlHeight) {
            setDetectedQuality(`${lvlHeight}p`);
          }
        }
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
        const tracks = data.audioTracks.map((t, idx) => ({
          id: idx,
          name: t.name || `Track ${idx + 1}`,
          lang: t.lang || 'en',
        }));
        setAudioTracks(tracks);
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
        const subs = data.subtitleTracks.map((s, idx) => ({
          id: idx,
          name: s.name || `Subtitles ${idx + 1}`,
          lang: s.lang || 'en',
        }));
        setSubtitleTracks(subs);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS Network error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal HLS error:', data);
              setStreamError('Playback failed for this stream source. Please switch server or select another stream source.');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS for Safari
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        applyInitialSeek();
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
    } else {
      setStreamError('HLS playback is not supported in this browser.');
    }
  }, [applyInitialSeek]);

  useEffect(() => {
    if (!streamData) return;
    const sources = streamData.sources || [];
    const currentSource = sources[selectedSourceIndex] || sources[0];
    const streamUrl = currentSource?.file || currentSource?.url || streamData.m3u8;
    if (streamUrl) {
      initHls(streamUrl);
    } else {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setIsBuffering(false);
      setStreamError(streamData.error || 'No stream available for this title on the selected server.');
    }
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamData, selectedSourceIndex, initHls]);

  // Subtitle synchronization & listener
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCueChange = () => {
      let foundText = '';
      if (selectedApiSubIndex === -1 && currentSubtitleTrack === -1) {
        setActiveSubtitleText('');
        return;
      }
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if (track.mode !== 'disabled' && track.activeCues && track.activeCues.length > 0) {
          foundText = Array.from(track.activeCues)
            .map((cue: any) => cue.text || '')
            .join('\n');
          break;
        }
      }
      setActiveSubtitleText(foundText);
    };

    const syncTracks = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        const t = video.textTracks[i];
        if (t.mode === 'showing') {
          t.mode = 'hidden';
        }
        t.oncuechange = handleCueChange;
      }
    };

    syncTracks();
    video.textTracks.onaddtrack = () => syncTracks();
    video.textTracks.onchange = () => syncTracks();

    const interval = setInterval(handleCueChange, 200);
    return () => clearInterval(interval);
  }, [selectedApiSubIndex, currentSubtitleTrack]);

  // 3. User Controls & Video Events
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const handleSeekbarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      video.volume = volume || 0.5;
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  const handleQualityChange = (index: number) => {
    setCurrentQualityIndex(index);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
    }
    setShowQualityMenu(false);
  };

  const handleAudioTrackChange = (index: number) => {
    setCurrentAudioTrack(index);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = index;
    }
  };

  const handleSubtitleTrackChange = (index: number) => {
    setCurrentSubtitleTrack(index);
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = index;
    }
  };

  // Helper to lock screen orientation to landscape in fullscreen
  const lockLandscape = useCallback(async () => {
    try {
      const orientation = window.screen?.orientation as any;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape').catch(() => {});
      } else if (typeof (window.screen as any)?.lockOrientation === 'function') {
        (window.screen as any).lockOrientation('landscape');
      }
    } catch {}
  }, []);

  // Helper to unlock screen orientation
  const unlockLandscape = useCallback(() => {
    try {
      const orientation = window.screen?.orientation as any;
      if (orientation && typeof orientation.unlock === 'function') {
        orientation.unlock();
      } else if (typeof (window.screen as any)?.unlockOrientation === 'function') {
        (window.screen as any).unlockOrientation();
      }
    } catch {}
  }, []);

  // Fullscreen change listener and auto-enter fullscreen on player launch
  useEffect(() => {
    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(inFullscreen);
      if (inFullscreen) {
        lockLandscape();
      } else {
        unlockLandscape();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Auto-enter fullscreen mode immediately when player mounts
    const enterFullscreen = () => {
      if (containerRef.current && !document.fullscreenElement) {
        containerRef.current.requestFullscreen?.().then(() => {
          lockLandscape();
        }).catch(() => {});
      }
    };

    enterFullscreen();

    // Trigger on first click/touch anywhere in player if browser required user gesture
    const handleFirstActivation = () => {
      enterFullscreen();
      window.removeEventListener('click', handleFirstActivation);
      window.removeEventListener('touchstart', handleFirstActivation);
    };

    window.addEventListener('click', handleFirstActivation, { once: true });
    window.addEventListener('touchstart', handleFirstActivation, { once: true });

    return () => {
      unlockLandscape();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('click', handleFirstActivation);
      window.removeEventListener('touchstart', handleFirstActivation);
    };
  }, [lockLandscape, unlockLandscape]);

  const handleClosePlayer = () => {
    unlockLandscape();
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    onClose();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().then(() => {
          lockLandscape();
        }).catch((err) => console.warn(err));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          unlockLandscape();
        }).catch((err) => console.warn(err));
      }
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP error:', e);
    }
  };

  // Prev Episode / Rewind Action
  const playPrevEpisode = () => {
    if (media.media_type === 'tv') {
      if (currentEpisode > 1) {
        const prevS = currentSeason;
        const prevE = currentEpisode - 1;
        setCurrentSeason(prevS);
        setCurrentEpisode(prevE);
        if (onPlayNext) onPlayNext(prevS, prevE);
        return;
      } else if (currentSeason > 1) {
        const prevS = currentSeason - 1;
        const prevE = 1;
        setCurrentSeason(prevS);
        setCurrentEpisode(prevE);
        if (onPlayNext) onPlayNext(prevS, prevE);
        return;
      }
    }
    seek(-10);
  };

  // Next Episode / Fast Forward Action
  const playNextEpisode = () => {
    if (streamData?.nextEpisode) {
      const nextS = streamData.nextEpisode.season;
      const nextE = streamData.nextEpisode.episode;
      setCurrentSeason(nextS);
      setCurrentEpisode(nextE);
      if (onPlayNext) onPlayNext(nextS, nextE);
    } else if (media.media_type === 'tv') {
      const nextS = currentSeason;
      const nextE = currentEpisode + 1;
      setCurrentSeason(nextS);
      setCurrentEpisode(nextE);
      if (onPlayNext) onPlayNext(nextS, nextE);
    } else {
      seek(10);
    }
  };

  // Sync refs to prevent stale closure and synthetic event race conditions
  const showControlsRef = useRef(showControls);
  useEffect(() => {
    showControlsRef.current = showControls;
  }, [showControls]);

  const isAnyMenuOpen =
    showSpeedMenu ||
    showAudioSubtitlesMenu ||
    showQualityMenu ||
    showEpisodesDrawer ||
    showSourceSelector;
  const isAnyMenuOpenRef = useRef(isAnyMenuOpen);
  useEffect(() => {
    isAnyMenuOpenRef.current = isAnyMenuOpen;
  }, [isAnyMenuOpen]);

  // 4. Reactive Auto-hide controls logic on inactivity (2.5 seconds)
  useEffect(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }

    if (isPlaying && showControls && !isAnyMenuOpen && !isBuffering) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowAudioSubtitlesMenu(false);
        setShowQualityMenu(false);
        setShowSourceSelector(false);
      }, 2500);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
    };
  }, [isPlaying, showControls, isAnyMenuOpen, isBuffering]);

  // Pointer move handler (for desktop mouse cursor movement only)
  const handlePointerMove = (e: React.PointerEvent) => {
    // Strictly ignore touch events to avoid conflicting with tap gestures
    if (e.pointerType === 'touch') {
      return;
    }

    const dx = Math.abs(e.clientX - lastMousePosRef.current.x);
    const dy = Math.abs(e.clientY - lastMousePosRef.current.y);
    if (dx < 4 && dy < 4) return;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (!showControlsRef.current) {
      setShowControls(true);
    } else {
      // Reset timer countdown on active mouse movement
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      if (isPlaying && !isAnyMenuOpen && !isBuffering) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 2500);
      }
    }
  };

  // Hold Press for 2x Playback Speed Boost
  const handlePointerDownContainer = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [role="button"], .interactive-zone')) {
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      if (videoRef.current) {
        preHoldSpeedRef.current = playbackSpeed;
        videoRef.current.playbackRate = 2.0;
        setIsHolding2x(true);
      }
    }, 280);
  };

  const handlePointerUpContainer = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHolding2x) {
      if (videoRef.current) {
        videoRef.current.playbackRate = preHoldSpeedRef.current || 1;
      }
      setIsHolding2x(false);
    }
  };

  // 5. Gesture Tap & Double Tap Handler (Touch / Click)
  const handleGestureTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [role="button"], .interactive-zone')) {
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = e.clientX;
    const clickXRatio = (clientX - rect.left) / rect.width;
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    const wasVisibleAtTapTime = showControlsRef.current;

    if (timeSinceLastTap < 300) {
      // Double Tap detected!
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      lastTapTimeRef.current = 0;

      if (clickXRatio < 0.42) {
        // Left side double tap: Seek -10s
        seek(-10);
        setSeekRipple({ direction: 'left', id: now });
        setTimeout(() => setSeekRipple(null), 650);
      } else if (clickXRatio > 0.58) {
        // Right side double tap: Seek +10s
        seek(10);
        setSeekRipple({ direction: 'right', id: now });
        setTimeout(() => setSeekRipple(null), 650);
      } else {
        // Center double tap: toggle play
        togglePlay();
      }
      // If controls were hidden, double tap keeps them hidden
    } else {
      // Single Tap detected: evaluate after 240ms buffer to allow double-tap
      lastTapTimeRef.current = now;
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);

      tapTimeoutRef.current = setTimeout(() => {
        tapTimeoutRef.current = null;

        // If any menu/drawer is currently open, tap closes menus and keeps controls visible
        if (isAnyMenuOpenRef.current) {
          setShowSpeedMenu(false);
          setShowAudioSubtitlesMenu(false);
          setShowQualityMenu(false);
          setShowEpisodesDrawer(false);
          setShowSourceSelector(false);
          setShowControls(true);
          return;
        }

        // Explicitly set controls based on initial tap state
        if (wasVisibleAtTapTime) {
          setShowControls(false);
        } else {
          setShowControls(true);
        }
      }, 240);
    }
  };

  // 6. Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          seek(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          seek(10);
          break;
        case 'arrowup':
          e.preventDefault();
          if (videoRef.current) {
            const v = Math.min(1, videoRef.current.volume + 0.1);
            videoRef.current.volume = v;
            setVolume(v);
          }
          break;
        case 'arrowdown':
          e.preventDefault();
          if (videoRef.current) {
            const v = Math.max(0, videoRef.current.volume - 0.1);
            videoRef.current.volume = v;
            setVolume(v);
          }
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'escape':
          // If in fullscreen, exit fullscreen cleanly without closing the player
          if (document.fullscreenElement) {
            e.preventDefault();
            document.exitFullscreen().catch(() => {});
          }
          // Do NOT close player on Escape - only back button closes player
          break;
      }
      setShowControls(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen, onClose, volume]);

  // Format seconds to HH:MM:SS or MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const title = streamData?.title || media.title || media.name || 'Bingewatch Stream';
  const episodeTitle = streamData?.episodeTitle || (media.media_type === 'tv' ? `S${currentSeason}:E${currentEpisode}` : '');

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden font-sans"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        crossOrigin="anonymous"
        className="w-full h-full object-contain cursor-pointer"
        onLoadedMetadata={() => {
          if (videoRef.current && videoRef.current.videoHeight > 0) {
            setDetectedQuality(`${videoRef.current.videoHeight}p`);
          }
        }}
        onTimeUpdate={() => {
          if (!videoRef.current) return;
          const ct = videoRef.current.currentTime;
          const dur = videoRef.current.duration || 0;
          setCurrentTime(ct);
          setDuration(dur);
          if (ct > 0) {
            preservedTimeRef.current = ct;
          }

          if (videoRef.current.videoHeight > 0) {
            const vh = `${videoRef.current.videoHeight}p`;
            if (vh !== detectedQuality) {
              setDetectedQuality(vh);
            }
          }

          // Report progress every second
          if (onProgress && ct > 0 && Math.abs(ct - lastSavedTimeRef.current) >= 1) {
            lastSavedTimeRef.current = ct;
            onProgress(media, currentSeason, currentEpisode, ct, dur);
          }

          // Calculate buffered percentage
          if (videoRef.current.buffered.length > 0) {
            const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
            setBufferedPercent(dur > 0 ? (end / dur) * 100 : 0);
          }

          // Trigger binge next episode prompt in last 20 seconds
          if (dur > 30 && dur - ct <= 20 && streamData?.nextEpisode && !showNextPrompt) {
            setShowNextPrompt(true);
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (streamData?.nextEpisode) {
            playNextEpisode();
          }
        }}
      >
        {/* Active API Subtitle Track */}
        {selectedApiSubIndex >= 0 && streamData?.tracks?.[selectedApiSubIndex] && (
          <track
            key={`${selectedApiSubIndex}-${streamData.tracks[selectedApiSubIndex].file}`}
            kind="subtitles"
            src={streamData.tracks[selectedApiSubIndex].file}
            srcLang={streamData.tracks[selectedApiSubIndex].language || 'en'}
            label={streamData.tracks[selectedApiSubIndex].display || streamData.tracks[selectedApiSubIndex].label}
            default
          />
        )}
      </video>

      {/* Transparent Gesture Touch Plane */}
      <div
        onClick={handleGestureTap}
        onPointerDown={handlePointerDownContainer}
        onPointerUp={handlePointerUpContainer}
        onPointerCancel={handlePointerUpContainer}
        className="absolute inset-0 z-20 cursor-pointer touch-none"
      />

      {/* Double Tap Seek Feedback Ripple Indicators */}
      <AnimatePresence>
        {seekRipple?.direction === 'left' && (
          <motion.div
            key={`seek-left-${seekRipple.id}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.35 }}
            className="absolute left-10 sm:left-24 top-1/2 -translate-y-1/2 pointer-events-none z-40 flex flex-col items-center justify-center p-6 text-white"
          >
            <RotateCcw className="w-12 h-12 text-white drop-shadow-lg" />
            <span className="text-sm font-black text-white mt-1.5 tracking-wider font-mono drop-shadow-md">
              10 seconds
            </span>
          </motion.div>
        )}

        {seekRipple?.direction === 'right' && (
          <motion.div
            key={`seek-right-${seekRipple.id}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.35 }}
            className="absolute right-10 sm:right-24 top-1/2 -translate-y-1/2 pointer-events-none z-40 flex flex-col items-center justify-center p-6 text-white"
          >
            <RotateCw className="w-12 h-12 text-white drop-shadow-lg" />
            <span className="text-sm font-black text-white mt-1.5 tracking-wider font-mono drop-shadow-md">
              10 seconds
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffering Spinner when controls are hidden */}
      {!showControls && (isBuffering || isLoadingStream) && !streamError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Loader2 className="w-12 h-12 text-white animate-spin drop-shadow-2xl" />
        </div>
      )}

      {/* 2x Speed Holding HUD Indicator */}
      {isHolding2x && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 bg-black/90 border border-neutral-700 px-4 py-1.5 rounded-full flex items-center gap-2 pointer-events-none shadow-2xl animate-pulse">
          <FastForward className="w-4 h-4 text-white fill-current animate-bounce" />
          <span className="text-xs font-bold text-white tracking-wider uppercase font-mono">2X Speeding</span>
        </div>
      )}

      {/* Subtitle Layer (Placed in clean overlay layer above controls with customizable style, font size, height, and bg) */}
      {activeSubtitleText && (
        <div
          style={{
            bottom: `${(showControls ? 76 : 16) + subHeightPx}px`,
          }}
          className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none z-30 transition-all duration-200 max-w-3xl px-4 w-full"
        >
          <span
            style={{
              fontSize: `${subFontSizePx}px`,
              ...(subBg === 'none'
                ? {
                    WebkitTextStroke: '1px #000000',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.95)',
                  }
                : {}),
            }}
            className={`inline-block px-3.5 py-1.5 rounded-xs select-none leading-snug transition-all ${
              subBg === 'none'
                ? 'bg-transparent font-bold'
                : subBg === 'black-solid'
                ? 'bg-black shadow-2xl border border-neutral-900'
                : subBg === 'gray'
                ? 'bg-neutral-900/95 shadow-2xl border border-neutral-800'
                : subBg === 'blue'
                ? 'bg-blue-950/95 shadow-2xl border border-blue-900'
                : 'bg-black/85 shadow-2xl border border-neutral-900'
            } ${
              subColor === 'yellow'
                ? 'text-yellow-300'
                : subColor === 'cyan'
                ? 'text-cyan-300'
                : subColor === 'green'
                ? 'text-emerald-300'
                : 'text-white'
            }`}
          >
            {activeSubtitleText}
          </span>
        </div>
      )}

      {/* Error State Overlay */}
      {streamError && (
        <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
          <AlertCircle className="w-12 h-12 text-white mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Stream Unavailable</h3>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">{streamError}</p>

          {/* Quick Server Switch Options */}
          <div className="w-full bg-neutral-900 border border-neutral-800 p-4 rounded-xs mb-6 text-left">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Try Alternate Server
              </span>
              <span className="text-[10px] text-neutral-400">
                Active: {selectedServer}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STREAM_SERVERS.map((srv) => (
                <button
                  key={srv.id}
                  onClick={() => {
                    setSelectedServer(srv.id);
                    loadStreamData(currentSeason, currentEpisode, srv.id);
                  }}
                  className={`py-2 px-2.5 rounded-xs border text-center transition-colors cursor-pointer text-xs ${
                    selectedServer === srv.id
                      ? 'border-white bg-white text-black font-bold'
                      : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <p className="font-semibold">{srv.name}</p>
                  <p className="text-[9px] opacity-70 truncate">{srv.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setShowSourceSelector(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white font-semibold text-xs uppercase tracking-wider rounded-xs hover:bg-neutral-800 border border-neutral-700 cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-white" />
              <span>Custom Stream URL</span>
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded-xs hover:bg-neutral-200 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-black" />
              <span>Back to Browse</span>
            </button>
          </div>
        </div>
      )}

      {/* Binge Auto-Next Overlay */}
      {showNextPrompt && streamData?.nextEpisode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-28 right-6 z-40 bg-neutral-950/95 border border-neutral-800 p-4 rounded-sm shadow-2xl max-w-xs"
        >
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-neutral-400">
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>UP NEXT IN BINGEWATCH</span>
          </div>
          <p className="text-sm font-bold text-white mb-1">{streamData.nextEpisode.title}</p>
          <p className="text-xs text-neutral-400 mb-4">
            Season {streamData.nextEpisode.season}, Episode {streamData.nextEpisode.episode}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={playNextEpisode}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white text-black text-xs font-bold rounded-xs hover:bg-neutral-200 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-black fill-current" />
              <span>Play Now</span>
            </button>
            <button
              onClick={() => setShowNextPrompt(false)}
              className="px-3 py-2 bg-neutral-900 text-neutral-300 text-xs font-medium rounded-xs hover:bg-neutral-800 border border-neutral-700 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}

      {/* Slide-in / Slide-out Controls Overlay */}
      <AnimatePresence>
        {showControls && (
          <>
            {/* Top Header Bar Slide from Top */}
            <motion.div
              key="top-header"
              initial={{ y: -80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -80, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                background:
                  'linear-gradient(to bottom, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.75) 25%, rgba(0, 0, 0, 0.45) 50%, rgba(0, 0, 0, 0.2) 75%, rgba(0, 0, 0, 0.05) 90%, rgba(0, 0, 0, 0) 100%)',
              }}
              className="absolute top-0 left-0 right-0 z-30 p-4 sm:p-8 flex items-center justify-between pointer-events-auto interactive-zone"
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={handleClosePlayer}
                  className="p-2 text-white hover:text-neutral-300 transition-colors cursor-pointer"
                  title="Back to Browse"
                >
                  <ArrowLeft className="w-6 h-6 text-white" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-xl font-bold text-white drop-shadow-md">
                      {title}
                    </h2>
                  </div>
                  {episodeTitle && (
                    <p className="text-xs sm:text-sm text-neutral-300 font-medium">
                      {episodeTitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Stream Source Badge */}
              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={() => setShowSourceSelector(!showSourceSelector)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
                  <span>
                    {currentQualityIndex === -1
                      ? `Auto (${detectedQuality})`
                      : streamData?.sources[selectedSourceIndex]?.quality || detectedQuality}
                  </span>
                </button>
              </div>
            </motion.div>

            {/* Center Controls Overlay: [Prev] [Play/Pause / Loader] [Next] */}
            <motion.div
              key="center-controls"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
            >
              <div className="flex items-center justify-center gap-8 sm:gap-14 pointer-events-auto interactive-zone">
                {/* Previous Button */}
                <button
                  onClick={playPrevEpisode}
                  className="p-3 text-white hover:text-neutral-300 active:scale-90 transition-transform cursor-pointer drop-shadow-xl"
                  title={media.media_type === 'tv' ? 'Previous Episode / Rewind 10s' : 'Rewind 10s'}
                >
                  <SkipBack className="w-8 h-8 sm:w-12 sm:h-12 text-white fill-current" />
                </button>

                {/* Dynamic Center Button: Loader or Play/Pause */}
                {isLoadingStream || (isBuffering && !streamError) ? (
                  <div className="p-3 sm:p-4 text-white flex items-center justify-center">
                    <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 text-white animate-spin drop-shadow-2xl" />
                  </div>
                ) : (
                  <button
                    onClick={togglePlay}
                    className="p-3 sm:p-4 text-white hover:text-neutral-300 active:scale-90 transition-transform cursor-pointer drop-shadow-2xl"
                    title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  >
                    {isPlaying ? (
                      <Pause className="w-12 h-12 sm:w-16 sm:h-16 text-white fill-current" />
                    ) : (
                      <Play className="w-12 h-12 sm:w-16 sm:h-16 text-white fill-current ml-1" />
                    )}
                  </button>
                )}

                {/* Next Button */}
                <button
                  onClick={playNextEpisode}
                  className="p-3 text-white hover:text-neutral-300 active:scale-90 transition-transform cursor-pointer drop-shadow-xl"
                  title={media.media_type === 'tv' ? 'Next Episode / Fast Forward 10s' : 'Fast Forward 10s'}
                >
                  <SkipForward className="w-8 h-8 sm:w-12 sm:h-12 text-white fill-current" />
                </button>
              </div>
            </motion.div>

            {/* Bottom Netflix Control Panel Slide from Bottom */}
            <motion.div
              key="bottom-controls"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                background:
                  'linear-gradient(to top, rgba(0, 0, 0, 0.98) 0%, rgba(0, 0, 0, 0.85) 25%, rgba(0, 0, 0, 0.55) 50%, rgba(0, 0, 0, 0.25) 75%, rgba(0, 0, 0, 0.08) 90%, rgba(0, 0, 0, 0) 100%)',
              }}
              className="absolute bottom-0 left-0 right-0 z-30 p-4 sm:p-8 space-y-3 pointer-events-auto interactive-zone"
            >
              {/* Seekbar with Buffer & Progress Indicators */}
              <div className="relative group/seeker flex items-center">
                {/* Background Track */}
                <div className="absolute left-0 right-0 h-1 bg-neutral-800 group-hover/seeker:h-2 rounded-xs transition-all pointer-events-none">
                  {/* Buffered Bar */}
                  <div
                    className="h-full bg-neutral-600/70 rounded-xs"
                    style={{ width: `${bufferedPercent}%` }}
                  ></div>
                </div>

                {/* Elapsed Progress Bar */}
                <div
                  className="absolute left-0 h-1 bg-white group-hover/seeker:h-2 rounded-xs pointer-events-none"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                ></div>

                {/* Native Range Input Scrubber */}
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeekbarChange}
                  className="w-full h-3 opacity-0 cursor-pointer z-10"
                />
              </div>

              {/* Control Buttons Bar */}
              <div className="flex items-center justify-between gap-4">
                {/* Left Controls: Time Display */}
                <div className="flex items-center gap-3 sm:gap-5">
                  {/* Time Display */}
                  <div className="text-xs sm:text-sm font-mono text-neutral-400 select-none">
                    <span className="text-white">{formatTime(currentTime)}</span> / {formatTime(duration)}
                  </div>
                </div>

                {/* Right Controls: Episodes Drawer, Audio/Subtitles, Speed, Fullscreen */}
                <div className="flex items-center gap-2 sm:gap-4 relative">
                  {/* TV Series Episodes Drawer Toggle */}
                  {media.media_type === 'tv' && (
                    <button
                      onClick={() => setShowEpisodesDrawer(!showEpisodesDrawer)}
                      className={`text-white hover:text-neutral-300 transition-colors cursor-pointer p-1 ${
                        showEpisodesDrawer ? 'text-white' : 'text-neutral-400'
                      }`}
                      title="Episodes List"
                    >
                      <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </button>
                  )}

                  {/* Audio & Subtitles Menu Toggle */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowAudioSubtitlesMenu(!showAudioSubtitlesMenu);
                        setShowSpeedMenu(false);
                        setShowQualityMenu(false);
                      }}
                      className="text-white hover:text-neutral-300 transition-colors cursor-pointer p-1"
                      title="Audio & Subtitles"
                    >
                      <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </button>

                    {/* Audio, Subtitles & Custom Styling Dropdown */}
                    {showAudioSubtitlesMenu && (
                      <div className="absolute bottom-12 right-0 w-72 sm:w-80 bg-neutral-950 border border-neutral-800 rounded-sm p-3 shadow-2xl text-xs space-y-3 z-50">
                        {/* Tab Headers */}
                        <div className="flex items-center gap-1 border-b border-neutral-800 pb-2">
                          <button
                            onClick={() => setSettingsTab('tracks')}
                            className={`flex-1 py-1 text-center font-bold text-[10px] uppercase tracking-wider rounded-xs cursor-pointer transition-colors ${
                              settingsTab === 'tracks'
                                ? 'bg-white text-black font-extrabold'
                                : 'text-neutral-400 hover:text-white bg-neutral-900'
                            }`}
                          >
                            Tracks
                          </button>
                          <button
                            onClick={() => setSettingsTab('style')}
                            className={`flex-1 py-1 text-center font-bold text-[10px] uppercase tracking-wider rounded-xs cursor-pointer transition-colors ${
                              settingsTab === 'style'
                                ? 'bg-white text-black font-extrabold'
                                : 'text-neutral-400 hover:text-white bg-neutral-900'
                            }`}
                          >
                            Sub Style
                          </button>
                          <button
                            onClick={() => setSettingsTab('quality')}
                            className={`flex-1 py-1 text-center font-bold text-[10px] uppercase tracking-wider rounded-xs cursor-pointer transition-colors ${
                              settingsTab === 'quality'
                                ? 'bg-white text-black font-extrabold'
                                : 'text-neutral-400 hover:text-white bg-neutral-900'
                            }`}
                          >
                            Quality
                          </button>
                        </div>

                        {settingsTab === 'tracks' && (
                          <div className="space-y-3">
                            <div>
                              <p className="font-bold text-white uppercase text-[10px] tracking-wider mb-1 border-b border-neutral-900 pb-1">
                                Audio Tracks
                              </p>
                              <div className="space-y-1">
                                {audioTracks.length > 0 ? (
                                  audioTracks.map((t) => (
                                    <button
                                      key={t.id}
                                      onClick={() => handleAudioTrackChange(t.id)}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xs cursor-pointer ${
                                        currentAudioTrack === t.id
                                          ? 'bg-white text-black font-semibold'
                                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                                      }`}
                                    >
                                      <span>{t.name}</span>
                                      {currentAudioTrack === t.id && <Check className="w-3.5 h-3.5" />}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-2 py-1 text-neutral-500">Default Stereo Audio</div>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between border-b border-neutral-900 pb-1 mb-1">
                                <p className="font-bold text-white uppercase text-[10px] tracking-wider">
                                  Subtitles {streamData?.tracks?.length ? `(${streamData.tracks.length})` : ''}
                                </p>
                              </div>

                              {(streamData?.tracks?.length || 0) > 8 && (
                                <div className="mb-2">
                                  <input
                                    type="text"
                                    placeholder="Filter language (e.g. English)..."
                                    value={subSearchQuery}
                                    onChange={(e) => setSubSearchQuery(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full bg-neutral-900 border border-neutral-700 text-white text-[11px] px-2 py-1 rounded-xs placeholder-neutral-500 focus:outline-hidden focus:border-white"
                                  />
                                </div>
                              )}

                              <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700">
                                <button
                                  onClick={() => {
                                    handleSubtitleTrackChange(-1);
                                    setSelectedApiSubIndex(-1);
                                    setActiveSubtitleText('');
                                  }}
                                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xs cursor-pointer ${
                                    currentSubtitleTrack === -1 && selectedApiSubIndex === -1
                                      ? 'bg-white text-black font-semibold'
                                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                                  }`}
                                >
                                  <span>Off</span>
                                  {currentSubtitleTrack === -1 && selectedApiSubIndex === -1 && (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {subtitleTracks.map((s) => (
                                  <button
                                    key={`hls-${s.id}`}
                                    onClick={() => {
                                      setSelectedApiSubIndex(-1);
                                      handleSubtitleTrackChange(s.id);
                                    }}
                                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xs cursor-pointer ${
                                      currentSubtitleTrack === s.id && selectedApiSubIndex === -1
                                        ? 'bg-white text-black font-semibold'
                                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                                    }`}
                                  >
                                    <span>{s.name} (Embedded)</span>
                                    {currentSubtitleTrack === s.id && selectedApiSubIndex === -1 && (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                ))}

                                {(streamData?.tracks || [])
                                  .map((track, idx) => ({ track, idx }))
                                  .filter(({ track }) => {
                                    if (!subSearchQuery.trim()) return true;
                                    const q = subSearchQuery.toLowerCase();
                                    return (
                                      track.label?.toLowerCase().includes(q) ||
                                      track.language?.toLowerCase().includes(q) ||
                                      track.display?.toLowerCase().includes(q)
                                    );
                                  })
                                  .map(({ track, idx }) => (
                                    <button
                                      key={`api-${track.id || idx}`}
                                      onClick={() => {
                                        handleSubtitleTrackChange(-1);
                                        setSelectedApiSubIndex(idx);
                                      }}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xs cursor-pointer ${
                                        selectedApiSubIndex === idx
                                          ? 'bg-white text-black font-semibold'
                                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                                      }`}
                                    >
                                      <span className="truncate pr-2">
                                        {track.display || track.label || track.language.toUpperCase()}
                                      </span>
                                      {selectedApiSubIndex === idx && <Check className="w-3.5 h-3.5 shrink-0" />}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {settingsTab === 'style' && (
                          <div className="space-y-3.5">
                            {/* Font Size (Range slider up to 50px) */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-bold text-white uppercase text-[10px] tracking-wider">
                                  Text Size (Font)
                                </p>
                                <span className="text-[10px] font-mono text-neutral-300 bg-neutral-900 px-1.5 py-0.5 rounded-xs border border-neutral-800">
                                  {subFontSizePx}px
                                </span>
                              </div>
                              <input
                                type="range"
                                min="12"
                                max="50"
                                step="1"
                                value={subFontSizePx}
                                onChange={(e) => setSubFontSizePx(Number(e.target.value))}
                                className="w-full h-1.5 bg-neutral-800 accent-white rounded-lg cursor-pointer"
                              />
                              <div className="flex justify-between text-[9px] text-neutral-500 font-mono mt-0.5">
                                <span>12px</span>
                                <span>25px</span>
                                <span>50px</span>
                              </div>
                            </div>

                            {/* Position / Height Offset (Range slider up to 50px) */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-bold text-white uppercase text-[10px] tracking-wider">
                                  Vertical Height Offset
                                </p>
                                <span className="text-[10px] font-mono text-neutral-300 bg-neutral-900 px-1.5 py-0.5 rounded-xs border border-neutral-800">
                                  {subHeightPx}px
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="50"
                                step="1"
                                value={subHeightPx}
                                onChange={(e) => setSubHeightPx(Number(e.target.value))}
                                className="w-full h-1.5 bg-neutral-800 accent-white rounded-lg cursor-pointer"
                              />
                              <div className="flex justify-between text-[9px] text-neutral-500 font-mono mt-0.5">
                                <span>0px</span>
                                <span>25px</span>
                                <span>50px</span>
                              </div>
                            </div>

                            {/* Background Color including Off / None option */}
                            <div>
                              <p className="font-bold text-white uppercase text-[10px] tracking-wider mb-1">
                                Background Box
                              </p>
                              <div className="grid grid-cols-3 gap-1">
                                {[
                                  { id: 'none', label: 'Off (1px Stroke)' },
                                  { id: 'black-semi', label: 'Semi Black' },
                                  { id: 'black-solid', label: 'Solid Black' },
                                  { id: 'gray', label: 'Dark Gray' },
                                  { id: 'blue', label: 'Navy Blue' },
                                ].map((opt) => (
                                  <button
                                    key={opt.id}
                                    onClick={() => setSubBg(opt.id as any)}
                                    className={`py-1 px-1 text-[10px] font-semibold rounded-xs border text-center transition-colors cursor-pointer truncate ${
                                      subBg === opt.id
                                        ? 'border-white bg-white text-black font-bold'
                                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Text Color */}
                            <div>
                              <p className="font-bold text-white uppercase text-[10px] tracking-wider mb-1">
                                Text Color
                              </p>
                              <div className="grid grid-cols-4 gap-1">
                                {[
                                  { id: 'white', label: 'White' },
                                  { id: 'yellow', label: 'Yellow' },
                                  { id: 'cyan', label: 'Cyan' },
                                  { id: 'green', label: 'Green' },
                                ].map((opt) => (
                                  <button
                                    key={opt.id}
                                    onClick={() => setSubColor(opt.id as any)}
                                    className={`py-1 text-[10px] font-semibold rounded-xs border text-center transition-colors cursor-pointer ${
                                      subColor === opt.id
                                        ? 'border-white bg-white text-black font-bold'
                                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {settingsTab === 'quality' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between border-b border-neutral-900 pb-1">
                              <p className="font-bold text-white uppercase text-[10px] tracking-wider">
                                Streaming Resolution
                              </p>
                              <span className="text-[10px] text-neutral-400 font-mono font-medium">
                                Active: {detectedQuality}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {[
                                { index: -1, label: `Auto (${detectedQuality})` },
                                { index: 0, label: '1080p Ultra HD' },
                                { index: 1, label: '720p HD' },
                                { index: 2, label: '480p SD' },
                                { index: 3, label: '360p Mobile' },
                              ].map((q) => (
                                <button
                                  key={q.index}
                                  onClick={() => handleQualityChange(q.index)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xs cursor-pointer ${
                                    currentQualityIndex === q.index
                                      ? 'bg-white text-black font-bold'
                                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                                  }`}
                                >
                                  <span>{q.label}</span>
                                  {currentQualityIndex === q.index && <Check className="w-3.5 h-3.5" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Playback Speed Menu */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowSpeedMenu(!showSpeedMenu);
                        setShowAudioSubtitlesMenu(false);
                        setShowQualityMenu(false);
                      }}
                      className="text-white hover:text-neutral-300 transition-colors cursor-pointer p-1 font-mono text-xs flex items-center gap-1"
                      title="Playback Speed"
                    >
                      <Gauge className="w-5 h-5 text-white" />
                      <span className="hidden sm:inline">{playbackSpeed}x</span>
                    </button>

                    {/* Speed Dropdown */}
                    {showSpeedMenu && (
                      <div className="absolute bottom-12 right-0 w-36 bg-neutral-950 border border-neutral-800 rounded-sm p-2 shadow-2xl text-xs space-y-1 z-50">
                        <p className="font-bold text-white uppercase text-[10px] tracking-wider px-2 py-1 border-b border-neutral-800">
                          Speed
                        </p>
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                          <button
                            key={spd}
                            onClick={() => handleSpeedChange(spd)}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xs cursor-pointer ${
                              playbackSpeed === spd
                                ? 'bg-white text-black font-semibold'
                                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                            }`}
                          >
                            <span>{spd === 1 ? 'Normal (1x)' : `${spd}x`}</span>
                            {playbackSpeed === spd && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Fullscreen Landscape Toggle */}
                    <button
                      onClick={toggleFullscreen}
                      className="text-white hover:text-neutral-300 transition-colors cursor-pointer p-1"
                      title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (Landscape)'}
                    >
                      {isFullscreen ? (
                        <Minimize className="w-5 h-5 text-white" />
                      ) : (
                        <Maximize className="w-5 h-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* In-Player TV Series Episodes Drawer */}
      <AnimatePresence>
        {showEpisodesDrawer && media.media_type === 'tv' && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute top-0 right-0 bottom-0 w-80 sm:w-96 bg-neutral-950/95 border-l border-neutral-800 z-50 flex flex-col p-4 shadow-2xl backdrop-blur-md overflow-hidden"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Episodes</h3>
                <p className="text-xs text-neutral-400">Season {currentSeason}</p>
              </div>
              <button
                onClick={() => setShowEpisodesDrawer(false)}
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {seasonDetails?.episodes && seasonDetails.episodes.length > 0 ? (
                seasonDetails.episodes.map((ep: Episode) => {
                  const isCurrent = ep.episode_number === currentEpisode;
                  return (
                    <div
                      key={ep.id}
                      onClick={() => {
                        setCurrentEpisode(ep.episode_number);
                        setShowEpisodesDrawer(false);
                      }}
                      className={`flex gap-3 p-2 rounded-xs border transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-white bg-neutral-900 text-white'
                          : 'border-neutral-900 bg-neutral-950/60 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="relative w-24 aspect-16/9 bg-neutral-900 shrink-0 overflow-hidden rounded-xs">
                        {ep.still_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                            alt={ep.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-600">
                            EP {ep.episode_number}
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-current" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {ep.episode_number}. {ep.name}
                        </p>
                        <p className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5">
                          {ep.overview || 'No episode summary available.'}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  Loading season episode catalog...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stream Sources / Custom M3U8 Tester Modal Inside Player */}
      <AnimatePresence>
        {showSourceSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowSourceSelector(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-950 border border-neutral-800 rounded-sm max-w-md w-full p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-white" />
                  <span>Stream Sources & M3U8</span>
                </h3>
                <button
                  onClick={() => setShowSourceSelector(false)}
                  className="text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stream Server Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Streaming Server
                  </p>
                  <span className="text-[10px] text-neutral-400">
                    Active: {streamData?.server || selectedServer}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STREAM_SERVERS.map((srv) => (
                    <button
                      key={srv.id}
                      onClick={() => {
                        const currentPos = videoRef.current ? videoRef.current.currentTime : currentTime;
                        if (currentPos > 0) {
                          preservedTimeRef.current = currentPos;
                        }
                        setSelectedServer(srv.id);
                        loadStreamData(currentSeason, currentEpisode, srv.id);
                      }}
                      className={`py-2 px-2 rounded-xs border text-center transition-colors cursor-pointer ${
                        selectedServer === srv.id
                          ? 'border-white bg-white text-black font-bold'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <p className="text-xs font-semibold">{srv.name}</p>
                      <p className="text-[9px] opacity-70 truncate">{srv.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Available Sources */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Available HLS Stream Sources
                </p>
                {streamData?.sources?.map((src, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const currentPos = videoRef.current ? videoRef.current.currentTime : currentTime;
                      if (currentPos > 0) {
                        preservedTimeRef.current = currentPos;
                      }
                      setSelectedSourceIndex(idx);
                      initHls(src.url);
                      setShowSourceSelector(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xs border text-left cursor-pointer transition-colors ${
                      selectedSourceIndex === idx
                        ? 'border-white bg-neutral-900 text-white'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold">{src.label}</p>
                      <p className="text-[10px] text-neutral-500 truncate max-w-xs">{src.url}</p>
                    </div>
                    {selectedSourceIndex === idx && <Check className="w-4 h-4 text-white shrink-0 ml-2" />}
                  </button>
                ))}
              </div>

              {/* Custom M3U8 Input */}
              <div className="pt-2 border-t border-neutral-800 space-y-2">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Play Custom M3U8 URL
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://example.com/stream.m3u8"
                    value={customStreamInput}
                    onChange={(e) => setCustomStreamInput(e.target.value)}
                    className="flex-1 bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-white placeholder-neutral-500 rounded-xs focus:outline-hidden focus:border-white"
                  />
                  <button
                    onClick={() => {
                      if (customStreamInput.trim()) {
                        initHls(customStreamInput.trim());
                        setShowSourceSelector(false);
                      }
                    }}
                    className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xs hover:bg-neutral-200 cursor-pointer"
                  >
                    Play
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
