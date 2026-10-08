import React from 'react';
import { Database, Upload, HelpCircle, User, Table as TableIcon } from 'lucide-react';

/**
 * Top Global Navbar for NovaQuery
 * 
 * @param {Object} props
 * @param {'workspace' | 'schema' | 'practice'} props.activeTab - Currently selected tab
 * @param {Function} props.onSelectTab - Callback when a tab is selected
 * @param {Object} [props.datasetInfo] - Active dataset metadata { name, rows, cols }
 * @param {Function} props.onOpenUpload - Open upload modal callback
 * @param {Function} props.onOpenHelp - Open help modal callback
 */
export default function Navbar({
  activeTab,
  onSelectTab,
  datasetInfo = null,
  onOpenUpload,
  onOpenHelp,
}) {
  const tabs = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'schema', label: 'Schema' },
    { id: 'practice', label: 'Practice' },
  ];

  return (
    <header className="h-14 border-b border-[#1a243a] bg-[#070a13]/90 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left: Brand & Active Dataset Badge */}
      <div className="flex items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950/50">
            <Database className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-slate-100">NovaQuery</span>
            <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
              SQL Workspace
            </span>
          </div>
        </div>

        {/* Active Dataset Pill */}
        {datasetInfo && datasetInfo.name && (
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <TableIcon className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-200">{datasetInfo.name}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">
              {datasetInfo.totalTables > 1
                ? `${datasetInfo.totalTables} tables`
                : `${datasetInfo.rows} rows • ${datasetInfo.cols} columns`}
            </span>
          </div>
        )}
      </div>

      {/* Center: Workspace / Schema / Practice Navigation Tabs */}
      <nav className="flex items-center h-full gap-1 sm:gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`relative h-14 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center ${
                isActive
                  ? 'text-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-cyan-400 rounded-t-full shadow-sm shadow-cyan-400/50" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: Upload Data, Help & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition shadow-sm shadow-cyan-950 active:scale-95"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload data</span>
        </button>

        <button
          onClick={onOpenHelp}
          aria-label="Help and shortcuts"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300">
          <User className="w-3.5 h-3.5" />
        </div>
      </div>
    </header>
  );
}
