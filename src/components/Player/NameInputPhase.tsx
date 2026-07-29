import React, { useState } from 'react';
import { User, ArrowRight } from 'lucide-react';
import { audioService } from '../../services/audioService';

interface NameInputPhaseProps {
  playerName: string;
  onNameSubmitted: (name: string) => void;
}

export const NameInputPhase: React.FC<NameInputPhaseProps> = ({
  playerName,
  onNameSubmitted
}) => {
  const [inputName, setInputName] = useState(playerName || 'Eco Player');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    audioService.playStart();
    onNameSubmitted(inputName.trim());
  };

  const handlePresetSelect = (preset: string) => {
    audioService.playClick();
    setInputName(preset);
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-5 text-center animate-slide-up my-auto">
      {/* Title */}
      <div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white light:text-slate-900 drop-shadow-lg uppercase font-heading">
          SDG ARCADE QUIZ
        </h2>
        <p className="text-sm sm:text-base font-medium text-slate-300 light:text-slate-600 mt-2">
          Enter your nickname on screen to start the Arcade Challenge!
        </p>
      </div>

      {/* Name Form Card */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 sm:p-8 rounded-3xl border-2 border-slate-700/60 light:border-slate-300 shadow-2xl text-left space-y-5">
        
        {/* Player Nickname Field - Fixed Icon & Input Padding */}
        <div>
          <label className="block text-xs sm:text-sm font-extrabold text-slate-200 light:text-slate-700 uppercase tracking-wider mb-2 font-heading">
            Enter Arcade Player Nickname
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-4 z-10 flex items-center pointer-events-none text-slate-400">
              <User className="w-6 h-6 text-unblue" />
            </div>
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              maxLength={20}
              required
              placeholder="Enter your nickname..."
              className="w-full pl-14 sm:pl-16 pr-5 py-3.5 sm:py-4 bg-slate-950/90 light:bg-white text-white light:text-slate-900 border-2 border-slate-700 light:border-slate-300 rounded-2xl focus:ring-4 focus:ring-unblue focus:outline-none font-black text-lg sm:text-xl shadow-inner transition"
            />
          </div>
        </div>

        {/* Quick Nickname Presets */}
        <div>
          <span className="text-xs font-bold text-slate-400 light:text-slate-600 block mb-2 uppercase tracking-wider">
            Quick Nickname Presets:
          </span>
          <div className="flex flex-wrap gap-2.5">
            {['Eco Warrior', 'Earth Guardian', 'Climate Hero', 'Green Pioneer'].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className="px-3.5 py-2 rounded-xl bg-slate-900/80 light:bg-slate-100 text-xs sm:text-sm font-extrabold text-slate-200 light:text-slate-800 border-2 border-slate-700 light:border-slate-300 hover:border-unblue hover:text-unblue transition shadow-md"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full py-4 sm:py-4.5 rounded-2xl bg-gradient-to-r from-unblue to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-black text-lg sm:text-xl tracking-wider uppercase shadow-2xl shadow-unblue/40 transform active:scale-98 transition flex items-center justify-center space-x-3"
        >
          <span>START ARCADE CHALLENGE</span>
          <ArrowRight className="w-6 h-6" />
        </button>
      </form>
    </div>
  );
};
