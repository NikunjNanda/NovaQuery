import React from 'react';
import { GraduationCap, ArrowRight } from 'lucide-react';
import Chip from '../common/Chip';
import Skeleton from '../common/Skeleton';
import { THEME } from '../../constants/theme';

/**
 * Recommended starter queries curriculum section.
 * Arranged into 3 columns: Beginner, Intermediate, and Advanced.
 * Clicking a card fills the query input box without auto-running.
 * 
 * @param {Object} props
 * @param {Array} [props.starterQueries=[]] - List of curriculum query cards from backend
 * @param {Function} props.onSelectQuery - Callback when a card is clicked to populate the query box
 * @param {boolean} [props.loading=false] - Loading skeleton state
 */
export default function StarterQueriesSection({
  starterQueries = [],
  onSelectQuery,
  loading = false,
}) {
  if (loading) {
    return (
      <section className="flex flex-col gap-4 pt-2 animate-fadeIn">
        <div className="flex items-center justify-between">
          <Skeleton className="w-64 h-6" />
          <Skeleton className="w-32 h-4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </section>
    );
  }

  if (!starterQueries || starterQueries.length === 0) {
    return null;
  }

  // Group queries by difficulty
  const beginnerQueries = starterQueries.filter((q) => q.difficulty === 'beginner');
  const intermediateQueries = starterQueries.filter((q) => q.difficulty === 'intermediate');
  const advancedQueries = starterQueries.filter((q) => q.difficulty === 'advanced');

  // If every group is empty, hide the section
  if (beginnerQueries.length === 0 && intermediateQueries.length === 0 && advancedQueries.length === 0) {
    return null;
  }

  const columns = [
    {
      key: 'beginner',
      title: 'Beginner',
      badge: 'Fundamentals',
      dotColor: THEME.difficulty.beginner.dot,
      queries: beginnerQueries,
    },
    {
      key: 'intermediate',
      title: 'Intermediate',
      badge: 'Aggregation',
      dotColor: THEME.difficulty.intermediate.dot,
      queries: intermediateQueries,
    },
    {
      key: 'advanced',
      title: 'Advanced',
      badge: 'Filtering & Ranking',
      dotColor: THEME.difficulty.advanced.dot,
      queries: advancedQueries,
    },
  ];

  return (
    <section className="flex flex-col gap-4 pt-2">
      {/* Section Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-950/70 border border-violet-800/50 flex items-center justify-center text-violet-400">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-100">
              Recommended starter queries to learn SQL on this data
            </h3>
            <p className="text-xs text-slate-400">
              Click any card to load the query and explore the lesson interactively.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500">
          <span>Curriculum progression</span>
          <span>•</span>
          <span>{starterQueries.length} structured exercises</span>
        </div>
      </div>

      {/* 3-Column Curriculum Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {columns.map((col) => (
          <div key={col.key} className="flex flex-col gap-3">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-1 border-b border-[#1a243a]">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: col.dotColor }}
                />
                <span className="text-xs font-semibold text-slate-200">
                  {col.title}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                {col.badge}
              </span>
            </div>

            {/* Column Exercise Cards */}
            <div className="flex flex-col gap-3">
              {col.queries.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#090e1a]/60 border border-[#151f33] text-center text-xs text-slate-500 font-mono italic">
                  No suggestions for this level
                </div>
              ) : (
                col.queries.map((item) => (
                  <button
                    key={item.id || item.number || item.title}
                    onClick={() => onSelectQuery(item.question)}
                    className="w-full text-left bg-[#0d1322] hover:bg-[#111a2e] border border-[#1a243a] hover:border-violet-500/40 rounded-xl p-3.5 transition flex flex-col gap-2.5 group shadow-md"
                  >
                    {/* Top metadata line: Number • Category -> Arrow */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 w-full">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">{item.number}</span>
                        <span>•</span>
                        <span className="text-slate-400">{item.category}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    {/* Card Title */}
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-violet-300 transition-colors leading-snug">
                      {item.title}
                    </h4>

                    {/* Card One-line description */}
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>

                    {/* Card Concept Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.tags.map((tag) => (
                          <Chip key={tag} label={tag} variant="clause" />
                        ))}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
