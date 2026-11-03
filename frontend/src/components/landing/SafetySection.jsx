import React from 'react';
import { ShieldCheck, CheckCircle2, XCircle, ArrowRight, Lock } from 'lucide-react';

export default function SafetySection() {
  return (
    <section id="safety" className="w-full px-4 sm:px-6 py-20 scroll-mt-16 text-left">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left: Explanatory Copy & Principles (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <span className="font-mono text-xs text-[#5de6ff] uppercase tracking-widest font-semibold mb-2">
              SECURITY ARCHITECTURE
            </span>
            <h2 className="font-geist text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-4">
              Designed to read, never to change
            </h2>
            <p className="font-geist text-sm sm:text-base text-slate-400 mb-8 leading-relaxed">
              Your database holds critical production state. NovaQuery enforces multi-layer deterministic guardrails using SQLGlot AST validation to ensure mutations never reach SQLite.
            </p>

            <div className="space-y-6">
              {/* Principle 1 */}
              <div className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[#5de6ff] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-geist text-sm sm:text-base font-semibold text-white">
                    SELECT-only query restrictions
                  </h3>
                  <p className="font-geist text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                    Only <code className="text-cyan-300 font-mono text-xs">SELECT</code>, <code className="text-cyan-300 font-mono text-xs">UNION</code>, <code className="text-cyan-300 font-mono text-xs">INTERSECT</code>, and <code className="text-cyan-300 font-mono text-xs">EXCEPT</code> AST roots are allowed. Multi-statement chaining is forbidden.
                  </p>
                </div>
              </div>

              {/* Principle 2 */}
              <div className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[#5de6ff] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-geist text-sm sm:text-base font-semibold text-white">
                    Validation before execution
                  </h3>
                  <p className="font-geist text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                    Every generated statement is parsed into an Abstract Syntax Tree in memory. Deep AST traversal verifies that subqueries contain zero mutations.
                  </p>
                </div>
              </div>

              {/* Principle 3 */}
              <div className="flex items-start gap-3.5">
                <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[#5de6ff] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-geist text-sm sm:text-base font-semibold text-white">
                    Explicitly blocked operations
                  </h3>
                  <p className="font-geist text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                    Zero tolerance for <code className="text-rose-400 font-mono text-xs">INSERT</code>, <code className="text-rose-400 font-mono text-xs">UPDATE</code>, <code className="text-rose-400 font-mono text-xs">DELETE</code>, <code className="text-rose-400 font-mono text-xs">DROP</code>, <code className="text-rose-400 font-mono text-xs">CREATE</code>, <code className="text-rose-400 font-mono text-xs">ALTER</code>, or <code className="text-rose-400 font-mono text-xs">load_extension</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Architectural Validation Gate Diagram (7 cols) */}
          <div className="lg:col-span-7 bg-[#0d111d] rounded-2xl p-6 sm:p-7 border border-white/[0.08] shadow-2xl relative overflow-hidden">
            {/* Ambient Background Grid */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#5de6ff]" />
                <span className="font-geist text-sm sm:text-base font-semibold text-white">
                  Execution Safety Gate
                </span>
              </div>
              <span className="font-mono text-xs text-[#5de6ff] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Gate Active · AST Analysis
              </span>
            </div>

            {/* Inflow vs Outcome */}
            <div className="flex flex-col gap-4">
              {/* Stage 1: Candidate Verification Request */}
              <div className="bg-[#070911] p-3.5 rounded-xl border border-white/[0.04] flex items-center justify-between font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 uppercase tracking-wider">Candidate SQL:</span>
                  <span className="text-slate-200">AST Verification Request</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-white/[0.05] text-slate-400">
                  Pre-execution
                </span>
              </div>

              {/* Stage 2: Gate Logic Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Branch 1: Permitted Read Query */}
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-semibold mb-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Allowed Path</span>
                    </div>
                    <code className="text-white font-mono text-xs font-medium block truncate">
                      SELECT * FROM customers...
                    </code>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      Passes AST validator whitelist. Relayed directly to SQLite engine.
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-emerald-400 font-mono text-xs">
                    <span>Database Engine</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Branch 2: Blocked Write Statement */}
                <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-rose-400 font-mono text-xs font-semibold mb-1.5">
                      <XCircle className="w-4 h-4" />
                      <span>Blocked Path</span>
                    </div>
                    <code className="text-white font-mono text-xs font-medium line-through block truncate">
                      DROP TABLE customers;
                    </code>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      Forbidden statement detected. Immediately aborted with security exception.
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-rose-500/20 flex items-center justify-between text-rose-400 font-mono text-xs">
                    <span>Execution Aborted</span>
                    <XCircle className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Stage 3: Summary Banner */}
              <div className="bg-[#070911] p-3 rounded-xl border border-white/[0.04] flex items-center justify-between font-mono text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Enforcement:</span>
                </span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  0 writes permitted · Guaranteed Read-Only
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

