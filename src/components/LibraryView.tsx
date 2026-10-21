import React, { useState, useRef } from 'react';
import { Bookmark, History, Trash2, Play, Download, Upload, Search, AlertCircle, CheckCircle2, X } from 'lucide-react';
import type { FavoriteItem, HistoryItem } from '../types';
import { getImageUrl, formatMovieTitle } from '../services/api';
import { exportUserData, importUserData } from '../services/storage';

interface Props {
  favorites: FavoriteItem[];
  history: HistoryItem[];
  onSelectMovie: (slug: string) => void;
  onResumePlay: (h: HistoryItem) => void;
  onRemoveFav: (slug: string) => void;
  onRemoveHistoryItem: (slug: string, episodeSlug: string) => void;
  onClearHistory: () => void;
  onDataImported?: () => void;
}

export const LibraryView: React.FC<Props> = ({
  favorites,
  history,
  onSelectMovie,
  onResumePlay,
  onRemoveFav,
  onRemoveHistoryItem,
  onClearHistory,
  onDataImported,
}) => {
  const [tab, setTab] = useState<'favorites' | 'history'>('favorites');
  const [filterQuery, setFilterQuery] = useState('');
  const [importNotice, setImportNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFavs = favorites.filter((f) =>
    !filterQuery.trim()
      ? true
      : f.name.toLowerCase().includes(filterQuery.toLowerCase().trim()) ||
        (f.origin_name && f.origin_name.toLowerCase().includes(filterQuery.toLowerCase().trim())) ||
        (f.year && String(f.year).includes(filterQuery.trim()))
  );

  const filteredHistory = history.filter((h) =>
    !filterQuery.trim()
      ? true
      : h.name.toLowerCase().includes(filterQuery.toLowerCase().trim()) ||
        h.episodeName.toLowerCase().includes(filterQuery.toLowerCase().trim())
  );

  const handleExport = () => {
    const dataStr = exportUserData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cinehub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content && importUserData(content)) {
        setImportNotice({ type: 'success', message: 'Đã khôi phục dữ liệu sao lưu thành công!' });
        onDataImported?.();
      } else {
        setImportNotice({ type: 'error', message: 'Tệp không hợp lệ hoặc sai định dạng dữ liệu CineHub!' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Title Landmark */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-white/[0.08] gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black font-heading text-white flex items-center gap-2.5 tracking-tight">
            <span className="w-1.5 h-6 sm:h-7 rounded-full bg-gradient-to-b from-red-500 via-rose-500 to-amber-500 shadow-sm shadow-red-500/50" />
            Tủ Phim & Lịch Sử
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-medium pl-4">
            Quản lý danh sách phim yêu thích và lịch sử xem của bạn
          </p>
        </div>

        {/* Import/Export Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
            aria-label="Tải lên tệp sao lưu dữ liệu"
          />
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white px-3 py-2 rounded-xl glass-pill hover:bg-white/15 cursor-pointer transition-all border border-white/10 focus-visible:ring-2 focus-visible:ring-red-500"
            title="Tải file sao lưu JSON về máy"
            aria-label="Tải file sao lưu dữ liệu JSON"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Sao lưu</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white px-3 py-2 rounded-xl glass-pill hover:bg-white/15 cursor-pointer transition-all border border-white/10 focus-visible:ring-2 focus-visible:ring-red-500"
            title="Khôi phục danh sách từ file JSON"
            aria-label="Khôi phục dữ liệu từ tệp JSON"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-400" />
            <span>Khôi phục</span>
          </button>
          {tab === 'history' && history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-red-400 px-3 py-2 rounded-xl glass-pill hover:bg-red-500/10 cursor-pointer transition-all border border-white/10 focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label="Xóa toàn bộ lịch sử xem"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa lịch sử</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Notice Banner */}
      {importNotice && (
        <div
          role="alert"
          className={`flex items-center justify-between p-3.5 mb-6 rounded-2xl border text-xs sm:text-sm font-medium transition-all ${
            importNotice.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/40 border-red-500/40 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {importNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{importNotice.message}</span>
          </div>
          <button
            onClick={() => setImportNotice(null)}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-5 mb-8 gap-4">
        <div role="tablist" aria-label="Tùy chọn tủ phim" className="flex items-center gap-2 sm:gap-3">
          <button
            role="tab"
            id="library-tab-favorites"
            aria-selected={tab === 'favorites'}
            aria-controls="library-panel-favorites"
            onClick={() => setTab('favorites')}
            className={`flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black font-heading cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-red-500 ${
              tab === 'favorites'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30 glow-red-sm scale-105'
                : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${tab === 'favorites' ? 'fill-current' : ''}`} />
            Đã Lưu ({favorites.length})
          </button>
          <button
            role="tab"
            id="library-tab-history"
            aria-selected={tab === 'history'}
            aria-controls="library-panel-history"
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black font-heading cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-red-500 ${
              tab === 'history'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30 glow-red-sm scale-105'
                : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <History className="w-4 h-4" />
            Đang Xem ({history.length})
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Lọc trong tủ phim..."
              aria-label="Lọc nhanh danh sách trong tủ phim"
              className="pl-9 pr-3 py-2 bg-white/[0.06] border border-white/[0.1] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-red-500 w-44 sm:w-56 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Tab Contents */}
      {tab === 'favorites' ? (
        <div role="tabpanel" id="library-panel-favorites" aria-labelledby="library-tab-favorites">
          {filteredFavs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto glass-panel rounded-3xl p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-400">
                <Bookmark className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-zinc-200">
                {filterQuery ? 'Không tìm thấy phim phù hợp.' : 'Chưa có phim nào trong Tủ Phim.'}
              </p>
              <span className="text-xs text-zinc-400">
                Bấm vào biểu tượng bookmark trên thẻ phim để lưu lại và xem sau bất cứ lúc nào.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4.5">
              {filteredFavs.map((m) => {
                const title = formatMovieTitle(m.name);
                return (
                  <article
                    key={m.slug}
                    role="button"
                    tabIndex={0}
                    aria-label={`Xem chi tiết phim ${title}`}
                    onClick={() => onSelectMovie(m.slug)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSelectMovie(m.slug);
                      }
                    }}
                    className="group relative rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.08] hover:border-red-500/50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-600/20 cursor-pointer"
                  >
                    <div className="aspect-[2/3] w-full bg-[#11131c] relative overflow-hidden">
                      <img
                        src={getImageUrl(m.poster_url || m.thumb_url)}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFav(m.slug);
                        }}
                        className="absolute top-2.5 right-2.5 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-black/75 hover:bg-red-600 text-white transition-all cursor-pointer z-10 hover:scale-110 shadow-lg focus-visible:ring-2 focus-visible:ring-white"
                        title="Bỏ lưu phim này"
                        aria-label={`Bỏ lưu phim ${title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-transparent to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40 glow-red-sm">
                          <Play className="w-4 h-4 fill-current translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5 bg-[#0e1017]/70">
                      <h3 className="text-xs font-bold truncate text-zinc-100 group-hover:text-red-400 transition-colors">
                        {title}
                      </h3>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                        <span>{m.year || '2026'}</span>
                        {m.quality && (
                          <span className="px-1.5 py-0.2 rounded bg-red-600/80 text-white font-bold">
                            {m.quality}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" id="library-panel-history" aria-labelledby="library-tab-history">
          {filteredHistory.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto glass-panel rounded-3xl p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-400">
                <History className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-zinc-200">
                {filterQuery ? 'Không tìm thấy lịch sử phù hợp.' : 'Chưa có lịch sử xem phim nào.'}
              </p>
              <span className="text-xs text-zinc-400">
                Tiến trình xem phim sẽ tự động lưu lại để bạn có thể tiếp tục xem dở bất cứ khi nào.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {filteredHistory.map((h) => {
                const title = formatMovieTitle(h.name);
                const pct =
                  h.duration > 0 ? Math.min(100, Math.round((h.currentTime / h.duration) * 100)) : 0;
                return (
                  <article
                    key={`${h.slug}-${h.episodeSlug}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Tiếp tục xem ${title} - ${h.episodeName}, tiến trình ${pct}%`}
                    onClick={() => onResumePlay(h)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onResumePlay(h);
                      }
                    }}
                    className="group rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.08] hover:border-red-500/50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-600/20 cursor-pointer flex flex-col"
                  >
                    <div className="relative aspect-video w-full bg-[#11131c] overflow-hidden">
                      <img
                        src={getImageUrl(h.thumb_url || h.poster_url)}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/50 glow-red-sm">
                          <Play className="w-5 h-5 text-white fill-current translate-x-0.5" />
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveHistoryItem(h.slug, h.episodeSlug);
                        }}
                        className="absolute top-2.5 right-2.5 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-black/75 hover:bg-red-600 text-white transition-all cursor-pointer z-10 hover:scale-110 shadow-lg focus-visible:ring-2 focus-visible:ring-white"
                        title="Xóa tập này khỏi lịch sử"
                        aria-label={`Xóa tập ${h.episodeName} của ${title} khỏi lịch sử`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {/* Progress bar container */}
                      <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60 backdrop-blur-sm">
                        <div
                          className="h-full bg-gradient-to-r from-red-600 to-rose-500 shadow-sm shadow-red-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-3.5 bg-[#0e1017]/70 flex-1 flex flex-col justify-between">
                      <h3 className="text-sm font-bold text-zinc-100 group-hover:text-red-400 transition-colors truncate">
                        {title}
                      </h3>
                      <div className="flex justify-between items-center text-xs text-zinc-400 mt-2 pt-2 border-t border-white/[0.05]">
                        <span className="font-semibold text-red-400 truncate max-w-[65%]">
                          {h.episodeName}
                        </span>
                        <span className="text-[11px] font-bold text-zinc-300">Đã xem {pct}%</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
