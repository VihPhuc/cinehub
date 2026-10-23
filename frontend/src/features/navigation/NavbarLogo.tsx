import { Film } from 'lucide-react';

interface NavbarLogoProps {
  onHome: () => void;
}

export function NavbarLogo({ onHome }: NavbarLogoProps) {
  return (
    <button
      onClick={onHome}
      className="group flex items-center gap-2.5 cursor-pointer text-left focus:outline-none shrink-0"
    >
      <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:shadow-red-600/50 group-hover:scale-105 transition-all shrink-0">
        <Film className="w-5 h-5 text-white" />
        <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-xl font-black tracking-tight font-heading text-white">
          CINE<span className="bg-gradient-to-r from-red-500 via-rose-500 to-amber-400 bg-clip-text text-transparent">HUB</span>
        </span>
        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
          HD
        </span>
      </div>
    </button>
  );
}
