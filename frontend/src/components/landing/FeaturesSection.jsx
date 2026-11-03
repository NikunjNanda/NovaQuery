import React, { useState } from 'react';
import {
  Brain,
  Wrench,
  Shield,
  Layers,
  TableProperties,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

export default function FeaturesSection() {
  const [copiedQuery, setCopiedQuery] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText("SELECT region, strftime('%m', order_date) AS month, SUM(price * quantity) FROM sales GROUP BY region, month;");
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  return (
    <section id="features" className="w-full px-4 sm:px-6 py-20 scroll-mt-16">
      <div className="max-w-[1280px] mx-auto text-left">
        {/* Section Heading */}
        <div className="max-w-2xl mb-12">
          <span className="font-mono text-xs text-violet-400 uppercase tracking-widest font-semibold block mb-2">
            ARCHITECTURE & CAPABILITIES
          </span>
          <h2 className="font-geist text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Built for asking, not for writing SQL
          </h2>
          <p className="font-geist text-sm sm:text-base text-slate-400 mt-2">
            Enterprise database capabilities engineered into an effortless conversational experience.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 (Span 2): Natural Language to SQL */}
          <div className="lg:col-span-2 bg-[#0d111d] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-white/[0.06] hover:border-white/[0.12] transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
                  Core Engine
                </span>
                <Brain className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="font-geist text-xl font-semibold text-white mb-2">
                Natural Language to SQL
              </h3>
              <p className="font-geist text-sm text-slate-400 max-w-lg mb-6 leading-relaxed">
                Ask in everyday English and get a validated, dialect-optimized query calibrated to your database schema, relationships, and column constraints.
              </p>
            </div>

            {/* Interactive Preview Sub-box */}
            <div className="bg-[#070911] rounded-xl p-4 border border-white/[0.06]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-[#5de6ff]" />
                  <span className="font-medium">“Show monthly revenue for this quarter sorted by region”</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#5de6ff] font-mono text-xs">
                  <span>Synthesized in 118ms</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/[0.06] font-mono text-xs text-slate-400 flex items-center justify-between">
                <code className="text-[#5de6ff] truncate mr-2">
                  SELECT region, strftime('%m', order_date), SUM(price * quantity) FROM sales...
                </code>
                <button
                  onClick={handleCopy}
                  className="hover:text-white transition-colors p-1 rounded hover:bg-white/[0.05] shrink-0"
                  title="Copy sample SQL"
                >
                  {copiedQuery ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: AI-Assisted Query Correction */}
          <div className="bg-[#0d111d] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-white/[0.06] hover:border-white/[0.12] transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  Resilience
                </span>
                <Wrench className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-geist text-xl font-semibold text-white mb-2">
                AI-Assisted Query Correction
              </h3>
              <p className="font-geist text-sm text-slate-400 mb-6 leading-relaxed">
                If an engine execution throws a syntax or schema ambiguity error, NovaQuery inspects dialect logs, diagnoses the mismatch, and retries.
              </p>
            </div>

            {/* Diff Preview */}
            <div className="bg-[#070911] rounded-xl p-3.5 font-mono text-xs flex flex-col gap-1.5 border border-white/[0.04]">
              <div className="text-rose-400/90 line-through truncate">
                - JOIN cust_table ON id = user_id
              </div>
              <div className="text-[#5de6ff] flex items-center gap-1.5 truncate">
                <span className="text-xs">+</span>
                <span>JOIN customers ON customers.id = orders.customer_id</span>
              </div>
            </div>
          </div>

          {/* Card 3: SQL Validation & Read-Only Safety */}
          <div className="bg-[#0d111d] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-white/[0.06] hover:border-white/[0.12] transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                  Integrity
                </span>
                <Shield className="w-5 h-5 text-[#5de6ff]" />
              </div>
              <h3 className="font-geist text-xl font-semibold text-white mb-2">
                SQL Validation & Safety
              </h3>
              <p className="font-geist text-sm text-slate-400 mb-6 leading-relaxed">
                Queries are parsed into Abstract Syntax Trees with SQLGlot. Non-SELECT operations are permanently blocked from reaching SQLite.
              </p>
            </div>

            <div className="bg-[#070911] rounded-xl p-3.5 flex items-center justify-between font-mono text-xs border border-white/[0.04]">
              <span className="text-slate-400">Allowed AST:</span>
              <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white">
                SELECT ONLY
              </span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Enforced
              </span>
            </div>
          </div>

          {/* Card 4: Database Insights & Briefings */}
          <div className="bg-[#0d111d] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-white/[0.06] hover:border-white/[0.12] transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
                  Context
                </span>
                <Layers className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="font-geist text-xl font-semibold text-white mb-2">
                Database Insights & Briefings
              </h3>
              <p className="font-geist text-sm text-slate-400 mb-6 leading-relaxed">
                Get an immediate topological breakdown of your database schema: tables, columns, primary keys, and joinable relational pathways.
              </p>
            </div>

            <div className="bg-[#070911] rounded-xl p-3.5 flex flex-col gap-1.5 font-mono text-xs border border-white/[0.04]">
              <div className="flex justify-between text-slate-400">
                <span>Company Catalog:</span>
                <span className="text-white">Customers, Products, Orders</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Relational Keys:</span>
                <span className="text-white">Foreign Key Constraints Linked</span>
              </div>
            </div>
          </div>

          {/* Card 5 (Span 2): Structured Query Results */}
          <div className="lg:col-span-2 bg-[#0d111d] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-white/[0.06] hover:border-white/[0.12] transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
                  Clarity
                </span>
                <TableProperties className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="font-geist text-xl font-semibold text-white mb-2">
                Structured Query Results
              </h3>
              <p className="font-geist text-sm text-slate-400 max-w-lg mb-6 leading-relaxed">
                Clear, readable tables with high-precision numeric alignment, pagination, and instant toggling to view generated SQL and clause-by-clause educational lessons.
              </p>
            </div>

            <div className="bg-[#070911] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/[0.06]">
              <div>
                <p className="font-geist text-sm font-medium text-white">
                  Live Tabular Exploration & SQL Explanation
                </p>
                <p className="font-geist text-xs text-slate-400 mt-0.5">
                  Understand how every SELECT, JOIN, and WHERE clause transforms your data.
                </p>
              </div>
              <div className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs font-mono text-slate-300 flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff]" />
                <span>Automated Lesson & Breakdown</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

