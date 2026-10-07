import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Table as TableIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  X
} from 'lucide-react';
import Chip from '../common/Chip';

/**
 * Calculates human relative time from an ISO timestamp.
 */
function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Left Sidebar component for NovaQuery.
 * 
 * @param {Object} props
 * @param {Object} props.profile - Dataset profile { table_name, total_rows, columns }
 * @param {Array} props.history - Query execution history list
 * @param {string|null} props.activeHistoryId - Selected query history item ID
 * @param {Function} props.onSelectHistory - Callback when a history item is clicked
 * @param {Function} props.onRefreshSchema - Callback to re-fetch profile
 * @param {boolean} props.isOpen - Mobile/tablet drawer open state
 * @param {Function} props.onClose - Mobile/tablet close callback
 */
export default function Sidebar({
  profile,
  history = [],
  activeHistoryId,
  onSelectHistory,
  onRefreshSchema,
  isOpen,
  onClose,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isTableExpanded, setIsTableExpanded] = useState(true);

  const tableName = profile?.table_name || 'iris';
  const totalRows = profile?.total_rows || 150;
  const columns = profile?.columns || [];

  // Filter columns and tables by search query
  const filteredColumns = columns.filter((col) =>
    col.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static top-14 bottom-0 left-0 z-40 w-72 bg-[#0a0e1a] border-r border-[#1a243a] flex flex-col transition-transform duration-200 select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Close Header */}
        <div className="flex lg:hidden items-center justify-between px-4 py-3 border-b border-[#1a243a]">
          <span className="text-xs font-mono font-semibold text-slate-300">EXPLORER & HISTORY</span>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="p-1 rounded text-slate-400 hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: YOUR DATA */}
        <div className="p-3.5 border-b border-[#1a243a]/70 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-400 uppercase">
              Your Data
            </span>
            <button
              onClick={onRefreshSchema}
              title="Refresh Schema"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tables, columns..."
              className="w-full bg-[#05080f] border border-[#151f33] focus:border-cyan-500/70 rounded-md pl-8 pr-2.5 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none transition"
            />
          </div>
        </div>

        {/* Section 2: Collapsible Table & Column Tree */}
        <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-4">
          <div className="flex flex-col">
            {/* Table Item Header */}
            <button
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-900/60 text-left transition group"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {isTableExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
                <TableIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-xs font-mono font-medium text-slate-200 truncate group-hover:text-cyan-300">
                  {tableName}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 shrink-0 pl-2">
                {totalRows}r
              </span>
            </button>

            {/* Columns List */}
            {isTableExpanded && (
              <div className="mt-1 pl-6 pr-2 flex flex-col gap-1 border-l border-slate-800/60 ml-3.5">
                {filteredColumns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-900/40 text-xs font-mono group"
                  >
                    <span className="text-slate-400 group-hover:text-slate-200 truncate pr-2 text-[11px]">
                      {col.name}
                    </span>
                    <Chip label={col.type || 'TEXT'} variant="type" className="shrink-0" />
                  </div>
                ))}
                {filteredColumns.length === 0 && (
                  <span className="text-[11px] text-slate-600 italic py-1">No matching columns</span>
                )}
              </div>
            )}
          </div>

          {/* Section 3: QUERY HISTORY */}
          <div className="flex flex-col gap-2 pt-3 border-t border-[#1a243a]/70">
            <div className="flex items-center justify-between px-2">
              <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-400 uppercase">
                History
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {history.length} {history.length === 1 ? 'query' : 'queries'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              {history.map((item) => {
                const isActive = activeHistoryId === item.id;
                const isExecuted = item.status === 'executed';

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectHistory && onSelectHistory(item)}
                    className={`w-full text-left p-2 rounded-lg transition border flex flex-col gap-1 ${
                      isActive
                        ? 'bg-slate-900/90 border-cyan-500/50 shadow-sm shadow-cyan-950'
                        : 'bg-transparent border-transparent hover:bg-slate-900/40 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        {isExecuted ? (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Executed</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-400">
                            <Clock className="w-3 h-3" />
                            <span>Error</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatRelativeTime(item.executedAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-sans line-clamp-2 leading-snug">
                      {item.question}
                    </p>
                  </button>
                );
              })}

              {history.length === 0 && (
                <div className="px-2 py-3 text-[11px] text-slate-600 font-mono italic">
                  No queries run yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        {/* // TODO(backend): Replace hardcoded engine status with dynamic status from backend connection health */}
        <div className="p-3 border-t border-[#1a243a] bg-[#070a13] flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-slate-300">SQLite Ready</span>
          </div>
          <a
            href="https://sqlite.org/lang.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-400 transition"
          >
            <span>Docs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </aside>
    </>
  );
}
