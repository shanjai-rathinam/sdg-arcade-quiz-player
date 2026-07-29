import React from 'react';

export const InstitutionFooter: React.FC = () => {
  return (
    <footer className="shrink-0 py-2 sm:py-3 border-t-2 border-slate-800/80 light:border-slate-200 text-center bg-slate-950/60 light:bg-slate-100/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 flex flex-row items-center justify-between gap-3 text-xs font-bold text-slate-300 light:text-slate-700">
        <div className="flex items-center space-x-3">
          <span className="uppercase tracking-wider text-[10px] sm:text-xs font-black text-slate-400 light:text-slate-500 font-heading">
            HOSTED BY:
          </span>
          <img
            src="./srm-trp-logo.jpg"
            alt="SRM TRP Engineering College, Trichy"
            className="h-10 sm:h-12 max-w-full object-contain rounded-xl bg-white p-1 shadow-md border border-slate-200"
          />
        </div>
        <span className="text-[10px] sm:text-xs font-extrabold text-slate-400 light:text-slate-500 uppercase tracking-widest font-heading">
          SDG Arcade Quiz • Live Booth Interactive System
        </span>
      </div>
    </footer>
  );
};
