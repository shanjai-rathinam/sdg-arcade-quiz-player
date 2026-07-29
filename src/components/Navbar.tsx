import React, { useState, useEffect } from 'react';
import type { RoleMode, ThemeMode } from '../types/game';
import { Sun, Moon, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
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
  theme,
  setTheme,
  isMuted,
  setIsMuted,
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    audioService.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Exit fullscreen failed:', err);
        });
      }
    }
  };

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
            </span>
          </div>
        </div>

        {/* Global Controls: Fullscreen, Sound & Theme */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Fullscreen Mode Toggle */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center space-x-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-slate-900 light:bg-slate-100 text-slate-200 light:text-slate-800 hover:text-white light:hover:text-slate-900 border-2 border-slate-800 light:border-slate-200 font-extrabold text-xs sm:text-sm transition shadow-md transform active:scale-95"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4 text-amber-400" /> : <Maximize className="w-4 h-4 text-unblue" />}
            <span className="hidden sm:inline font-heading uppercase">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

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
