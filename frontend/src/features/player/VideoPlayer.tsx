import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft,
  Server,
  Film,
  SkipForward,
  AlertCircle,
  RotateCcw,
  Loader2,
  Share2,
  Timer,
  PictureInPicture2,
  HelpCircle,
  X,
  Check,
  Sparkles,
  RectangleHorizontal,
} from 'lucide-react';
import type { MovieDetail } from '@/shared/types';
import { saveHistory, getHistory, getWatchedEpisodes, markEpisodeWatched } from '@/shared/storage';
import { decideHlsRecovery } from './hlsRecovery';
import { formatMovieTitle, getImageUrl } from '@/shared/api';

// Bounded retry budget for fatal HLS errors (network/media). Prevents an
// infinite restart loop when the source is permanently unavailable.
const MAX_NETWORK_RETRIES = 3;

interface Props {
  movie: MovieDetail;
  initialServerIdx?: number;
  initialEpIdx?: number;
  resumeFromHistory?: boolean;
  onEpChange?: (epIdx: number) => void;
  onBack: () => void;
}

export const VideoPlayer: React.FC<Props> = ({
  movie,
  initialServerIdx = 0,
  initialEpIdx = 0,
  resumeFromHistory = false,
  onEpChange,
  onBack,
}) => {
  const [serverIdx, setServerIdx] = useState(initialServerIdx);
  const [epIdx, setEpIdx] = useState(() => {
    if (!resumeFromHistory || initialEpIdx > 0) return initialEpIdx;
    const history = getHistory();
    const saved = history.find((h) => h.slug === movie.slug);
    const activeServer = movie.episodes?.[initialServerIdx] || movie.episodes?.[0];
    if (saved?.episodeSlug && activeServer) {
      const idx = activeServer.server_data.findIndex((e) => e.slug === saved.episodeSlug);
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const [mode, setMode] = useState<'hls' | 'iframe'>('hls');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(1);
  const [epFilter, setEpFilter] = useState<string>('');
  const [selectedEpChunk, setSelectedEpChunk] = useState<number | null>(null);
  const [lastEpIdx, setLastEpIdx] = useState(epIdx);
  if (epIdx !== lastEpIdx) {
    setLastEpIdx(epIdx);
    setSelectedEpChunk(null);
  }
  const [theaterMode, setTheaterMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cinehub_theater_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [ambientGlow, setAmbientGlow] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cinehub_ambient_glow') !== 'false';
    } catch {
      return true;
    }
  });
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [showTimerMenu, setShowTimerMenu] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [qualities, setQualities] = useState<{ id: number; height: number; bitrate: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [watchedMap, setWatchedMap] = useState(() => getWatchedEpisodes(movie.slug));

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const speedRef = useRef(speed);
  const networkRetriesRef = useRef(0);
  const onEpChangeRef = useRef(onEpChange);
  useEffect(() => {
    onEpChangeRef.current = onEpChange;
  }, [onEpChange]);
  const lastSyncedEpRef = useRef(initialEpIdx);
  const pendingEpRef = useRef<number | null>(null);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const server = movie.episodes?.[serverIdx] || movie.episodes?.[0];
  const ep = server?.server_data?.[epIdx] || server?.server_data?.[0];
  const hasNext = Boolean(server?.server_data?.[epIdx + 1]);

  const totalEps = server?.server_data?.length || 0;
  const CHUNK_SIZE = 25;
  const epChunks = useMemo(() => {
    if (totalEps <= CHUNK_SIZE) return [];
    const count = Math.ceil(totalEps / CHUNK_SIZE);
    return Array.from({ length: count }, (_, i) => ({
      index: i,
      start: i * CHUNK_SIZE,
      end: Math.min((i + 1) * CHUNK_SIZE, totalEps),
      label: `Tập ${i * CHUNK_SIZE + 1} - ${Math.min((i + 1) * CHUNK_SIZE, totalEps)}`,
    }));
  }, [totalEps]);

  const epChunkIdx = selectedEpChunk ?? Math.floor(epIdx / CHUNK_SIZE);
  const setEpChunkIdx = (idx: number) => setSelectedEpChunk(idx);

  // Keep the player in sync with browser back/forward (App updates initialEpIdx
  // from the URL) without remounting or interrupting the current stream.
  useEffect(() => {
    if (lastSyncedEpRef.current === initialEpIdx && pendingEpRef.current === null) return;

    pendingEpRef.current = initialEpIdx;
    const length = server?.server_data.length ?? 0;
    const next = length > 0 ? Math.max(0, Math.min(initialEpIdx, length - 1)) : 0;
    Promise.resolve().then(() => {
      if (pendingEpRef.current !== initialEpIdx) return;
      pendingEpRef.current = null;
      lastSyncedEpRef.current = initialEpIdx;
      setEpIdx(next);
    });
  }, [initialEpIdx, server]);

  // Only user/auto-next actions notify App. Prop-driven sync above must not
  // echo back, otherwise popstate and onEpChange can fight in a render loop.
  const selectEpisode = (index: number) => {
    setEpIdx(index);
    onEpChange?.(index);
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (videoRef.current) {
      videoRef.current.playbackRate = s;
    }
    showToast(`Tốc độ phát: ${s}x`);
  };

  const changeQuality = (lvlIndex: number) => {
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.currentLevel = lvlIndex;
      setCurrentQuality(lvlIndex);
      const matched = qualities.find((q) => q.id === lvlIndex);
      const label = lvlIndex === -1 ? 'Tự động' : `${matched?.height || lvlIndex}p`;
      showToast(`Độ phân giải: ${label}`);
    }
  };

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToastMsg(null), 1500);
  }, []);

  const toggleTheaterMode = () => {
    setTheaterMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cinehub_theater_mode', String(next));
      } catch {
        // ignore
      }
      showToast(next ? 'Chế độ rạp phim: Bật' : 'Chế độ rạp phim: Tắt');
      return next;
    });
  };

  const toggleAmbientGlow = () => {
    setAmbientGlow((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cinehub_ambient_glow', String(next));
      } catch {
        // ignore
      }
      showToast(next ? 'Đèn rạp (Ambient Glow): Bật' : 'Đèn rạp (Ambient Glow): Tắt');
      return next;
    });
  };



  const episodeProgressMap = useMemo(() => {
    const list = getHistory();
    const map = new Map<string, number>();
    for (const h of list) {
      if (h.slug === movie.slug && h.episodeSlug) {
        const pct = h.duration > 0 ? Math.min(100, Math.round((h.currentTime / h.duration) * 100)) : 0;
        map.set(h.episodeSlug, pct);
      }
    }
    return map;
  }, [movie.slug]);

  useEffect(() => {
    if (autoNextCountdown === null) return;
    const timer = window.setTimeout(() => {
      setAutoNextCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          setEpIdx((current) => {
            const next = current + 1;
            const exists = Boolean(server?.server_data?.[next]);
            if (exists) onEpChangeRef.current?.(next);
            return exists ? next : current;
          });
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [autoNextCountdown, server]);

  useEffect(() => {
    if (sleepRemaining === null) return;
    const interval = setInterval(() => {
      setSleepRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (videoRef.current) videoRef.current.pause();
          showToast('Đã dừng phát theo hẹn giờ');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepRemaining, showToast]);

  const setTimer = (mins: number | null) => {
    setSleepRemaining(mins ? mins * 60 : null);
    setShowTimerMenu(false);
    showToast(mins ? `Hẹn giờ tắt sau ${mins} phút` : 'Đã tắt hẹn giờ');
  };

  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current && document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      showToast('Không thể bật PiP cho video này');
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?watch=${movie.slug}&ep=${epIdx}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Đã sao chép liên kết tập phim!');
    }).catch(() => {
      showToast('Không thể sao chép');
    });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const loadHlsStream = useCallback(() => {
    if (!ep) return;
    setErrorMsg(null);
    setLoading(true);

    // Always tear down the previous instance before creating a new one.
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }

    if (!ep.link_m3u8) {
      setMode('iframe');
      setLoading(false);
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setLoading(false);
      return;
    }

    setQualities([]);
    setCurrentQuality(-1);

    let hls: Hls | null = null;
    let nativeCleanup: (() => void) | null = null;

    const applyResumePosition = (video: HTMLVideoElement) => {
      const history = getHistory();
      const saved = history.find((h) => h.slug === movie.slug && h.episodeSlug === ep.slug);
      if (!saved || saved.currentTime <= 5 || saved.currentTime >= saved.duration - 15) return;
      // Duration may not be known yet (native HLS); seek after metadata arrives.
      if (video.readyState < 1) {
        video.addEventListener(
          'loadedmetadata',
          () => {
            video.currentTime = saved.currentTime;
          },
          { once: true }
        );
      } else {
        video.currentTime = saved.currentTime;
      }
      setResumeNotice(`Tiếp tục phát từ ${formatTime(saved.currentTime)}`);
      setTimeout(() => setResumeNotice(null), 3500);
    };

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hlsInstanceRef.current = hls;
      networkRetriesRef.current = 0;

      hls.loadSource(ep.link_m3u8);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        if (hls && hls.levels && hls.levels.length > 0) {
          const list = hls.levels.map((lvl, index) => ({
            id: index,
            height: lvl.height,
            bitrate: lvl.bitrate,
          }));
          setQualities(list);
          setCurrentQuality(hls.currentLevel);
        }
        if (videoRef.current) {
          videoRef.current.playbackRate = speedRef.current;
        }
        applyResumePosition(video);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        const action = decideHlsRecovery(
          data.type,
          networkRetriesRef.current,
          MAX_NETWORK_RETRIES
        );
        if (action === 'retry-network') {
          networkRetriesRef.current += 1;
          hls?.startLoad();
          return;
        }
        if (action === 'recover-media') {
          networkRetriesRef.current += 1;
          hls?.recoverMediaError();
          return;
        }
        hls?.destroy();
        hlsInstanceRef.current = null;
        setErrorMsg('Không thể tải luồng video. Bạn có thể thử lại hoặc đổi sang iframe embed.');
        setLoading(false);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari/iOS play HLS natively. Wait for metadata before seeking, and
      // surface decode/network failures instead of showing a black frame.
      const onNativeReady = () => {
        setLoading(false);
        applyResumePosition(video);
        video.play().catch(() => {});
      };
      const onNativeError = () => {
        setLoading(false);
        setErrorMsg('Không thể phát luồng HLS trên trình duyệt này. Bạn có thể đổi sang iframe embed.');
      };
      const onNativeStalled = () => {
        if (video.readyState < 3) setLoading(true);
      };

      video.addEventListener('loadedmetadata', onNativeReady, { once: true });
      video.addEventListener('error', onNativeError);
      video.addEventListener('stalled', onNativeStalled);
      video.src = ep.link_m3u8;
      video.load();

      nativeCleanup = () => {
        video.removeEventListener('loadedmetadata', onNativeReady);
        video.removeEventListener('error', onNativeError);
        video.removeEventListener('stalled', onNativeStalled);
      };
    } else {
      setMode('iframe');
      setLoading(false);
    }

    return () => {
      nativeCleanup?.();
      if (hls) {
        hls.destroy();
        if (hlsInstanceRef.current === hls) hlsInstanceRef.current = null;
      }
    };
  }, [ep, movie.slug]);

  // Reload the stream when the episode changes, when the playback mode flips back
  // to HLS, or when the user asks for a retry. `mode` must be a dependency or the
  // <video> element remounts without a source and the player stays black.
  useEffect(() => {
    if (mode !== 'hls') {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      return;
    }
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      cleanup = loadHlsStream();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (cleanup) cleanup();
    };
  }, [loadHlsStream, mode, reloadKey]);

  const retryStream = useCallback(() => {
    networkRetriesRef.current = 0;
    setErrorMsg(null);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !server || !ep) return;

    // Throttle history writes: `timeupdate` fires ~4x/sec and every write hits
    // localStorage + a storage event. Persist at most every 5 seconds.
    let lastSavedAt = 0;
    const onUpdate = () => {
      if (video.currentTime <= 3) return;
      const now = Date.now();
      if (now - lastSavedAt < 5000) return;
      lastSavedAt = now;
      saveHistory({
        movie,
        serverName: server.server_name,
        episodeSlug: ep.slug,
        episodeName: ep.name,
        currentTime: Math.floor(video.currentTime),
        duration: Math.floor(video.duration || 0),
      });

      const pct = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
      const isDone = pct >= 85;
      markEpisodeWatched(movie.slug, ep.slug, pct, isDone);
      setWatchedMap((prev) => ({
        ...prev,
        [ep.slug]: {
          progress: Math.max(prev[ep.slug]?.progress ?? 0, Math.round(pct)),
          completed: isDone || Boolean(prev[ep.slug]?.completed),
          updatedAt: Date.now(),
        },
      }));
    };

    const onEnded = () => {
      markEpisodeWatched(movie.slug, ep.slug, 100, true);
      setWatchedMap((prev) => ({
        ...prev,
        [ep.slug]: { progress: 100, completed: true, updatedAt: Date.now() },
      }));
      if (hasNext) {
        setAutoNextCountdown(5);
      }
    };

    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onError = () => {
      setLoading(false);
      setErrorMsg('Không thể tải luồng video bằng trình phát gốc. Bạn có thể thử lại hoặc đổi sang chế độ nhúng (Embed).');
    };

    video.addEventListener('timeupdate', onUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('timeupdate', onUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
    };
  }, [movie, server, ep, hasNext, showToast]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If shortcuts modal is open, let Escape dismiss it and don't manipulate video behind modal
      if (showShortcutsModal) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowShortcutsModal(false);
        }
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      const tag = activeEl?.tagName;
      // Never hijack typing in text fields.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || activeEl?.isContentEditable) return;
      // Space/arrows belong to a focused control (button, select, link, or elements with role=button) — the
      // browser handles those natively, so don't preventDefault or double-fire.
      const isInteractive =
        tag === 'BUTTON' ||
        tag === 'SELECT' ||
        tag === 'A' ||
        tag === 'OPTION' ||
        activeEl?.getAttribute('role') === 'button' ||
        Boolean(activeEl?.closest('button, select, a, [role="button"]'));
      const isSpaceOrArrow =
        e.code === 'Space' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown';
      if (isInteractive && isSpaceOrArrow) return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          if (video.paused) {
            video.play();
            showToast('Phát');
          } else {
            video.pause();
            showToast('Tạm dừng');
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          showToast('-10s');
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          showToast('+10s');
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          showToast(`Âm lượng ${Math.round(video.volume * 100)}%`);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          showToast(`Âm lượng ${Math.round(video.volume * 100)}%`);
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          video.muted = !video.muted;
          showToast(video.muted ? 'Đã tắt tiếng' : 'Đã bật tiếng');
          break;
        case 'KeyT':
          e.preventDefault();
          setTheaterMode((prev) => {
            const next = !prev;
            try {
              localStorage.setItem('cinehub_theater_mode', String(next));
            } catch {
              // ignore
            }
            showToast(next ? 'Chế độ rạp phim: Bật' : 'Chế độ rạp phim: Tắt');
            return next;
          });
          break;
        case 'KeyG':
          e.preventDefault();
          setAmbientGlow((prev) => {
            const next = !prev;
            try {
              localStorage.setItem('cinehub_ambient_glow', String(next));
            } catch {
              // ignore
            }
            showToast(next ? 'Đèn rạp (Ambient Glow): Bật' : 'Đèn rạp (Ambient Glow): Tắt');
            return next;
          });
          break;
        case 'Slash':
          if (e.shiftKey) {
            e.preventDefault();
            setShowShortcutsModal((prev) => !prev);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, showToast, showShortcutsModal]);

  return (
    <div className="min-h-screen bg-[#07080c] text-white flex flex-col font-sans relative overflow-x-hidden">
      {/* Top Bar Header */}
      <div className="sticky top-0 z-40 h-16 px-3 sm:px-6 bg-[#090a0f]/90 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between gap-2 sm:gap-3">
        {/* Back Button */}
        <button
          onClick={onBack}
          aria-label="Quay lại"
          className="flex items-center justify-center sm:justify-start gap-2 h-11 min-h-[44px] min-w-[44px] px-3 sm:px-3.5 rounded-xl glass-pill hover:bg-white/15 text-xs sm:text-sm font-bold text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/10 shrink-0 focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
          <span className="hidden sm:inline">Quay lại</span>
        </button>

        {/* Title & Current Episode */}
        <div className="min-w-0 flex-1 px-1 sm:px-4 text-left sm:text-center">
          <div className="flex items-center sm:justify-center gap-1.5 truncate">
            <span className="font-extrabold text-xs sm:text-base text-zinc-100 font-heading truncate">
              {formatMovieTitle(movie.name)}
            </span>
            {ep && (
              <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-red-600/20 text-red-400 font-bold text-[10px] sm:text-xs border border-red-500/30 shrink-0">
                {ep.name}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Sleep Timer */}
          <div className="relative">
            <button
              onClick={() => setShowTimerMenu(!showTimerMenu)}
              className={`flex items-center justify-center gap-1.5 h-11 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                sleepRemaining !== null
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                  : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/15 border-white/10'
              }`}
              title="Hẹn giờ tắt"
              aria-label="Hẹn giờ tắt video"
            >
              <Timer className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">
                {sleepRemaining !== null ? formatTime(sleepRemaining) : 'Hẹn giờ'}
              </span>
            </button>
            {showTimerMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 glass-dropdown rounded-2xl p-1.5 z-50 text-xs shadow-2xl animate-in fade-in slide-in-from-top-2">
                <div className="px-2 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08] mb-1">
                  Hẹn giờ tắt video
                </div>
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setTimer(mins)}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/10 text-zinc-200 cursor-pointer font-medium transition-colors"
                  >
                    Sau {mins} phút
                  </button>
                ))}
                {sleepRemaining !== null && (
                  <button
                    onClick={() => setTimer(null)}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-red-400 hover:bg-red-600/20 cursor-pointer font-bold transition-colors mt-1 border-t border-white/[0.08]"
                  >
                    Hủy hẹn giờ
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Ambient Glow Toggle */}
          <button
            onClick={toggleAmbientGlow}
            aria-pressed={ambientGlow}
            className={`flex items-center justify-center gap-1.5 h-11 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
              ambientGlow
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                : 'glass-pill text-zinc-400 hover:text-zinc-200 border-white/10'
            }`}
            title="Bật/Tắt ánh sáng hắt rạp phim (Phím G)"
            aria-label="Hiệu ứng ánh sáng rạp phim Ambient Glow"
          >
            <Sparkles className={`w-4 h-4 ${ambientGlow ? 'text-amber-400 fill-amber-400/30' : 'text-zinc-400'}`} />
            <span className="hidden xl:inline">{ambientGlow ? 'Đèn Rạp' : 'Tắt Đèn'}</span>
          </button>

          {/* Theater Mode (Desktop/Tablet >= md only, screen is already full width on mobile) */}
          <button
            onClick={toggleTheaterMode}
            aria-pressed={theaterMode}
            className={`hidden md:flex items-center gap-1.5 h-11 min-h-[44px] px-3 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
              theaterMode
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-500 shadow-md shadow-red-600/30 glow-red-sm'
                : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/15 border-white/10'
            }`}
            title="Chế độ rạp phim (Phím T)"
            aria-label="Chế độ rạp phim Theater Mode"
          >
            <RectangleHorizontal className="w-4 h-4" />
            <span className="hidden lg:inline">{theaterMode ? 'Thu nhỏ' : 'Rạp Phim'}</span>
          </button>

          {/* Picture in Picture */}
          {mode === 'hls' && (
            <button
              onClick={togglePip}
              className="hidden sm:flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] glass-pill hover:bg-white/15 text-zinc-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer border border-white/10 transition-all"
              title="Cửa sổ nổi (Picture-in-Picture)"
              aria-label="Cửa sổ nổi Picture-in-Picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          {/* Keyboard shortcuts (Hidden on mobile < sm) */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="hidden sm:flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] glass-pill hover:bg-white/15 text-zinc-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer border border-white/10 transition-all"
            title="Bảng phím tắt (?)"
            aria-label="Bảng phím tắt trợ năng"
          >
            <HelpCircle className="w-4 h-4 text-zinc-400" />
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 h-11 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 glass-pill hover:bg-white/15 text-zinc-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer border border-white/10 transition-all"
            title="Sao chép liên kết tập phim"
            aria-label="Chia sẻ liên kết tập phim"
          >
            <Share2 className="w-4 h-4 text-zinc-400" />
            <span className="hidden lg:inline">Chia sẻ</span>
          </button>

          {/* Next Episode Button */}
          {hasNext && (
            <button
              onClick={() => selectEpisode(epIdx + 1)}
              className="flex items-center justify-center gap-1.5 h-11 min-h-[44px] min-w-[44px] px-2.5 sm:px-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl text-xs font-black cursor-pointer shadow-md shadow-red-600/30 transition-all hover:scale-105 shrink-0"
              title="Tập tiếp theo"
              aria-label="Tập tiếp theo"
            >
              <span className="hidden sm:inline">Tập tiếp</span>
              <SkipForward className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Video Viewport & Cinema Stage */}
      <div
        className={`mx-auto w-full transition-all duration-300 flex-1 flex flex-col items-center ${
          theaterMode ? 'max-w-none px-0 py-0 bg-[#050608]' : 'max-w-[1720px] px-3 sm:px-6 lg:px-8 py-6'
        }`}
      >
        {/* Cinema Ambilight Ambient Glow Wrapper */}
        <div className={`relative w-full transition-all duration-300 ${theaterMode ? 'bg-[#040508]' : ''}`}>
          {/* Layer 1: Atmospheric dynamic glow */}
          {ambientGlow && (
            <div
              className={`absolute transition-all duration-700 pointer-events-none rounded-3xl blur-3xl ${
                theaterMode
                  ? '-inset-6 sm:-inset-10 opacity-75'
                  : '-inset-3 sm:-inset-6 opacity-65'
              }`}
              style={{
                background:
                  'radial-gradient(ellipse 90% 65% at 50% 50%, var(--theme-accent-glow) 0%, rgba(225, 29, 72, 0.16) 40%, rgba(245, 158, 11, 0.08) 70%, transparent 100%)',
              }}
            />
          )}

          {/* Layer 2: Movie backdrop reflection glow */}
          {ambientGlow && movie.poster_url && (
            <div
              className={`absolute pointer-events-none opacity-20 blur-3xl bg-cover bg-center transition-all duration-700 -z-10 ${
                theaterMode ? '-inset-8 sm:-inset-16' : '-inset-4 sm:-inset-8 rounded-3xl'
              }`}
              style={{
                backgroundImage: `url(${getImageUrl(movie.poster_url)})`,
                filter: 'blur(60px) saturate(200%)',
              }}
            />
          )}

          <div
            ref={containerRef}
            className={`relative aspect-video w-full bg-black overflow-hidden shadow-2xl group transition-all duration-300 ${
              theaterMode
                ? 'rounded-none max-h-[85vh] h-[54vw] min-h-[380px] border-b border-white/[0.08]'
                : 'rounded-2xl border border-white/[0.1] shadow-2xl shadow-black/80'
            }`}
          >
          {mode === 'hls' ? (
            <video
              ref={videoRef}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          ) : ep?.link_embed ? (
            <iframe
              src={ep.link_embed}
              title={movie.name}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
              onLoad={() => setLoading(false)}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
              <AlertCircle className="w-10 h-10 text-amber-500" />
              <p className="text-sm font-semibold">Không thể tải luồng video.</p>
            </div>
          )}

          {/* Buffering Indicator */}
          {loading && mode === 'hls' && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
            </div>
          )}

          {/* Toast Notification */}
          {toastMsg && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 glass-dropdown text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl pointer-events-none transition-all border border-white/20 animate-in fade-in slide-in-from-top-2">
              {toastMsg}
            </div>
          )}

          {/* Resume Playback Notice */}
          {resumeNotice && (
            <div className="absolute bottom-20 left-6 bg-red-600/90 backdrop-blur-md text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-xl pointer-events-none flex items-center gap-2 border border-red-400/30 animate-in fade-in">
              <RotateCcw className="w-4 h-4" />
              {resumeNotice}
            </div>
          )}

          {/* Error & Retry Overlay */}
          {errorMsg && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
              <AlertCircle className="w-14 h-14 text-red-500 mb-3" />
              <h3 className="text-lg font-black text-white font-heading mb-1.5">
                Gặp sự cố kết nối luồng video
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mb-5 leading-relaxed">{errorMsg}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={retryStream}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-red-600/30 transition-all hover:scale-105"
                >
                  <RotateCcw className="w-4 h-4" /> Thử lại
                </button>
                {ep?.link_embed && (
                  <button
                    onClick={() => {
                      setErrorMsg(null);
                      setMode('iframe');
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 glass-pill hover:bg-white/15 text-zinc-200 text-xs font-bold rounded-xl cursor-pointer border border-white/15 transition-all"
                  >
                    Chuyển sang Iframe Embed
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Auto Next Episode Countdown Overlay */}
          {autoNextCountdown !== null && hasNext && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
              <span className="text-zinc-400 text-xs uppercase tracking-widest font-black mb-2">
                Tập tiếp theo sẽ tự động phát sau
              </span>
              <div className="text-6xl font-black font-heading text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400 font-mono mb-2">
                {autoNextCountdown}s
              </div>
              <p className="text-white text-base font-bold max-w-sm truncate mb-6">
                {server?.server_data?.[epIdx + 1]?.name}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAutoNextCountdown(null)}
                  className="px-4 py-2 rounded-xl glass-pill hover:bg-white/15 text-zinc-300 text-xs font-bold cursor-pointer border border-white/15 transition-all"
                >
                  Hủy đếm ngược
                </button>
                <button
                  onClick={() => {
                    setAutoNextCountdown(null);
                    selectEpisode(epIdx + 1);
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black cursor-pointer transition-all shadow-lg shadow-red-600/40 flex items-center gap-2 hover:scale-105"
                >
                  <span>Phát ngay</span>
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls, Servers & Episodes Section */}
      <div
        className={`flex flex-col gap-4 transition-opacity ${
          theaterMode ? 'max-w-[1720px] mx-auto w-full px-4 sm:px-6 lg:px-8 pb-8 opacity-80 hover:opacity-100' : ''
        }`}
      >
        {/* Quick shortcuts info bar */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 px-2 py-1 gap-2">
          <div className="hidden sm:flex flex-wrap items-center gap-3 font-medium">
            <span>
              <strong className="text-zinc-200">Phím tắt:</strong> [Space/K] Tạm dừng
            </span>
            <span>[← / →] Tua 10s</span>
            <span>[↑ / ↓] Âm lượng</span>
            <span>[M] Tắt tiếng</span>
            <span>[T] Rạp phim</span>
            <span>[G] Đèn rạp</span>
            <span>[F] Toàn màn hình</span>
          </div>
          <div className="w-full sm:w-auto text-left sm:text-right">
            Nguồn phát:{' '}
            <span className="text-red-400 font-bold">{server?.server_name || 'Mặc định'}</span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4">
          {/* Server & Quality Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Server className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold text-zinc-300">Máy Chủ:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {movie.episodes?.map((s, idx) => (
                  <button
                    key={s.server_name}
                    onClick={() => {
                      setServerIdx(idx);
                      const targetServer = movie.episodes?.[idx];
                      if (targetServer?.server_data) {
                        const curSlug = ep?.slug;
                        const sameSlugIdx = targetServer.server_data.findIndex((e) => e.slug === curSlug);
                        if (sameSlugIdx >= 0) {
                          selectEpisode(sameSlugIdx);
                        } else if (!targetServer.server_data[epIdx]) {
                          selectEpisode(0);
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      serverIdx === idx
                        ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30 glow-red-sm scale-105'
                        : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {s.server_name}
                  </button>
                ))}
              </div>
            </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* HLS Resolution / Quality Selector */}
                {mode === 'hls' && qualities.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.1] rounded-xl px-2.5 py-1">
                    <span className="text-[11px] text-zinc-400 font-bold">Chất lượng:</span>
                    <select
                      value={currentQuality}
                      onChange={(e) => changeQuality(Number(e.target.value))}
                      className="bg-transparent text-white text-[11px] font-bold outline-none cursor-pointer py-0.5"
                    >
                      <option value={-1} className="bg-[#10121a]">Tự động</option>
                      {qualities.map((q) => (
                        <option key={q.id} value={q.id} className="bg-[#10121a]">
                          {q.height ? `${q.height}p` : `Luồng ${q.id + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Speed buttons */}
                {mode === 'hls' && (
                  <div className="flex items-center gap-1 bg-white/[0.06] border border-white/[0.1] rounded-xl p-1">
                    <span className="text-[11px] text-zinc-400 px-1.5 font-bold">Tốc độ:</span>
                    {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => changeSpeed(s)}
                        aria-pressed={speed === s}
                        className={`min-h-[36px] min-w-[36px] px-2 py-1 flex items-center justify-center rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          speed === s
                            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}

                {/* Switch Mode Button */}
                {ep?.link_embed && ep?.link_m3u8 && (
                  <button
                    onClick={() => setMode(mode === 'hls' ? 'iframe' : 'hls')}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl glass-pill hover:bg-white/15 text-zinc-200 border border-white/10 cursor-pointer transition-all"
                  >
                    {mode === 'hls' ? 'Chuyển Embed' : 'Chuyển HLS Stream'}
                  </button>
                )}
              </div>
            </div>

            {/* Episode Grid */}
            {server && server.server_data.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-red-400" />
                    <span className="text-xs sm:text-sm font-bold text-zinc-200 font-heading">
                      Danh Sách Tập ({server.server_data.length} tập):
                    </span>
                  </div>
                  {server.server_data.length > 10 && (
                    <input
                      type="text"
                      value={epFilter}
                      onChange={(e) => setEpFilter(e.target.value)}
                      placeholder="Lọc số tập (vd: 12)..."
                      className="w-40 sm:w-48 bg-white/[0.06] border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-red-500 font-medium"
                    />
                  )}
                </div>

                {/* Chunk Selector for long series */}
                {epChunks.length > 0 && !epFilter.trim() && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {epChunks.map((chunk) => (
                      <button
                        key={chunk.index}
                        type="button"
                        onClick={() => setEpChunkIdx(chunk.index)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 border ${
                          epChunkIdx === chunk.index
                            ? 'bg-gradient-to-r from-red-600 to-rose-600 border-red-500 text-white shadow-sm shadow-red-600/30 glow-red-sm'
                            : 'glass-pill border-white/10 text-zinc-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {chunk.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-56 overflow-y-auto p-1">
                  {server.server_data
                    .map((e, idx) => ({ e, idx }))
                    .filter(({ e, idx }) => {
                      if (epFilter.trim()) {
                        const q = epFilter.toLowerCase().trim();
                        return e.name.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q);
                      }
                      if (epChunks.length > 0) {
                        const chunk = epChunks[epChunkIdx] || epChunks[0];
                        return idx >= chunk.start && idx < chunk.end;
                      }
                      return true;
                    })
                    .map(({ e, idx }) => {
                      const isCurrent = epIdx === idx;
                      const watched = watchedMap[e.slug];
                      const isCompleted = Boolean(watched?.completed || (watched?.progress ?? 0) >= 85);
                      const pct = watched?.progress ?? (episodeProgressMap.get(e.slug) ?? 0);
                      return (
                        <button
                          key={e.slug}
                          onClick={() => selectEpisode(idx)}
                          aria-label={`Tập ${e.name}${isCompleted ? ' (Đã xem)' : pct > 0 ? `, đã xem ${pct}%` : ''}`}
                          title={`Tập ${e.name}${isCompleted ? ' - Đã xem xong' : pct > 0 ? ` - Đã xem ${pct}%` : ''}`}
                          className={`relative min-h-[44px] py-2 px-2.5 rounded-xl text-xs font-bold border truncate cursor-pointer transition-all flex flex-col items-center justify-center gap-0.5 overflow-hidden ${
                            isCurrent
                              ? 'bg-gradient-to-r from-red-600 to-rose-600 border-red-500 text-white shadow-md shadow-red-600/40 glow-red-sm scale-105 z-10'
                              : isCompleted
                                ? 'bg-emerald-950/20 hover:bg-emerald-950/35 border-emerald-500/35 text-emerald-300 hover:text-white shadow-sm shadow-emerald-900/20'
                                : pct > 0
                                  ? 'glass-pill border-amber-500/30 text-amber-200 hover:text-white hover:bg-white/10'
                                  : 'glass-pill border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate max-w-full">
                            <span className="truncate">{e.name}</span>
                            {isCompleted && !isCurrent && (
                              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          {pct > 0 && (
                            <div className="w-full absolute bottom-0 inset-x-0 h-1 bg-black/50 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isCurrent
                                    ? 'bg-amber-300 shadow-sm shadow-amber-300'
                                    : isCompleted
                                      ? 'bg-emerald-500'
                                      : 'bg-red-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-modal-title"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="glass-panel border-white/[0.15] rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <h3 id="shortcuts-modal-title" className="font-black text-white text-base font-heading flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-red-500" /> Phím tắt xem phim
              </h3>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
                aria-label="Đóng bảng phím tắt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-zinc-300">
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.05]">
                <span className="font-semibold text-zinc-200">Dừng / Tiếp tục</span>
                <span className="px-2.5 py-1 bg-white/[0.08] border border-white/[0.1] rounded-lg font-mono text-amber-300 font-bold">
                  Space hoặc K
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.05]">
                <span className="font-semibold text-zinc-200">Tua lùi 10 giây</span>
                <span className="px-2.5 py-1 bg-white/[0.08] border border-white/[0.1] rounded-lg font-mono text-amber-300 font-bold">
                  ←
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.05]">
                <span className="font-semibold text-zinc-200">Tua tới 10 giây</span>
                <span className="px-2.5 py-1 bg-white/[0.08] border border-white/[0.1] rounded-lg font-mono text-amber-300 font-bold">
                  →
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.05]">
                <span className="font-semibold text-zinc-200">Tăng / Giảm âm</span>
                <span className="px-2.5 py-1 bg-white/[0.08] border border-white/[0.1] rounded-lg font-mono text-amber-300 font-bold">
                  ↑ / ↓
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.05]">
                <span className="font-semibold text-zinc-200">Bật / Tắt tiếng</span>
                <span className="px-2.5 py-1 bg-white/[0.08] border border-white/[0.1] rounded-lg font-mono text-amber-300 font-bold">
                  M
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.05]">
                <span className="font-semibold text-zinc-200">Toàn màn hình</span>
                <span className="px-2.5 py-1 bg-white/[0.08] border border-white/[0.1] rounded-lg font-mono text-amber-300 font-bold">
                  F
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.05]">
                <span className="font-semibold text-zinc-200">Rạp phim (Theater Mode)</span>
                <span className="px-2.5 py-1 bg-white/[0.08] border border-white/[0.1] rounded-lg font-mono text-amber-300 font-bold">
                  T
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.05]">
                <span className="font-semibold text-zinc-200">Đèn rạp (Ambient Glow)</span>
                <span className="px-2.5 py-1 bg-white/[0.08] border border-white/[0.1] rounded-lg font-mono text-amber-300 font-bold">
                  G
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="font-semibold text-zinc-200">Mở bảng trợ giúp này</span>
                <span className="px-2.5 py-1 bg-white/[0.08] border border-white/[0.1] rounded-lg font-mono text-amber-300 font-bold">
                  Shift + ?
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowShortcutsModal(false)}
              className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl font-bold text-xs text-white cursor-pointer transition-all shadow-lg shadow-red-600/30"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

