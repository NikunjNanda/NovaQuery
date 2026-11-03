import React from 'react';
import { MessageSquare, Terminal, ShieldCheck, BarChart3 } from 'lucide-react';

export default function HowItWorksSection() {
  const steps = [
    {
      num: '01',
      title: '1. Ask in Plain English',
      description: "Type your question the way you'd say it to a colleague. No strict syntax, clauses, or SQL keywords required.",
      code: '"Which items had zero sales last quarter?"',
      codeColor: 'text-slate-300',
      icon: MessageSquare,
      badgeColor: 'text-[#5de6ff] bg-[#5de6ff]/10 border-[#5de6ff]/20',
    },
    {
      num: '02',
      title: '2. AI Generates SQL',
      description: "NovaQuery analyzes your database's schema, table relationships, and column types to draft high-precision SQL.",
      code: 'SYNTHESIS: LEFT JOIN products p ON ...',
      codeColor: 'text-[#c0c1ff]',
      icon: Terminal,
      badgeColor: 'text-[#c0c1ff] bg-violet-500/10 border-violet-500/20',
    },
    {
      num: '03',
      title: '3. Validate & Execute',
      description: 'The query AST is inspected before touching SQLite. Mutations and multi-statements are strictly intercepted and blocked.',
      code: 'GATE CHECK: PASSED (SELECT ONLY)',
      codeColor: 'text-[#5de6ff]',
      icon: ShieldCheck,
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      highlight: true,
    },
    {
      num: '04',
      title: '4. Explore Results',
      description: 'Review your data in a structured, sortable table accompanied by execution statistics and SQL clause breakdowns.',
      code: 'STRUCTURED OUTPUT [5 ROWS]',
      codeColor: 'text-[#ffb95f]',
      icon: BarChart3,
      badgeColor: 'text-[#ffb95f] bg-amber-500/10 border-amber-500/20',
    },
  ];

  return (
    <section
      id="how-it-works"
      className="w-full px-4 sm:px-6 py-20 bg-[#080b13] border-y border-white/[0.04] scroll-mt-16 relative"
    >
      <div className="max-w-[1280px] mx-auto">
        {/* Section Header */}
        <div className="max-w-2xl mb-14 text-left">
          <span className="font-mono text-xs text-[#5de6ff] uppercase tracking-widest font-semibold block mb-2">
            HOW IT WORKS
          </span>
          <h2 className="font-geist text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            From question to answer in four steps
          </h2>
          <p className="font-geist text-sm sm:text-base text-slate-400 mt-2">
            A deterministic, read-safe pipeline connecting plain human language to structured database queries.
          </p>
        </div>

        {/* Continuous Transformation Pipeline */}
        <div className="relative w-full">
          {/* Connecting Track SVG (Desktop only) */}
          <div className="hidden lg:block absolute top-12 left-0 right-0 h-4 z-0 pointer-events-none">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 16">
              <line x1="120" y1="8" x2="380" y2="8" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="380" y1="8" x2="620" y2="8" stroke="#8b5cf6" strokeWidth="2" />
              <line x1="620" y1="8" x2="880" y2="8" stroke="#06b6d4" strokeWidth="2" strokeDasharray="3 3" />
            </svg>
          </div>

          {/* 4 Process Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 relative z-10 text-left">
            {steps.map((step, idx) => {
              const IconComp = step.icon;
              return (
                <div
                  key={idx}
                  className={`bg-[#0d111d] rounded-2xl p-5 sm:p-6 flex flex-col justify-between border transition-all duration-200 relative ${
                    step.highlight
                      ? 'border-violet-500/40 shadow-lg shadow-violet-950/20'
                      : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-[#121626]'
                  }`}
                >
                  {step.highlight && (
                    <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-violet-600 text-white font-mono text-[10px] uppercase font-bold tracking-wider shadow-sm">
                      Read-Safe Gate
                    </div>
                  )}

                  <div>
                    {/* Step badge & icon */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold border ${step.badgeColor}`}>
                        {step.num}
                      </div>
                      <IconComp className="w-5 h-5 text-slate-400" />
                    </div>

                    <h3 className="font-geist text-base sm:text-lg font-semibold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="font-geist text-xs sm:text-sm text-slate-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {/* Code footer chip */}
                  <div className="mt-6 p-2.5 bg-[#070911] rounded-lg border border-white/[0.04] font-mono text-xs truncate">
                    <span className={step.codeColor}>{step.code}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

