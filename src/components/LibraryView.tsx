import React, { useState } from 'react';
import { Bookmark, History, Trash2, Play } from 'lucide-react';
import type { FavoriteItem, HistoryItem } from '../types';
import { getImageUrl } from '../services/api';

interface Props {
  favorites: FavoriteItem[];
  history: HistoryItem[];
  onSelectMovie: (slug: string) => void;
  onResumePlay: (h: HistoryItem) => void;
  onRemoveFav: (slug: string) => void;
  onClearHistory: () => void;
}

export const LibraryView: React.FC<Props> = ({
  favorites,
  history,
  onSelectMovie,
  onResumePlay,
  onRemoveFav,
  onClearHistory,
}) => {
  const [tab, setTab] = useState<'favorites' | 'history'>('favorites');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTab('favorites')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer ${
              tab === 'favorites' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'
            }`}
          >
            <Bookmark className="w-4 h-4" /> Đã Lưu ({favorites.length})
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer ${
              tab === 'history' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'
            }`}
          >
            <History className="w-4 h-4" /> Đang Xem ({history.length})
          </button>
        </div>
        {tab === 'history' && history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-red-400 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Xóa lịch sử
          </button>
        )}
      </div>

      {tab === 'favorites' ? (
        favorites.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">Chưa có phim lưu trong tủ.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {favorites.map((m) => (
              <div
                key={m.slug}
                onClick={() => onSelectMovie(m.slug)}
                className="group relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 cursor-pointer"
              >
                <div className="aspect-[2/3] w-full bg-zinc-950 relative">
                  <img src={getImageUrl(m.poster_url || m.thumb_url)} alt={m.name} className="w-full h-full object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFav(m.slug); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-red-600 text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-2">
                  <h4 className="text-xs font-semibold truncate text-zinc-200">{m.name}</h4>
                  <span className="text-[10px] text-zinc-500">{m.year || '2026'}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">Chưa có lịch sử xem phim.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {history.map((h) => {
            const pct = h.duration > 0 ? Math.min(100, Math.round((h.currentTime / h.duration) * 100)) : 0;
            return (
              <div
                key={`${h.slug}-${h.episodeSlug}`}
                onClick={() => onResumePlay(h)}
                className="group rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 cursor-pointer"
              >
                <div className="relative aspect-video w-full bg-zinc-950">
                  <img src={getImageUrl(h.thumb_url || h.poster_url)} alt={h.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Play className="w-8 h-8 text-white fill-current" />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-1.5 bg-zinc-800">
                    <div className="h-full bg-red-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="text-sm font-bold text-zinc-100 truncate">{h.name}</h4>
                  <div className="flex justify-between text-xs text-zinc-400 mt-1">
                    <span className="text-red-400">{h.episodeName}</span>
                    <span>Đã xem {pct}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
