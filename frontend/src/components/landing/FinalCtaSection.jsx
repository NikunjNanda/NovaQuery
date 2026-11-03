import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function FinalCtaSection({ onEnterWorkspace }) {
  return (
    <section className="w-full px-4 sm:px-6 py-24 relative overflow-hidden">
      <div className="max-w-[1280px] mx-auto">
        <div className="relative w-full rounded-3xl bg-gradient-to-b from-[#121626] to-[#0c0f1a] border border-white/[0.08] p-8 sm:p-14 text-center overflow-hidden shadow-2xl">
          {/* Ambient Violet Radial Aura */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-violet-600/15 via-transparent to-transparent opacity-70" />
          <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-violet-600/20 blur-[100px] rounded-full" />

          <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
            {/* Logo Mark */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1c1f2a] to-[#262a35] border border-white/10 flex items-center justify-center font-mono text-base text-[#c0c1ff] mb-6 shadow-md">
              <span className="text-[#5de6ff] text-sm font-semibold mr-0.5">&gt;</span>
              <span className="font-bold">N</span>
            </div>

            <h2 className="font-geist text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight leading-tight">
              Ready to ask your data anything?
            </h2>

            <p className="font-geist text-sm sm:text-base text-slate-300 mt-3 mb-8 max-w-lg leading-relaxed">
              Enter your workspace and start exploring your database in seconds with plain English queries.
            </p>

            <button
              onClick={onEnterWorkspace}
              className="h-12 px-8 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-geist text-base font-medium inline-flex items-center gap-2 shadow-[0_0_28px_rgba(139,92,246,0.45)] hover:shadow-[0_0_36px_rgba(139,92,246,0.65)] hover:-translate-y-0.5 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <span>Enter NovaQuery</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="mt-6 font-mono text-xs text-slate-500 tracking-wider uppercase">
              Zero setup · Browser-native workspace · Read-only enforcement
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

