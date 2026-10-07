import React from 'react';
import { BookOpen, Lightbulb } from 'lucide-react';
import Chip from '../common/Chip';

/**
 * Dataset briefing card showing context, inferred schema types, and distribution insights.
 * 
 * @param {Object} props
 * @param {Object} props.briefing - Briefing data from mockData.js (or backend)
 * @param {Array} [props.columns=[]] - List of columns with name and inferred type
 */
export default function DatasetBriefingCard({
  briefing,
  columns = [],
}) {
  // TODO(backend): Replace mockDatasetBriefing with real endpoint response
  const title = briefing?.title || 'What this data is about';
  const description = briefing?.description || '';
  const classification = briefing?.classification || {
    category: 'CLASSIFICATION',
    type: 'Multivariate',
    origin: 'Fisher, 1936',
  };
  const insight = briefing?.insight || {
    title: 'Worth checking in this data',
    category: 'Distribution Insight',
    description: '',
  };

  return (
    <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
      {/* Header: Title and Classification metadata badge */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-950/70 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-100">
            {title}
          </h3>
        </div>

        {/* Classification Badge */}
        {classification && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              {classification.category}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-emerald-400 font-semibold">{classification.type}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-[11px]">{classification.origin}</span>
            </div>
          </div>
        )}
      </div>

      {/* Description text */}
      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
        {description}
      </p>

      {/* AVAILABLE COLUMNS & INFERRED TYPES */}
      <div className="flex flex-col gap-2 pt-1">
        <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
          Available Columns & Inferred Types
        </span>

        <div className="flex flex-wrap gap-2 items-center">
          {columns.map((col) => {
            const isDistinctCategorical = col.unique_values && col.unique_values <= 5;
            const subtext = isDistinctCategorical ? `${col.unique_values} distinct values` : null;

            return (
              <div
                key={col.name}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#05080f] border border-[#151f33] text-xs font-mono"
              >
                <span className="text-slate-200">{col.name}</span>
                <Chip
                  label={col.type || 'TEXT'}
                  variant="type"
                  subtext={subtext}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Worth checking in this data callout */}
      {insight && (
        <div className="p-3.5 rounded-xl bg-[#090e1b] border border-[#1a253d] flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400 shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>

          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-200">
                {insight.title}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-800/40">
                {insight.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {insight.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
