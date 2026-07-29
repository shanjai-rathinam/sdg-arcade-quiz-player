import React from 'react';
import type { RoleMode, ThemeMode } from '../types/game';
import { Sun, Moon, Volume2, VolumeX, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { audioService } from '../services/audioService';
import { SdgWheelLogo } from './SdgWheelLogo';

interface NavbarProps {
  role: RoleMode;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  onOpenQrModal?: () => void;
  isConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  role,
  theme,
  setTheme,
  isMuted,
  setIsMuted,
  onOpenQrModal,
  isConnected
}) => {
  const toggleAudio = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioService.setMuted(nextMuted);
  };

  const toggleTheme = () => {
    audioService.playClick();
    setTheme(theme === 'DARK' ? 'LIGHT' : 'DARK');
  };

  return (
    <header className="shrink-0 w-full border-b-2 border-slate-800/80 light:border-slate-200 bg-slate-950/90 light:bg-white/95 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 md:h-18 flex items-center justify-between">
        {/* Transparent UN SDG Wheel Ring Logo & Title */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <SdgWheelLogo className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 drop-shadow-lg" />
          <div className="flex flex-col">
            <span className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-white light:text-slate-900 leading-tight font-heading drop-shadow-sm">
              SDG ARCADE QUIZ
            </span>
            <span className="text-[10px] sm:text-xs font-extrabold text-slate-400 light:text-slate-500 flex items-center space-x-1.5 mt-0.5 uppercase tracking-wider font-heading">
              <span>UN Sustainable Development Goals</span>
              {/* Dynamic Connection Status Indicator */}
              <span className={`inline-flex items-center space-x-1 text-[10px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-md border ${
                isConnected 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                {isConnected ? (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>CONTROLLER CONNECTED</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-amber-400 animate-pulse" />
                    <span>WAITING FOR CONTROLLER...</span>
                  </>
                )}
              </span>
            </span>
          </div>
        </div>

        {/* Global Controls: Sound & Theme */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Sound Toggle */}
          <button
            onClick={toggleAudio}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900 light:bg-slate-100 text-slate-200 light:text-slate-800 hover:text-white light:hover:text-slate-900 border-2 border-slate-800 light:border-slate-200 transition shadow-md transform active:scale-95"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900 light:bg-slate-100 text-slate-200 light:text-slate-800 hover:text-white light:hover:text-slate-900 border-2 border-slate-800 light:border-slate-200 transition shadow-md transform active:scale-95"
            title="Toggle Light / Dark Theme"
          >
            {theme === 'DARK' ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-unblue" />}
          </button>
        </div>
      </div>
    </header>
  );
};
