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
      <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-[#E50914] flex items-center justify-center shadow-lg shadow-red-600/40 group-hover:shadow-red-600/60 group-hover:scale-105 transition-all shrink-0">
        <Film className="w-5 h-5 text-white" />
        <div className="absolute inset-0 rounded-md bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-xl sm:text-2xl font-black tracking-tighter font-heading text-white">
          CINE<span className="text-[#E50914] drop-shadow-[0_0_10px_rgba(229,9,20,0.5)]">HUB</span>
        </span>
        <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/40">
          HD
        </span>
      </div>
    </button>
  );
}
