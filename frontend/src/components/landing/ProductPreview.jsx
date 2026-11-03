import React, { useState } from 'react';
import { Shield, Copy, Check, Info, ArrowUp, Table } from 'lucide-react';

export default function ProductPreview() {
  const [copied, setCopied] = useState(false);

  const sampleSql = `SELECT c.name, SUM(o.total_amount) AS total_spent
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id
ORDER BY total_spent DESC
LIMIT 5;`;

  const handleCopySql = () => {
    navigator.clipboard?.writeText(sampleSql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sampleRows = [
    { name: 'Acme Corporation', amount: '$142,500', width: '100%', opacity: 'bg-violet-400' },
    { name: 'Northwind Traders', amount: '$98,200', width: '68%', opacity: 'bg-violet-400/80' },
    { name: 'CyberDyne Systems', amount: '$84,100', width: '59%', opacity: 'bg-violet-400/70' },
    { name: 'Initech LLC', amount: '$72,400', width: '50%', opacity: 'bg-violet-400/60' },
    { name: 'Globex Industrial', amount: '$65,900', width: '46%', opacity: 'bg-violet-400/50' },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl bg-[#0b0e17]/90 border border-white/[0.08] p-4 sm:p-6 shadow-2xl relative">
      {/* Ambient Radial Rim Highlight */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-violet-500/20 via-transparent to-transparent pointer-events-none -z-10" />

      {/* 1. English Input Layer with Syntax Tokens */}
      <div className="w-full bg-[#131726] rounded-xl p-3.5 sm:p-4 text-left flex items-center justify-between border border-white/[0.06] shadow-inner">
        <div className="flex items-center gap-2 flex-wrap text-sm sm:text-[15px] font-geist leading-relaxed">
          <span className="text-slate-400 font-mono select-none">&gt;</span>
          <span className="text-slate-200">Show me the</span>

          {/* Token 1: top 5 (Rose / Aggregation limit) */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs sm:text-[13px]">
            top 5
          </span>

          {/* Token 2: customers (Violet / Table entity) */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-violet-300 font-mono text-xs sm:text-[13px]">
            customers
          </span>

          {/* Token 3: by (Cyan / Predicate modifier) */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs sm:text-[13px]">
            by
          </span>

          {/* Token 4: total spending (Amber / Aggregate metric) */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs sm:text-[13px]">
            total spending
          </span>

          {/* Blinking Prompt Cursor */}
          <span className="w-1.5 h-4 bg-violet-400 animate-pulse inline-block align-middle ml-0.5" />
        </div>

        <div className="flex items-center gap-2 pl-3 shrink-0">
          <span className="font-mono text-[11px] text-slate-500 uppercase hidden sm:inline">
            Ctrl + ↵
          </span>
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-300 flex items-center justify-center border border-violet-500/30">
            <ArrowUp className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 2. Vector Connection Rails (Visible on md+) */}
      <div className="w-full h-12 relative hidden md:block">
        <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 960 48">
          {/* customers -> FROM customers c (violet) */}
          <path d="M 280 0 C 280 24, 250 20, 250 48" stroke="#8b5cf6" strokeOpacity="0.4" strokeDasharray="3 3" strokeWidth="1.5" />
          {/* total spending -> SUM(o.total_amount) (amber) */}
          <path d="M 440 0 C 440 28, 400 16, 380 48" stroke="#f59e0b" strokeOpacity="0.4" strokeWidth="1.5" />
          {/* by -> ORDER BY (cyan) */}
          <path d="M 340 0 C 340 28, 220 20, 220 48" stroke="#22d3ee" strokeOpacity="0.4" strokeDasharray="2 2" strokeWidth="1.5" />
          {/* top 5 -> LIMIT 5 (rose) */}
          <path d="M 170 0 C 170 32, 140 16, 140 48" stroke="#f43f5e" strokeOpacity="0.4" strokeWidth="1.5" />
        </svg>
      </div>

      {/* 3. Dual Engine Canvas (SQL Editor + Live Table Result) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-2 sm:mt-0 text-left">
        {/* Left: Synthesized SQL AST Editor (7 cols) */}
        <div className="lg:col-span-7 bg-[#080b12] rounded-xl p-4 sm:p-5 flex flex-col justify-between border border-white/[0.06] shadow-md">
          <div>
            {/* Editor Top Bar */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span className="font-mono text-[11px] text-slate-400 ml-2 uppercase tracking-wider">
                  Synthesized SQL AST
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[#5de6ff] text-[11px] font-mono">
                <Shield className="w-3 h-3 text-[#5de6ff]" />
                <span>SELECT ONLY · 1.8ms</span>
              </div>
            </div>

            {/* Monospace Code Highlighting */}
            <div className="font-mono text-[13px] leading-6 space-y-1 overflow-x-auto text-slate-200">
              <div className="flex gap-3">
                <span className="text-slate-600 select-none w-4 text-right">1</span>
                <span>
                  <span className="text-[#5de6ff] font-medium">SELECT</span> c.name,{' '}
                  <span className="text-[#ffb95f]">SUM</span>(o.total_amount){' '}
                  <span className="text-[#5de6ff]">AS</span> total_spent
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-slate-600 select-none w-4 text-right">2</span>
                <span>
                  <span className="text-[#5de6ff] font-medium">FROM</span>{' '}
                  <span className="text-[#d0bcff] font-medium">customers</span> c{' '}
                  <span className="text-[#5de6ff]">JOIN</span> orders o{' '}
                  <span className="text-[#5de6ff]">ON</span> o.customer_id = c.id
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-slate-600 select-none w-4 text-right">3</span>
                <span>
                  <span className="text-[#5de6ff] font-medium">GROUP BY</span> c.id
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-slate-600 select-none w-4 text-right">4</span>
                <span>
                  <span className="text-[#5de6ff] font-medium">ORDER BY</span> total_spent{' '}
                  <span className="text-[#5de6ff]">DESC</span>
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-slate-600 select-none w-4 text-right">5</span>
                <span>
                  <span className="text-rose-400 font-medium">LIMIT 5</span>;
                </span>
              </div>
            </div>
          </div>

          {/* Query Metadata Bottom Strip */}
          <div className="pt-3 mt-4 border-t border-white/[0.06] flex items-center justify-between text-slate-400 font-mono text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>0 writes detected · Read replica safe</span>
            </span>
            <button
              onClick={handleCopySql}
              className="hover:text-white transition-colors flex items-center gap-1 p-1 rounded hover:bg-white/[0.05]"
              title="Copy illustrative SQL"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Live Result Table (5 cols) */}
        <div className="lg:col-span-5 bg-[#080b12] rounded-xl p-4 sm:p-5 flex flex-col justify-between border border-white/[0.06] shadow-md">
          <div>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono text-[11px] text-slate-400 uppercase tracking-wider">
                  Tabular Output (5 rows)
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#5de6ff] font-medium">
                Ready
              </span>
            </div>

            {/* Data Rows */}
            <div className="w-full space-y-2 text-xs">
              <div className="flex justify-between text-slate-500 font-mono text-[10px] uppercase tracking-wider pb-1">
                <span>Customer</span>
                <span>Total Spent</span>
              </div>

              {sampleRows.map((row, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-[#111624] border border-white/[0.04] flex flex-col gap-1 hover:bg-[#161c2e] transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-200">{row.name}</span>
                    <span className="font-mono text-slate-300 font-medium">{row.amount}</span>
                  </div>
                  <div className="w-full bg-slate-800/60 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.opacity} rounded-full transition-all duration-500`}
                      style={{ width: row.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="font-geist text-xs text-slate-400 mt-4 leading-normal">
            Joins customers to their orders, totals spending per customer, and keeps the top five.
          </p>
        </div>
      </div>

      {/* Honest Illustrative Tag */}
      <div className="mt-4 pt-2 flex items-center justify-center gap-1.5 text-slate-500 font-mono text-[11px]">
        <Info className="w-3.5 h-3.5 text-slate-400" />
        <span>Illustrative example · Deterministic read-only execution pipeline</span>
      </div>
    </div>
  );
}

