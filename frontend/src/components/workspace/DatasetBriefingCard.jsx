import { BookOpen, Lightbulb } from 'lucide-react';
import Chip from '../common/Chip';
import Skeleton from '../common/Skeleton';

/**
 * Dataset briefing card showing context, inferred schema types, and distribution insights.
 * 
 * @param {Object} props
 * @param {Object} [props.briefing] - Briefing data from backend
 * @param {Array} [props.columns=[]] - List of columns with name and inferred type
 * @param {boolean} [props.loading=false] - Loading skeleton state
 */
export default function DatasetBriefingCard({
  briefing,
  columns = [],
  loading = false,
}) {
  if (loading) {
    return (
      <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-5 flex flex-col gap-4 shadow-xl animate-fadeIn">
        <div className="flex items-center justify-between pb-2 border-b border-[#1a243a]">
          <Skeleton className="w-56 h-5" />
          <Skeleton className="w-28 h-4" />
        </div>
        <Skeleton className="w-full h-12" />
        <Skeleton className="w-3/4 h-8" />
      </div>
    );
  }

  const title = briefing?.title || 'What this data is about';
  const overview = briefing?.overview || null;
  const paragraph = overview?.paragraph || briefing?.description || '';
  const points = Array.isArray(overview?.points) ? overview.points : [];
  const classification = briefing?.classification || null;
  const insight = briefing?.insight || null;

  return (
    <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-5 flex flex-col gap-4 shadow-xl min-w-0 overflow-hidden">
      {/* 1.a Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-cyan-950/70 border border-cyan-800/50 flex items-center justify-center text-cyan-400 shrink-0">
          <BookOpen className="w-4 h-4" />
        </div>
        <h3 className="text-sm sm:text-base font-semibold text-slate-100">
          {title}
        </h3>
      </div>

      {/* 1.b Overview paragraph or fallback description */}
      {paragraph && (
        <p className="text-sm text-slate-300 leading-relaxed break-words">
          {paragraph}
        </p>
      )}

      {/* 1.c Key facts section */}
      {points.length > 0 && (
        <div className="flex flex-col gap-2.5 pt-1">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
            Key facts
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
            {points.map((point, index) => {
              if (!point || (!point.label && !point.text)) return null;

              return (
                <div
                  key={point.label ? `${point.label}-${index}` : index}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#05080f]/70 border border-[#151f33] min-w-0"
                >
                  <Chip
                    label={point.label || ''}
                    className="text-[10px] uppercase tracking-wider shrink-0 mt-0.5"
                  />
                  <span className="text-xs sm:text-sm text-slate-300 leading-relaxed break-words min-w-0">
                    {point.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1.d Existing classification and insight blocks, ONLY when not null */}
      {classification && (
        <div className="p-3 sm:p-3.5 rounded-xl bg-[#090e1b] border border-[#1a253d] flex items-center justify-between flex-wrap gap-2 text-xs font-mono min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
            {classification.category || 'CLASSIFICATION'}
          </span>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {classification.type && (
              <span className="text-emerald-400 font-semibold">{classification.type}</span>
            )}
            {classification.type && classification.origin && (
              <span className="text-slate-600">•</span>
            )}
            {classification.origin && (
              <span className="text-slate-400 text-[11px]">{classification.origin}</span>
            )}
          </div>
        </div>
      )}

      {insight && (
        <div className="p-3.5 rounded-xl bg-[#090e1b] border border-[#1a253d] flex flex-col sm:flex-row items-start sm:items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400 shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>

          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-200">
                {insight.title}
              </span>
              {insight.category && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-800/40">
                  {insight.category}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed break-words">
              {insight.description}
            </p>
          </div>
        </div>
      )}

      {/* 1.e Existing column chips */}
      {columns && columns.length > 0 && (
        <div className="flex flex-col gap-2 pt-1 min-w-0">
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
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#05080f] border border-[#151f33] text-xs font-mono max-w-full min-w-0"
                >
                  <span className="text-slate-200 break-words">{col.name}</span>
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
      )}
    </div>
  );
}
