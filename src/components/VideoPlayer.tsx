import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Moon,
  Timer,
  PictureInPicture2,
  HelpCircle,
  X,
  Check,
} from 'lucide-react';
import type { MovieDetail } from '../types';
import { saveHistory, getHistory } from '../services/storage';

interface Props {
  movie: MovieDetail;
  initialServerIdx?: number;
  initialEpIdx?: number;
  onEpChange?: (epIdx: number) => void;
  onBack: () => void;
}

export const VideoPlayer: React.FC<Props> = ({
  movie,
  initialServerIdx = 0,
  initialEpIdx = 0,
  onEpChange,
  onBack,
}) => {
  const [serverIdx, setServerIdx] = useState(initialServerIdx);
  const [epIdx, setEpIdx] = useState(initialEpIdx);
  const [mode, setMode] = useState<'hls' | 'iframe'>('hls');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(1);
  const [epFilter, setEpFilter] = useState<string>('');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [showTimerMenu, setShowTimerMenu] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [qualities, setQualities] = useState<{ id: number; height: number; bitrate: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [watchedEpSlugs, setWatchedEpSlugs] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const server = movie.episodes?.[serverIdx] || movie.episodes?.[0];
  const ep = server?.server_data?.[epIdx] || server?.server_data?.[0];
  const hasNext = Boolean(server?.server_data?.[epIdx + 1]);

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

  useEffect(() => {
    const list = getHistory();
    const slugs = list.filter((h) => h.slug === movie.slug).map((h) => h.episodeSlug);
    setWatchedEpSlugs(slugs);
    setAutoNextCountdown(null);
  }, [movie.slug, epIdx]);

  useEffect(() => {
    if (autoNextCountdown === null) return;
    if (autoNextCountdown <= 0) {
      setAutoNextCountdown(null);
      if (hasNext) {
        setEpIdx((prev) => prev + 1);
      }
      return;
    }
    const timer = window.setTimeout(() => {
      setAutoNextCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [autoNextCountdown, hasNext]);

  useEffect(() => {
    const history = getHistory();
    const saved = history.find((h) => h.slug === movie.slug);
    if (saved?.episodeSlug && server) {
      const idx = server.server_data.findIndex((e) => e.slug === saved.episodeSlug);
      if (idx >= 0) setEpIdx(idx);
    }
  }, [movie.slug, server]);

  useEffect(() => {
    onEpChange?.(epIdx);
  }, [epIdx, onEpChange]);

  useEffect(() => {
    if (sleepRemaining === null) return;
    if (sleepRemaining <= 0) {
      if (videoRef.current) videoRef.current.pause();
      showToast('Đã dừng phát theo hẹn giờ');
      setSleepRemaining(null);
      return;
    }
    const interval = setInterval(() => {
      setSleepRemaining((prev) => (prev !== null && prev > 1 ? prev - 1 : 0));
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

    if (!ep.link_m3u8) {
      setMode('iframe');
      setLoading(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    setQualities([]);
    setCurrentQuality(-1);

    let hls: Hls | null = null;
    setMode('hls');

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hlsInstanceRef.current = hls;

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
        const history = getHistory();
        const saved = history.find((h) => h.slug === movie.slug && h.episodeSlug === ep.slug);
        if (saved && saved.currentTime > 5 && saved.currentTime < (saved.duration - 15)) {
          video.currentTime = saved.currentTime;
          setResumeNotice(`Tiếp tục phát từ ${formatTime(saved.currentTime)}`);
          setTimeout(() => setResumeNotice(null), 3500);
        }
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              hlsInstanceRef.current = null;
              setErrorMsg('Không thể giải mã luồng HLS. Bạn có thể thử lại hoặc đổi sang iframe embed.');
              setLoading(false);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = ep.link_m3u8;
      video.play().catch(() => {});
      setLoading(false);
    } else {
      setMode('iframe');
      setLoading(false);
    }

    return () => {
      if (hls) {
        hls.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [ep, movie.slug]);

  useEffect(() => {
    const cleanup = loadHlsStream();
    return () => {
      if (cleanup) cleanup();
    };
  }, [loadHlsStream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !server || !ep) return;

    const onUpdate = () => {
      if (video.currentTime > 3) {
        saveHistory({
          movie,
          serverName: server.server_name,
          episodeSlug: ep.slug,
          episodeName: ep.name,
          currentTime: Math.floor(video.currentTime),
          duration: Math.floor(video.duration || 0),
        });
      }
    };

    const onEnded = () => {
      if (hasNext) {
        setAutoNextCountdown(5);
      }
    };

    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);

    video.addEventListener('timeupdate', onUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);

    return () => {
      video.removeEventListener('timeupdate', onUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
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
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (isInput) return;

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
  }, [toggleFullscreen, showToast]);

  return (
    <div className="min-h-screen bg-[#07080c] text-white flex flex-col font-sans relative">
      {/* Top Bar Header */}
      <div className="sticky top-0 z-40 h-16 px-4 sm:px-6 bg-[#090a0f]/90 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-pill hover:bg-white/15 text-xs sm:text-sm font-bold text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/10 shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
          <span>Quay lại</span>
        </button>

        <div className="truncate px-2 sm:px-4 text-center max-w-md">
          <span className="font-extrabold text-sm sm:text-base text-zinc-100 font-heading">
            {movie.name}
          </span>
          {ep && (
            <span className="px-2 py-0.5 ml-2 rounded-md bg-red-600/20 text-red-400 font-bold text-xs border border-red-500/30">
              {ep.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Sleep Timer */}
          <div className="relative">
            <button
              onClick={() => setShowTimerMenu(!showTimerMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                sleepRemaining !== null
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                  : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/15 border-white/10'
              }`}
              title="Hẹn giờ tắt"
            >
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">
                {sleepRemaining !== null ? formatTime(sleepRemaining) : 'Hẹn giờ'}
              </span>
            </button>
            {showTimerMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 glass-dropdown rounded-2xl p-1.5 z-50 text-xs shadow-2xl animate-in fade-in slide-in-from-top-2">
                <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08] mb-1">
                  Hẹn giờ tắt video
                </div>
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setTimer(mins)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-zinc-200 cursor-pointer font-medium transition-colors"
                  >
                    Sau {mins} phút
                  </button>
                ))}
                {sleepRemaining !== null && (
                  <button
                    onClick={() => setTimer(null)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-600/20 cursor-pointer font-bold transition-colors mt-1 border-t border-white/[0.08]"
                  >
                    Hủy hẹn giờ
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Theater Mode */}
          <button
            onClick={() => setTheaterMode(!theaterMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
              theaterMode
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-500 shadow-md shadow-red-600/30'
                : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/15 border-white/10'
            }`}
            title="Chế độ rạp phim"
          >
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{theaterMode ? 'Tắt Rạp' : 'Rạp Phim'}</span>
          </button>

          {/* Picture in Picture */}
          {mode === 'hls' && (
            <button
              onClick={togglePip}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 glass-pill hover:bg-white/15 text-zinc-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer border border-white/10 transition-all"
              title="Cửa sổ nổi (Picture-in-Picture)"
            >
              <PictureInPicture2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Keyboard shortcuts */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 glass-pill hover:bg-white/15 text-zinc-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer border border-white/10 transition-all"
            title="Bảng phím tắt (?)"
          >
            <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 glass-pill hover:bg-white/15 text-zinc-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer border border-white/10 transition-all"
            title="Sao chép liên kết tập phim"
          >
            <Share2 className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Chia sẻ</span>
          </button>

          {/* Next Episode Button */}
          {hasNext && (
            <button
              onClick={() => setEpIdx(epIdx + 1)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl text-xs font-black cursor-pointer shadow-md shadow-red-600/30 transition-all hover:scale-105"
            >
              <span>Tập tiếp</span>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Video Viewport */}
      <div
        className={`mx-auto w-full transition-all duration-300 flex-1 flex flex-col gap-4 ${
          theaterMode ? 'max-w-none px-0 py-0 bg-black' : 'max-w-7xl px-3 sm:px-6 py-6'
        }`}
      >
        <div
          ref={containerRef}
          className={`relative aspect-video w-full bg-black overflow-hidden shadow-2xl group ${
            theaterMode
              ? 'rounded-none max-h-[85vh]'
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
                  onClick={loadHlsStream}
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
                    setEpIdx((prev) => prev + 1);
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

        {/* Controls, Servers & Episodes Section */}
        <div
          className={`flex flex-col gap-4 transition-opacity ${
            theaterMode ? 'max-w-7xl mx-auto w-full px-4 pb-8 opacity-80 hover:opacity-100' : ''
          }`}
        >
          {/* Quick shortcuts info bar */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 px-2 py-1">
            <div className="flex flex-wrap items-center gap-3 font-medium">
              <span>
                <strong className="text-zinc-200">Phím tắt:</strong> [Space/K] Tạm dừng
              </span>
              <span>[← / →] Tua 10s</span>
              <span>[↑ / ↓] Âm lượng</span>
              <span>[M] Tắt tiếng</span>
              <span>[F] Toàn màn hình</span>
            </div>
            <div>
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
                        setEpIdx(0);
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
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
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

                <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-56 overflow-y-auto p-1">
                  {server.server_data
                    .map((e, idx) => ({ e, idx }))
                    .filter(({ e }) =>
                      !epFilter.trim()
                        ? true
                        : e.name.toLowerCase().includes(epFilter.toLowerCase().trim()) ||
                          e.slug.toLowerCase().includes(epFilter.toLowerCase().trim())
                    )
                    .map(({ e, idx }) => {
                      const isCurrent = epIdx === idx;
                      const isWatched = watchedEpSlugs.includes(e.slug);
                      return (
                        <button
                          key={e.slug}
                          onClick={() => setEpIdx(idx)}
                          className={`relative py-2 px-2 rounded-xl text-xs font-bold border truncate cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                            isCurrent
                              ? 'bg-gradient-to-r from-red-600 to-rose-600 border-red-500 text-white shadow-md shadow-red-600/40 glow-red-sm scale-105'
                              : 'glass-pill border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span className="truncate">{e.name}</span>
                          {isWatched && !isCurrent && (
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
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
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="glass-panel border-white/[0.15] rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <h3 className="font-black text-white text-base font-heading flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-red-500" /> Phím tắt xem phim
              </h3>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                aria-label="Đóng"
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

