import React from 'react';
import { GraduationCap, AlertTriangle, Sparkles, ArrowRight, BookOpen } from 'lucide-react';
import ClauseCard from './ClauseCard';
import Chip from '../common/Chip';
import Skeleton from '../common/Skeleton';

/**
 * Educational Lesson Panel ("How this query works").
 * 
 * @param {Object} props
 * @param {boolean} [props.loading=false] - Loading state while query runs
 * @param {string|null} [props.error=null] - Query error state
 * @param {Object|null} [props.lesson=null] - Lesson object from backend (or starter query mock)
 * @param {string} [props.fallbackExplanation=''] - Backend explanation used as fallback if lesson is absent
 * @param {Function} [props.onSelectModifyIdea] - Callback when a "try modifying" item is clicked
 */
export default function HowQueryWorksPanel({
  loading = false,
  error = null,
  result = null,
  lesson = null,
  sqlDialect = 'sqlite',
  fallbackExplanation = '',
  onSelectModifyIdea,
}) {
  // Loading skeleton state
  if (loading) {
    return (
      <aside className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1a243a] pb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-semibold text-slate-200">How this query works</span>
          </div>
          <Skeleton className="w-24 h-4" />
        </div>
        <Skeleton className="w-full h-16" />
        <Skeleton className="w-full h-24" />
        <Skeleton className="w-full h-24" />
      </aside>
    );
  }

  // Error state: suppress lesson panel
  if (error) {
    return null;
  }

  const isPostgres = String(sqlDialect).toLowerCase() === 'postgres' || String(sqlDialect).toLowerCase() === 'postgresql';
  const hasPostgresLesson = isPostgres && Boolean(result?.lesson_postgres);
  const activeLesson = hasPostgresLesson ? result.lesson_postgres : (result?.lesson || lesson || null);

  // Fallback view when no structured lesson is available
  if (!activeLesson) {
    if (!fallbackExplanation || !fallbackExplanation.trim()) return null;

    return (
      <aside className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-5 flex flex-col gap-3.5 shadow-xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1a243a] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet-950/70 border border-violet-800/50 flex items-center justify-center text-violet-400">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-100">
              How this query works
            </h3>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-violet-300">
              Educational summary
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#090e1a] border border-[#1a243a] text-slate-300 font-medium">
              {hasPostgresLesson ? 'PostgreSQL' : 'SQLite'}
            </span>
          </div>
        </div>

        {/* Fallback Explanation */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
            Query Explanation:
          </span>
          <p className="text-xs text-slate-300 leading-relaxed font-sans bg-[#090e1a] border border-[#1a243a] rounded-xl p-3.5 whitespace-pre-line">
            "{fallbackExplanation}"
          </p>
        </div>

        {/* Non-intrusive fallback notice */}
        <p className="text-[11px] font-mono text-slate-500 italic pt-1">
          Detailed step-by-step clause breakdown not available for this query yet.
        </p>
      </aside>
    );
  }

  const {
    translation,
    steps = [],
    concepts = [],
    pitfall = null,
    modify_ideas = [],
    execution_order = [],
    how_to_read = null,
  } = activeLesson;

  const postgresNotes = (result?.postgres_notes && Array.isArray(result.postgres_notes))
    ? result.postgres_notes.filter((n) => typeof n === 'string' && n.trim().length > 0)
    : [];
  const showPostgresNotes = isPostgres && postgresNotes.length > 0;

  const executionOrderList = Array.isArray(execution_order)
    ? execution_order.filter((x) => typeof x === 'string' && x.trim().length > 0)
    : [];
  const howToReadText = typeof how_to_read === 'string' ? how_to_read.trim() : '';

  return (
    <aside className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1a243a] pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-950/70 border border-violet-800/50 flex items-center justify-center text-violet-400">
            <GraduationCap className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs sm:text-sm font-semibold text-slate-100">
            How this query works
          </h3>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-violet-300">
            Educational breakdown
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#090e1a] border border-[#1a243a] text-slate-300 font-medium">
            {hasPostgresLesson ? 'PostgreSQL' : 'SQLite'}
          </span>
        </div>
      </div>

      {/* 1. Plain-English Translation */}
      {translation && translation.trim() ? (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
            Plain-English Translation:
          </span>
          <p className="text-xs text-slate-300 leading-relaxed font-sans bg-[#090e1a] border border-[#1a243a] rounded-xl p-3.5 italic whitespace-pre-line">
            "{translation}"
          </p>
        </div>
      ) : null}

      {/* What is different in PostgreSQL */}
      {showPostgresNotes && (
        <div className="p-3.5 rounded-xl bg-[#090e1a] border border-[#1a243a] flex flex-col gap-2">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-violet-400 uppercase">
            What is different in PostgreSQL
          </span>
          <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 font-sans leading-relaxed">
            {postgresNotes.map((note, index) => (
              <li key={index} className="text-slate-300">
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Step-by-Step Anatomy */}
      {steps && steps.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
            Step-by-Step Anatomy
          </span>

          <div className="flex flex-col gap-2.5">
            {steps.map((step, index) => (
              <ClauseCard
                key={index}
                clause={step.clause}
                sql={step.sql}
                explanation={step.explanation}
              />
            ))}
          </div>
        </div>
      )}

      {/* Order of Execution */}
      {executionOrderList.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
            Order of Execution
          </span>
          <div className="p-3.5 rounded-xl bg-[#090e1a] border border-[#1a243a]">
            <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5 font-sans leading-relaxed">
              {executionOrderList.map((item, idx) => (
                <li key={idx} className="text-slate-300">
                  <span className="text-slate-200">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* How to Read the Result */}
      {howToReadText && (
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
            How to Read the Result
          </span>
          <div className="p-3.5 rounded-xl bg-[#090e1a] border border-[#1a243a]">
            <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
              {howToReadText}
            </p>
          </div>
        </div>
      )}

      {/* 3. Concept Tags */}
      {concepts && concepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {concepts.map((concept) => (
            <Chip key={concept} label={concept} variant="tag" />
          ))}
        </div>
      )}

      {/* 4. Common SQL Pitfall Callout */}
      {pitfall && (
        <div className="p-3.5 rounded-xl bg-[#1c1407] border border-amber-900/50 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Common SQL Pitfall</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {pitfall}
          </p>
        </div>
      )}

      {/* 5. Try Modifying This Query */}
      {modify_ideas && modify_ideas.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-[#1a243a]">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
            <Sparkles className="w-3 h-3 text-violet-400" />
            <span>Try Modifying This Query</span>
          </div>

          <div className="flex flex-col gap-2">
            {modify_ideas.map((idea, index) => (
              <button
                key={index}
                onClick={() => onSelectModifyIdea && onSelectModifyIdea(idea.question)}
                className="w-full text-left p-3 rounded-xl bg-[#090e1a] hover:bg-[#111a2e] border border-[#1a243a] hover:border-violet-500/40 transition flex items-center justify-between gap-3 group"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-violet-300 transition-colors">
                    {index + 1}. {idea.title}
                  </span>
                  {idea.hint && (
                    <span className="text-[11px] font-mono text-slate-400 truncate">
                      {idea.hint}
                    </span>
                  )}
                </div>

                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
