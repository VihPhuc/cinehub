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

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const toastTimeoutRef = useRef<number | null>(null);

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

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToastMsg(null), 1500);
  }, []);

  useEffect(() => {
    const history = getHistory();
    const saved = history.find((h) => h.slug === movie.slug);
    if (saved?.episodeSlug && server) {
      const idx = server.server_data.findIndex((e) => e.slug === saved.episodeSlug);
      if (idx >= 0) setEpIdx(idx);
    }
  }, [movie.slug]);

  useEffect(() => {
    onEpChange?.(epIdx);
  }, [epIdx, onEpChange]);

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

    let hls: Hls | null = null;
    setMode('hls');

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hls.loadSource(ep.link_m3u8);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        if (videoRef.current) {
          videoRef.current.playbackRate = speed;
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
      if (hls) hls.destroy();
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
        showToast('Chuyển sang tập tiếp theo...');
        setEpIdx((prev) => prev + 1);
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, showToast]);

  return (
    <div className="min-h-screen bg-[#07080b] text-white flex flex-col">
      <div className="h-14 px-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300 hover:text-white cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>
        <div className="truncate px-3 text-center">
          <span className="font-bold text-sm text-zinc-100">{movie.name}</span>
          {ep && <span className="text-red-400 text-xs ml-2">({ep.name})</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-xs font-semibold cursor-pointer transition-colors border border-zinc-700/60"
            title="Sao chép liên kết tập phim"
          >
            <Share2 className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Chia sẻ</span>
          </button>
          {hasNext && (
            <button
              onClick={() => setEpIdx(epIdx + 1)}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-semibold cursor-pointer"
            >
              Tập tiếp <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-2 sm:px-4 py-4 flex-1 flex flex-col gap-4">
        <div
          ref={containerRef}
          className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-2xl group"
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
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2">
              <AlertCircle className="w-8 h-8 text-amber-500" />
              <p className="text-sm">Không thể tải luồng video.</p>
            </div>
          )}

          {/* Buffering Indicator */}
          {loading && mode === 'hls' && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/40">
              <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
            </div>
          )}

          {/* Toast / Notification */}
          {toastMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-700/80 text-white text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none transition-all">
              {toastMsg}
            </div>
          )}

          {/* Resume Notice */}
          {resumeNotice && (
            <div className="absolute bottom-16 left-4 bg-red-600/90 text-white text-xs font-semibold px-3 py-1.5 rounded shadow-lg pointer-events-none flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              {resumeNotice}
            </div>
          )}

          {/* Error & Retry Overlay */}
          {errorMsg && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-20">
              <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
              <h3 className="text-base font-bold text-white mb-1">Gặp sự cố tải luồng video</h3>
              <p className="text-xs text-zinc-400 max-w-md mb-4">{errorMsg}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={loadHlsStream}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Thử lại
                </button>
                {ep?.link_embed && (
                  <button
                    onClick={() => {
                      setErrorMsg(null);
                      setMode('iframe');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded cursor-pointer border border-zinc-700 transition-colors"
                  >
                    Chuyển sang Iframe Embed
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Shortcuts bar */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 px-1 py-0.5">
          <div className="flex flex-wrap items-center gap-3">
            <span><strong className="text-zinc-200">Phím tắt:</strong> [Space/K] Tạm dừng</span>
            <span>[← / →] Tua 10s</span>
            <span>[↑ / ↓] Âm lượng</span>
            <span>[M] Tắt tiếng</span>
            <span>[F] Toàn màn hình</span>
          </div>
          <div>
            Nguồn: <span className="text-zinc-200 font-medium">{server?.server_name || 'Mặc định'}</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-red-500" />
              <span className="text-xs font-bold text-zinc-400">Máy Chủ:</span>
              <div className="flex flex-wrap gap-1.5">
                {movie.episodes?.map((s, idx) => (
                  <button
                    key={s.server_name}
                    onClick={() => { setServerIdx(idx); setEpIdx(0); }}
                    className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                      serverIdx === idx ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {s.server_name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {mode === 'hls' && (
                <div className="flex items-center gap-1 bg-zinc-800/80 border border-zinc-700/80 rounded-lg p-0.5">
                  <span className="text-[11px] text-zinc-400 px-1.5 font-semibold">Tốc độ:</span>
                  {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                        speed === s ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}

              {ep?.link_embed && ep?.link_m3u8 && (
                <button
                  onClick={() => setMode(mode === 'hls' ? 'iframe' : 'hls')}
                  className="px-2.5 py-1 text-xs rounded bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 cursor-pointer"
                >
                  {mode === 'hls' ? 'Chuyển Embed' : 'Chuyển HLS'}
                </button>
              )}
            </div>
          </div>

          {server && server.server_data.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-xs font-bold text-zinc-400">Chọn Tập ({server.server_data.length} tập):</span>
                </div>
                {server.server_data.length > 10 && (
                  <input
                    type="text"
                    value={epFilter}
                    onChange={(e) => setEpFilter(e.target.value)}
                    placeholder="Lọc số tập (vd: 12)..."
                    className="w-36 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                )}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 max-h-48 overflow-y-auto">
                {server.server_data
                  .map((e, idx) => ({ e, idx }))
                  .filter(({ e }) =>
                    !epFilter.trim()
                      ? true
                      : e.name.toLowerCase().includes(epFilter.toLowerCase().trim()) ||
                        e.slug.toLowerCase().includes(epFilter.toLowerCase().trim())
                  )
                  .map(({ e, idx }) => (
                    <button
                      key={e.slug}
                      onClick={() => setEpIdx(idx)}
                      className={`py-1.5 px-1 rounded text-xs font-medium border truncate cursor-pointer transition-colors ${
                        epIdx === idx
                          ? 'bg-red-600 border-red-500 text-white font-bold'
                          : 'bg-zinc-800 border-zinc-700/60 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {e.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

