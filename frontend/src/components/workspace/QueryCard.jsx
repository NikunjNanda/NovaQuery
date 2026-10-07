import React from 'react';
import { MessageSquare, Code2, Sparkles, Play, CornerDownLeft } from 'lucide-react';

/**
 * Natural language & SQL Query Editor Card.
 * 
 * @param {Object} props
 * @param {string} props.queryText - Current input value
 * @param {Function} props.onChangeQuery - Change handler for textarea
 * @param {'english' | 'sql'} props.queryMode - Active query mode
 * @param {Function} props.onChangeMode - Mode switch handler
 * @param {Function} props.onRunQuery - Handler to execute query (triggered by button & Ctrl+Enter)
 * @param {boolean} [props.loading=false] - Execution loading spinner state
 * @param {string} [props.filename='dataset'] - Active dataset filename for dynamic placeholders
 * @param {Array<string>} [props.suggestions=[]] - List of prompt suggestions
 * @param {Function} [props.onSelectSuggestion] - Click callback when a suggestion is clicked
 * @param {string|null} [props.runNotice] - Temporary notice for Stage 2 placeholder execution
 */
export default function QueryCard({
  queryText,
  onChangeQuery,
  queryMode = 'english',
  onChangeMode,
  onRunQuery,
  loading = false,
  filename = 'iris.csv',
  suggestions = [],
  onSelectSuggestion,
  runNotice = null,
}) {
  const isEnglish = queryMode === 'english';

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRunQuery();
    }
  };

  return (
    <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-xl transition-all">
      {/* Top Header: Mode Toggle Bar */}
      <div className="flex items-center justify-between border-b border-[#1a243a]/70 pb-3 flex-wrap gap-2">
        <div className="flex items-center p-1 rounded-lg bg-[#05080f] border border-[#151f33]">
          <button
            onClick={() => onChangeMode('english')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
              isEnglish
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ask in English</span>
          </button>

          <button
            onClick={() => onChangeMode('sql')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
              !isEnglish
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Write SQL</span>
          </button>
        </div>

        {/* Engine status pill */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#05080f] border border-[#151f33] text-[11px] font-mono text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>SQLite Engine</span>
        </div>
      </div>

      {/* Query Input Box */}
      <div className="relative">
        <textarea
          value={queryText}
          onChange={(e) => onChangeQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder={
            isEnglish
              ? `Ask any question about ${filename}, or pick a starter question below...`
              : `SELECT * FROM ${filename.replace(/\.[^/.]+$/, '')} LIMIT 10;`
          }
          className="w-full bg-[#05080f] border border-[#151f33] focus:border-cyan-500/80 rounded-xl p-3.5 text-xs sm:text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition resize-none leading-relaxed"
        />
      </div>

      {/* Editor Footer: Pedagogical note & Run button */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {isEnglish ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Generates verified SQL query with pedagogical explanation
              </span>
            </>
          ) : (
            <>
              <Code2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Direct SQLite statement editor
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Keyboard hint */}
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 mr-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#05080f] border border-[#151f33] text-slate-400 text-[10px]">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#05080f] border border-[#151f33] text-slate-400 text-[10px]">
              Enter
            </kbd>
          </span>

          <button
            onClick={onRunQuery}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-semibold text-xs transition shadow-md shadow-cyan-950 disabled:opacity-50 select-none"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Analysis</span>
          </button>
        </div>
      </div>

      {/* Temporary Notice for Stage 2 Run Handler feedback */}
      {runNotice && (
        <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/50 text-xs font-mono text-cyan-300 flex items-center justify-between animate-fadeIn">
          <span>{runNotice}</span>
        </div>
      )}

      {/* Suggestion Chips Section ("TRY ASKING:") */}
      {suggestions && suggestions.length > 0 && (
        <div className="pt-2 border-t border-[#1a243a]/70 flex items-center flex-wrap gap-2">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase shrink-0">
            Try Asking:
          </span>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSelectSuggestion && onSelectSuggestion(suggestion)}
              className="text-left text-xs text-slate-300 hover:text-cyan-300 bg-[#05080f] hover:bg-[#0c1424] border border-[#151f33] hover:border-cyan-600/50 px-2.5 py-1 rounded-full transition flex items-center gap-1.5 group"
            >
              <Sparkles className="w-3 h-3 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>"{suggestion}"</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
