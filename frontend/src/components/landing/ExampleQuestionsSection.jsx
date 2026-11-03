import React from 'react';
import {
  TrendingUp,
  Package,
  Calendar,
  Users,
  AlertCircle,
  Calculator,
  ArrowRight,
} from 'lucide-react';

export default function ExampleQuestionsSection({ onSelectQuestion }) {
  const exampleQuestions = [
    {
      id: 1,
      text: 'Which customers have spent the most?',
      icon: TrendingUp,
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/10 border-violet-500/20',
    },
    {
      id: 2,
      text: 'Show the top-selling products.',
      icon: Package,
      iconColor: 'text-[#5de6ff]',
      iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      id: 3,
      text: 'Summarize monthly order activity.',
      icon: Calendar,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      id: 4,
      text: 'How many orders has each customer placed?',
      icon: Users,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      id: 5,
      text: 'Which products have never been ordered?',
      icon: AlertCircle,
      iconColor: 'text-rose-400',
      iconBg: 'bg-rose-500/10 border-rose-500/20',
    },
    {
      id: 6,
      text: 'What is the average order value?',
      icon: Calculator,
      iconColor: 'text-[#c0c1ff]',
      iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    },
  ];

  return (
    <section className="w-full px-4 sm:px-6 py-20 bg-[#080b13] border-y border-white/[0.04]">
      <div className="max-w-[1280px] mx-auto text-center">
        {/* Section Header */}
        <div className="max-w-xl mx-auto mb-12">
          <span className="font-mono text-xs text-violet-400 uppercase tracking-widest font-semibold block mb-2">
            PRE-BUILT PROMPTS
          </span>
          <h2 className="font-geist text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Not sure where to start?
          </h2>
          <p className="font-geist text-sm sm:text-base text-slate-400 mt-2">
            Click any question to open the workspace with the prompt pre-filled and ready to run.
          </p>
        </div>

        {/* 6 Query Chips in a 2-column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto text-left">
          {exampleQuestions.map((q) => {
            const IconComp = q.icon;
            return (
              <button
                key={q.id}
                onClick={() => onSelectQuestion(q.text)}
                className="group p-4 sm:p-5 rounded-xl bg-[#0d111d] hover:bg-[#121626] border border-white/[0.06] hover:border-violet-500/40 shadow-sm flex items-center justify-between transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 text-left active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${q.iconBg}`}>
                    <IconComp className={`w-4 h-4 ${q.iconColor}`} />
                  </div>
                  <span className="font-geist text-sm sm:text-[15px] font-medium text-slate-200 group-hover:text-white transition-colors truncate">
                    {q.text}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-violet-300 group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Footnote */}
        <div className="mt-8 font-mono text-xs text-slate-500">
          Suggestions only. Click any question to explore your database in the workspace.
        </div>
      </div>
    </section>
  );
}

