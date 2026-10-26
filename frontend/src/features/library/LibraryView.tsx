import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Bookmark,
  History,
  Trash2,
  Play,
  Download,
  Upload,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Clock,
  FolderHeart,
  FolderPlus,
  Plus,
  ArrowLeft,
  Layers,
} from 'lucide-react';
import type { FavoriteItem, HistoryItem, CustomCollection } from '@/shared/types';
import { getImageUrl, formatMovieTitle } from '@/shared/api';
import {
  exportUserData,
  importUserData,
  mergeUserData,
  validateAndSanitizeBackup,
  getCollections,
  createCollection,
  deleteCollection,
  toggleMovieInCollection,
  subscribeToStorage,
} from '@/shared/storage';

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
  const [tab, setTab] = useState<'favorites' | 'history' | 'collections'>('favorites');
  const [filterQuery, setFilterQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'in-progress' | 'completed'>('all');
  const [favSort, setFavSort] = useState<'saved-desc' | 'saved-asc' | 'name' | 'year-desc'>('saved-desc');
  const [importNotice, setImportNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Collections state
  const [collections, setCollections] = useState<CustomCollection[]>(() => getCollections());
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');

  // Backup Import Preview state
  const [backupPreview, setBackupPreview] = useState<{
    rawJson: string;
    favoritesCount: number;
    historyCount: number;
    collectionsCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeToStorage(() => {
      setCollections(getCollections());
    });
  }, []);

  // Compute viewing insights stats
  const stats = useMemo(() => {
    const totalMinutes = Math.round(
      history.reduce((sum, h) => sum + (h.currentTime || 0), 0) / 60
    );
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const timeFormatted = hours > 0 ? `${hours}g ${minutes}p` : `${minutes} phút`;

    const completedCount = history.filter((h) => {
      if (h.duration <= 0) return false;
      return h.currentTime / h.duration >= 0.85;
    }).length;

    return {
      timeFormatted,
      completedCount,
      totalSaved: favorites.length,
      totalCollections: collections.length,
    };
  }, [history, favorites, collections]);

  // Filter & Sort Favorites
  const filteredFavs = useMemo(() => {
    let list = favorites.filter((f) =>
      !filterQuery.trim()
        ? true
        : f.name.toLowerCase().includes(filterQuery.toLowerCase().trim()) ||
          (f.origin_name && f.origin_name.toLowerCase().includes(filterQuery.toLowerCase().trim())) ||
          (f.year && String(f.year).includes(filterQuery.trim()))
    );

    if (favSort === 'saved-desc') {
      list = [...list].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    } else if (favSort === 'saved-asc') {
      list = [...list].sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
    } else if (favSort === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (favSort === 'year-desc') {
      list = [...list].sort((a, b) => (b.year || 0) - (a.year || 0));
    }
    return list;
  }, [favorites, filterQuery, favSort]);

  // Filter History
  const filteredHistory = useMemo(() => {
    return history.filter((h) => {
      // Keyword query
      if (filterQuery.trim()) {
        const kw = filterQuery.toLowerCase().trim();
        const matchName = h.name.toLowerCase().includes(kw);
        const matchEp = h.episodeName.toLowerCase().includes(kw);
        if (!matchName && !matchEp) return false;
      }
      // Status filter
      if (historyStatusFilter !== 'all') {
        const pct = h.duration > 0 ? h.currentTime / h.duration : 0;
        if (historyStatusFilter === 'in-progress' && pct >= 0.85) return false;
        if (historyStatusFilter === 'completed' && pct < 0.85) return false;
      }
      return true;
    });
  }, [history, filterQuery, historyStatusFilter]);

  // Active Collection
  const activeCollection = useMemo(() => {
    if (!activeCollectionId) return null;
    return collections.find((c) => c.id === activeCollectionId) || null;
  }, [collections, activeCollectionId]);

  // Handle Export
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

  // Handle file select -> Validate and open preview dialog
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      try {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const validated = validateAndSanitizeBackup(parsed);
        if (validated) {
          setBackupPreview({
            rawJson: content,
            favoritesCount: validated.favorites?.length || 0,
            historyCount: validated.history?.length || 0,
            collectionsCount: validated.collections?.length || 0,
          });
        } else {
          setImportNotice({
            type: 'error',
            message: 'Tệp sao lưu không hợp lệ hoặc không có dữ liệu CineHub hợp lệ!',
          });
        }
      } catch {
        setImportNotice({
          type: 'error',
          message: 'Không thể đọc tệp. Vui lòng chọn tệp định dạng .json hợp lệ.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = (mode: 'merge' | 'overwrite') => {
    if (!backupPreview) return;
    const ok = mode === 'merge' ? mergeUserData(backupPreview.rawJson) : importUserData(backupPreview.rawJson);
    if (ok) {
      setImportNotice({
        type: 'success',
        message: mode === 'merge'
          ? 'Đã hợp nhất dữ liệu sao lưu thành công!'
          : 'Đã khôi phục toàn bộ dữ liệu sao lưu thành công!',
      });
      setCollections(getCollections());
      onDataImported?.();
    } else {
      setImportNotice({
        type: 'error',
        message: 'Khôi phục dữ liệu thất bại. Vui lòng thử lại.',
      });
    }
    setBackupPreview(null);
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    const created = createCollection(newColName.trim(), newColDesc.trim());
    if (created) {
      setCollections(getCollections());
      setNewColName('');
      setNewColDesc('');
      setShowCreateModal(false);
      setActiveCollectionId(created.id);
    }
  };

  const handleDeleteCollection = (id: string) => {
    if (deleteCollection(id)) {
      setCollections(getCollections());
      if (activeCollectionId === id) setActiveCollectionId(null);
    }
  };

  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Title Landmark */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-white/[0.08] gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black font-heading text-white flex items-center gap-2.5 tracking-tight">
            <span className="w-1.5 h-6 sm:h-7 rounded-full bg-gradient-to-b from-red-500 via-rose-500 to-amber-500 shadow-sm shadow-red-500/50" />
            Tủ Phim & Quản Lý Cá Nhân
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-medium pl-4">
            Theo dõi tiến trình xem, lưu phim yêu thích và sắp xếp bộ sưu tập cá nhân
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

      {/* Viewing Insights & Stats Dashboard Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-7">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Thời gian xem</p>
            <p className="text-sm sm:text-base font-black text-white truncate font-heading">{stats.timeFormatted}</p>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Tập hoàn thành</p>
            <p className="text-sm sm:text-base font-black text-white truncate font-heading">{stats.completedCount} tập</p>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Bookmark className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Phim đã lưu</p>
            <p className="text-sm sm:text-base font-black text-white truncate font-heading">{stats.totalSaved} phim</p>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <FolderHeart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Bộ sưu tập</p>
            <p className="text-sm sm:text-base font-black text-white truncate font-heading">{stats.totalCollections} bộ</p>
          </div>
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

      {/* Backup Preview Modal Dialog */}
      {backupPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận khôi phục sao lưu"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in"
        >
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#0d0f18] border border-amber-500/40 shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <h3 className="text-base font-black text-white font-heading flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-400" /> Xác Nhận Khôi Phục Dữ Liệu
              </h3>
              <button
                type="button"
                onClick={() => setBackupPreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Tệp sao lưu hợp lệ được tìm thấy. Bạn có thể chọn hợp nhất với danh sách hiện tại hoặc thay thế toàn bộ:
            </p>

            <div className="bg-white/[0.03] border border-white/[0.08] p-3.5 rounded-2xl space-y-1.5 text-xs text-zinc-200">
              <div className="flex justify-between">
                <span className="text-zinc-400">Phim yêu thích:</span>
                <span className="font-bold text-rose-400">{backupPreview.favoritesCount} phim</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Lịch sử xem:</span>
                <span className="font-bold text-red-400">{backupPreview.historyCount} mục</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Bộ sưu tập:</span>
                <span className="font-bold text-amber-400">{backupPreview.collectionsCount} bộ</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmImport('merge')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                Hợp Nhất (Khuyên dùng)
              </button>
              <button
                type="button"
                onClick={() => handleConfirmImport('overwrite')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-red-600/80 text-zinc-200 hover:text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Ghi Đè Tất Cả
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tạo bộ sưu tập mới"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in"
        >
          <form
            onSubmit={handleCreateCollection}
            className="w-full max-w-md p-6 rounded-3xl bg-[#0d0f18] border border-amber-500/40 shadow-2xl text-left space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <h3 className="text-base font-black text-white font-heading flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-400" /> Tạo Bộ Sưu Tập Mới
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Tên bộ sưu tập *</label>
                <input
                  type="text"
                  required
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="Ví dụ: Phim cuối tuần, Cày lại..."
                  className="w-full px-3.5 py-2 text-xs bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Mô tả ngắn (tùy chọn)</label>
                <input
                  type="text"
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                  placeholder="Ví dụ: Danh sách các phim bom tấn hay nhất..."
                  className="w-full px-3.5 py-2 text-xs bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!newColName.trim()}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-40"
              >
                Tạo Ngay
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-5 mb-8 gap-4">
        <div role="tablist" aria-label="Tùy chọn tủ phim" className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            role="tab"
            id="library-tab-favorites"
            aria-selected={tab === 'favorites'}
            aria-controls="library-panel-favorites"
            onClick={() => {
              setTab('favorites');
              setActiveCollectionId(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black font-heading cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-red-500 ${
              tab === 'favorites'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30 scale-105'
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
            onClick={() => {
              setTab('history');
              setActiveCollectionId(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black font-heading cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-red-500 ${
              tab === 'history'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30 scale-105'
                : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <History className="w-4 h-4" />
            Đang Xem ({history.length})
          </button>

          <button
            role="tab"
            id="library-tab-collections"
            aria-selected={tab === 'collections'}
            aria-controls="library-panel-collections"
            onClick={() => setTab('collections')}
            className={`flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black font-heading cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-amber-500 ${
              tab === 'collections'
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-black shadow-lg shadow-amber-500/20 scale-105 font-bold'
                : 'glass-pill text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <FolderHeart className="w-4 h-4" />
            Bộ Sưu Tập ({collections.length})
          </button>
        </div>

        {/* Filter & Sort Bars */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {tab === 'favorites' && (
            <select
              value={favSort}
              onChange={(e) => setFavSort(e.target.value as typeof favSort)}
              aria-label="Sắp xếp phim đã lưu"
              className="px-2.5 py-2 bg-white/[0.06] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="saved-desc">Mới lưu gần đây</option>
              <option value="saved-asc">Lưu cũ nhất</option>
              <option value="name">Tên A-Z</option>
              <option value="year-desc">Năm phát hành mới nhất</option>
            </select>
          )}

          {tab === 'history' && (
            <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setHistoryStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  historyStatusFilter === 'all'
                    ? 'bg-red-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setHistoryStatusFilter('in-progress')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  historyStatusFilter === 'in-progress'
                    ? 'bg-red-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Xem dở
              </button>
              <button
                type="button"
                onClick={() => setHistoryStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  historyStatusFilter === 'completed'
                    ? 'bg-red-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Đã xong
              </button>
            </div>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Lọc từ khóa..."
              aria-label="Lọc nhanh danh sách trong tủ phim"
              className="pl-9 pr-3 py-2 bg-white/[0.06] border border-white/[0.1] rounded-xl text-xs sm:text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-red-500 w-36 sm:w-48 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Tab 1: Favorites */}
      {tab === 'favorites' && (
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
                        <span>{m.year || '—'}</span>
                        {m.quality && (
                          <span className="px-1.5 py-0.2 rounded bg-red-600/80 text-white font-bold text-[10px]">
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
      )}

      {/* Tab 2: History */}
      {tab === 'history' && (
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

      {/* Tab 3: Custom Collections */}
      {tab === 'collections' && (
        <div role="tabpanel" id="library-panel-collections" aria-labelledby="library-tab-collections">
          {activeCollection ? (
            /* Collection Detail View */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveCollectionId(null)}
                    className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Quay lại danh sách bộ sưu tập"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black font-heading text-white flex items-center gap-2">
                      <FolderHeart className="w-5 h-5 text-amber-400" />
                      {activeCollection.name}
                    </h2>
                    {activeCollection.description && (
                      <p className="text-xs text-zinc-400 mt-0.5">{activeCollection.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteCollection(activeCollection.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600/30 text-red-400 font-bold text-xs border border-red-500/30 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa bộ sưu tập này</span>
                  </button>
                </div>
              </div>

              {activeCollection.slugs.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto glass-panel rounded-3xl p-8 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-amber-400">
                    <FolderPlus className="w-6 h-6" />
                  </div>
                  <p className="text-base font-bold text-zinc-200">Bộ sưu tập này đang trống.</p>
                  <span className="text-xs text-zinc-400">
                    Mở bất kỳ phim nào và bấm nút "Bộ Sưu Tập" trong cửa sổ chi tiết để thêm phim vào đây!
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4.5">
                  {activeCollection.slugs.map((slug) => {
                    const favMatch = favorites.find((f) => f.slug === slug);
                    const histMatch = history.find((h) => h.slug === slug);
                    const movieTitle = favMatch ? formatMovieTitle(favMatch.name) : (histMatch ? formatMovieTitle(histMatch.name) : slug);
                    const poster = favMatch?.poster_url || favMatch?.thumb_url || histMatch?.poster_url || histMatch?.thumb_url;

                    return (
                      <article
                        key={slug}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectMovie(slug)}
                        className="group relative rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.08] hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 cursor-pointer"
                      >
                        <div className="aspect-[2/3] w-full bg-[#11131c] relative overflow-hidden">
                          {poster ? (
                            <img
                              src={getImageUrl(poster)}
                              alt={movieTitle}
                              className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-zinc-900 text-zinc-400 text-xs">
                              <Layers className="w-6 h-6 mb-1 text-zinc-600" />
                              <span className="truncate max-w-full font-bold">{movieTitle}</span>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMovieInCollection(activeCollection.id, slug);
                              setCollections(getCollections());
                            }}
                            className="absolute top-2.5 right-2.5 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-black/75 hover:bg-red-600 text-white transition-all cursor-pointer z-10 shadow-lg"
                            title="Xóa phim khỏi bộ sưu tập này"
                            aria-label={`Xóa phim ${movieTitle} khỏi bộ sưu tập`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-2.5 bg-[#0e1017]/70">
                          <h3 className="text-xs font-bold truncate text-zinc-100 group-hover:text-amber-400 transition-colors">
                            {movieTitle}
                          </h3>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Collection Cards Grid */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400 font-medium">
                  Tạo các danh sách phim theo chủ đề riêng để dễ dàng tìm kiếm và xem lại.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-black font-black text-xs cursor-pointer shadow-lg shadow-amber-500/20 hover:scale-105 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Bộ Sưu Tập Mới</span>
                </button>
              </div>

              {collections.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center max-w-sm mx-auto glass-panel rounded-3xl p-8 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-amber-400">
                    <FolderHeart className="w-6 h-6" />
                  </div>
                  <p className="text-base font-bold text-zinc-200">Chưa có bộ sưu tập nào.</p>
                  <span className="text-xs text-zinc-400">
                    Hãy bấm nút "Tạo Bộ Sưu Tập Mới" ở trên để tạo danh sách đầu tiên!
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {collections.map((col) => (
                    <article
                      key={col.id}
                      onClick={() => setActiveCollectionId(col.id)}
                      className="group p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-amber-500/40 hover:bg-white/[0.05] cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <FolderHeart className="w-5 h-5" />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCollection(col.id);
                            }}
                            className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            title="Xóa bộ sưu tập"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors font-heading truncate">
                          {col.name}
                        </h3>
                        {col.description && (
                          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                            {col.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/[0.06] text-xs">
                        <span className="font-bold text-amber-400">{col.slugs.length} bộ phim</span>
                        <span className="text-zinc-400 group-hover:text-white transition-colors flex items-center gap-1 font-semibold">
                          Xem chi tiết &rarr;
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
