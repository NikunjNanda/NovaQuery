import React from 'react';
import { CheckCircle2, Eye, X } from 'lucide-react';

/**
 * Dismissible top banner indicating dataset readiness and dimensions.
 * 
 * @param {Object} props
 * @param {boolean} props.isDismissed - Dismissed state
 * @param {Function} props.onDismiss - Dismiss callback
 * @param {string} props.filename - Active dataset filename (e.g. 'iris.csv')
 * @param {number} props.rows - Row count
 * @param {number} props.cols - Column count
 * @param {Function} [props.onQuickPreview] - Optional quick preview toggle callback
 */
export default function DatasetReadyBanner({
  isDismissed,
  onDismiss,
  filename = 'iris.csv',
  rows = 150,
  cols = 6,
  onQuickPreview,
}) {
  if (isDismissed) return null;

  return (
    <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-sm select-none animate-fadeIn">
      {/* Left info */}
      <div className="flex items-center gap-2.5 min-w-0">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
          <span className="font-semibold text-emerald-300">Dataset ready</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200 font-medium">{filename}</span>
          <span className="text-slate-400 text-[11px]">
            {rows} rows × {cols} cols
          </span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {onQuickPreview && (
          <button
            onClick={onQuickPreview}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-700/50 text-emerald-300 text-xs font-mono transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quick Preview</span>
          </button>
        )}

        <button
          onClick={onDismiss}
          aria-label="Dismiss dataset ready banner"
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
