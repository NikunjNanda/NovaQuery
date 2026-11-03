import React from 'react';

export default function LandingFooter() {
  const scrollTo = (e, id) => {
    e.preventDefault();
    if (id === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="w-full border-t border-white/[0.06] bg-[#070912] py-12">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex flex-col items-center md:items-start gap-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#1c1f2a] border border-white/10 flex items-center justify-center font-mono text-xs">
              <span className="text-[#5de6ff] mr-0.5">&gt;</span>
              <span className="text-[#c0c1ff] font-bold">N</span>
            </div>
            <span className="font-geist text-base font-semibold text-white">
              Nova<span className="text-[#c0c1ff]">Query</span>
            </span>
          </div>
          <p className="font-geist text-xs text-slate-400">
            Ask your database questions in plain English.
          </p>
        </div>

        {/* In-page Anchor Links */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          <button
            onClick={(e) => scrollTo(e, 'overview')}
            className="font-geist text-xs text-slate-400 hover:text-white transition-colors"
          >
            Overview
          </button>
          <button
            onClick={(e) => scrollTo(e, 'how-it-works')}
            className="font-geist text-xs text-slate-400 hover:text-white transition-colors"
          >
            How It Works
          </button>
          <button
            onClick={(e) => scrollTo(e, 'features')}
            className="font-geist text-xs text-slate-400 hover:text-white transition-colors"
          >
            Features
          </button>
          <button
            onClick={(e) => scrollTo(e, 'safety')}
            className="font-geist text-xs text-slate-400 hover:text-white transition-colors"
          >
            Safety
          </button>
        </div>

        {/* Copyright */}
        <div className="font-mono text-xs text-slate-500">
          © {new Date().getFullYear()} NovaQuery
        </div>
      </div>
    </footer>
  );
}

