import React from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import ProductPreview from './ProductPreview';

export default function HeroSection({ onEnterWorkspace }) {
  const handleScrollToHowItWorks = (e) => {
    e.preventDefault();
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative w-full overflow-hidden px-4 sm:px-6 pt-12 pb-20 text-center" id="overview">
      {/* Ambient Violet Radial Aura */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[850px] h-[550px] bg-gradient-to-b from-violet-600/15 via-purple-500/5 to-transparent blur-3xl opacity-75" />

      <div className="max-w-[1280px] mx-auto flex flex-col items-center relative z-10">
        {/* Centered Editorial Headline */}
        <h1 className="font-geist text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight max-w-4xl text-white leading-[1.15] mb-5">
          Say it{' '}
          <span className="font-editorial italic font-normal text-[#d0bcff]">
            plainly.
          </span>
          <br className="hidden sm:inline" />
          {' '}NovaQuery speaks{' '}
          <span className="bg-gradient-to-r from-[#d0bcff] via-[#a078ff] to-[#5de6ff] bg-clip-text text-transparent">
            SQL.
          </span>
        </h1>

        {/* Supporting Copy */}
        <p className="font-geist text-base sm:text-lg text-slate-300 max-w-[580px] leading-relaxed mb-8">
          Ask your database a question in everyday language. NovaQuery writes the SQL, checks it is read-only, and shows you the results.
        </p>

        {/* Centered CTA Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-4">
          <button
            onClick={onEnterWorkspace}
            className="h-11 px-7 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-geist text-sm sm:text-[15px] font-medium inline-flex items-center gap-2 shadow-[0_0_24px_rgba(139,92,246,0.45)] hover:shadow-[0_0_32px_rgba(139,92,246,0.65)] hover:-translate-y-0.5 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <span>Enter NovaQuery</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="#how-it-works"
            onClick={handleScrollToHowItWorks}
            className="h-11 px-5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 font-geist text-sm sm:text-[15px] font-medium inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <span>See How It Works</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </a>
        </div>

        {/* Monospace Subcaption */}
        <div className="font-mono text-xs text-slate-400 tracking-widest uppercase mt-2 mb-12">
          Natural language · SQL generation · Validated results
        </div>

        {/* Signature Interactive Product Preview */}
        <ProductPreview />
      </div>
    </section>
  );
}

