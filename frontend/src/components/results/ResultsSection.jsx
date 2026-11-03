import React, { useState } from 'react';
import { Download, Table as TableIcon, BarChart2, Code2, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import DataTable from './DataTable';
import DataChart from './DataChart';
import SqlBlock from './SqlBlock';
import Skeleton from '../common/Skeleton';

/**
 * Client-side CSV export utility.
 */
function exportToCsv(data, filename = 'query_results.csv') {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((field) => {
          const val = row[field] ?? '';
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    ),
  ];

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Primary Results container component.
 * 
 * @param {Object} props
 * @param {boolean} props.loading - Loading state
 * @param {string|null} props.error - Error message if query failed
 * @param {Object|null} props.result - Query execution response
 * @param {number|null} props.responseTime - Measured response time in ms
 * @param {Function} [props.onRetry] - Retry callback
 */
export default function ResultsSection({
  loading = false,
  error = null,
  result = null,
  responseTime = null,
  onRetry,
  sqlDialect = 'sqlite',
  onDialectChange,
}) {
  const [activeTab, setActiveTab] = useState('results'); // 'results' | 'chart' | 'sql'

  // Loading skeleton state
  if (loading) {
    return (
      <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-5 flex flex-col gap-4 shadow-xl animate-fadeIn">
        <div className="flex items-center justify-between border-b border-[#1a243a] pb-3">
          <div className="flex items-center gap-2 text-violet-400 text-xs font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Executing SQL query against dataset...</span>
          </div>
          <Skeleton className="w-24 h-6" />
        </div>
        <Skeleton className="w-full h-48" />
        <Skeleton className="w-full h-24" />
      </div>
    );
  }

  // Error state
  if (error) {
    const errorStr = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
    const isQuotaError =
      errorStr.includes('RESOURCE_EXHAUSTED') ||
      errorStr.includes('429') ||
      errorStr.toLowerCase().includes('quota');

    return (
      <div className="bg-[#0d1322] border border-rose-900/50 rounded-2xl p-5 flex flex-col gap-3 shadow-xl animate-fadeIn">
        <div className="flex items-center gap-2.5 text-rose-400 font-semibold text-xs sm:text-sm font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Query Execution Error</span>
        </div>

        {isQuotaError ? (
          <div className="flex flex-col gap-2">
            <div className="bg-[#05080f] border border-amber-900/40 rounded-xl p-3.5 text-xs text-amber-300 leading-relaxed font-sans">
              The AI service has reached its daily limit. Please try again later.
            </div>
            <details className="text-[11px] font-mono text-slate-400 cursor-pointer group">
              <summary className="hover:text-slate-200 select-none py-1">
                Details
              </summary>
              <div className="mt-1 bg-[#05080f] border border-rose-950/80 rounded-xl p-3 text-xs font-mono text-rose-300 leading-relaxed whitespace-pre-wrap">
                {errorStr}
              </div>
            </details>
          </div>
        ) : (
          <div className="bg-[#05080f] border border-rose-950/80 rounded-xl p-3.5 text-xs font-mono text-rose-300 leading-relaxed whitespace-pre-wrap">
            {errorStr}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
          <span>The query engine could not process this request.</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-violet-400 hover:text-violet-300 hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  // If no result exists yet, do not render results section
  if (!result) return null;

  const data = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.results)
    ? result.results
    : Array.isArray(result)
    ? result
    : [];

  const rowCount = data.length;
  const sql = result.generated_sql || '';
  const postgresSql = result.postgres_sql || '';
  const explanation = result.explanation || '';
  // // TODO(backend): add `purpose` to the query response
  const purpose = result.purpose || null;
  const attemptsNeeded = result.attempts_needed || 1;

  return (
    <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl animate-fadeIn">
      {/* Sub-tabs toolbar */}
      <div className="flex items-center justify-between border-b border-[#1a243a] pb-3 flex-wrap gap-2">
        {/* Left Sub-tabs: Results / Chart Only / Raw SQL */}
        <div className="flex items-center p-1 rounded-lg bg-[#05080f] border border-[#151f33] text-xs font-medium">
          <button
            onClick={() => setActiveTab('results')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${
              activeTab === 'results'
                ? 'bg-slate-800 text-violet-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Results</span>
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${
              activeTab === 'chart'
                ? 'bg-slate-800 text-violet-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Chart Only</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${
              activeTab === 'sql'
                ? 'bg-slate-800 text-violet-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Raw SQL</span>
          </button>
        </div>

        {/* Right metrics: Row count, client response time, CSV export */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{rowCount} {rowCount === 1 ? 'row' : 'rows'}</span>
          </div>

          {responseTime !== null && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-[11px]">
                {responseTime.toFixed(1)}ms response time
              </span>
            </>
          )}

          <button
            onClick={() => exportToCsv(data)}
            disabled={rowCount === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#05080f] hover:bg-slate-800 border border-[#151f33] text-slate-300 hover:text-violet-300 text-xs font-mono transition disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Self-healing auto-correction notice */}
      {attemptsNeeded > 1 && (
        <div className="px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 font-mono text-[11px] flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Auto-corrected after {attemptsNeeded} attempts</span>
        </div>
      )}

      {/* Tab Content: View 1 - Results (Table + Visual distribution + About Query + SQL) */}
      {activeTab === 'results' && (
        <div className="flex flex-col gap-5">
          {/* Data Table */}
          <DataTable data={data} maxRows={100} />

          {/* Truncated note */}
          {result?.truncated && (
            <div className="text-[11px] font-mono text-amber-400/90 -mt-2 px-1">
              Showing the first 1000 rows
            </div>
          )}

          {/* Embedded Visual Distribution Preview (if data exists) */}
          {rowCount > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-[#1a243a]">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                Visual Distribution Preview
              </span>
              <DataChart data={data} />
            </div>
          )}

          {/* "About this query" card directly above the generated SQL block */}
          {Boolean(explanation?.trim() || purpose?.trim()) && (
            <div className="p-4 rounded-xl bg-[#090e1a] border border-[#1a243a] flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-violet-400 font-mono text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>About this query</span>
              </div>

              {/* What it does */}
              {explanation?.trim() && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    What it does:
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                    {explanation}
                  </p>
                </div>
              )}

              {/* Use (optional purpose line) */}
              {purpose?.trim() && (
                <div className="flex flex-col gap-0.5 pt-1 border-t border-[#151f33]">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Use:
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans whitespace-pre-line">
                    {purpose}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Generated SQL block */}
          {sql && (
            <SqlBlock
              sql={sql}
              postgresSql={postgresSql}
              dialect={sqlDialect}
              onDialectChange={onDialectChange}
            />
          )}
        </div>
      )}

      {/* Tab Content: View 2 - Chart Only */}
      {activeTab === 'chart' && (
        <div className="py-2">
          <DataChart data={data} />
        </div>
      )}

      {/* Tab Content: View 3 - Raw SQL */}
      {activeTab === 'sql' && (
        <div className="flex flex-col gap-4">
          {Boolean(explanation?.trim() || purpose?.trim()) && (
            <div className="p-3.5 rounded-xl bg-[#090e1a] border border-[#1a243a] text-xs text-slate-300 whitespace-pre-line">
              <span className="font-semibold text-violet-400">Explanation: </span>
              <span>{explanation}</span>
            </div>
          )}
          {sql ? (
            <SqlBlock
              sql={sql}
              postgresSql={postgresSql}
              dialect={sqlDialect}
              onDialectChange={onDialectChange}
            />
          ) : (
            <div className="text-slate-500 text-xs font-mono p-4">No SQL generated yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
