import React from 'react';
import { THEME } from '../../constants/theme';

/**
 * Reusable Pill/Chip component for NovaQuery.
 * 
 * @param {Object} props
 * @param {string} props.label - Chip text to display
 * @param {'type' | 'clause' | 'difficulty' | 'tag' | 'default'} [props.variant='default'] - Visual style variant
 * @param {string} [props.subtext] - Optional secondary text (e.g. "3 distinct values")
 * @param {string} [props.difficultyKey] - 'beginner' | 'intermediate' | 'advanced' if variant is difficulty
 * @param {string} [props.className] - Additional Tailwind classes
 * @param {Function} [props.onClick] - Optional click handler for interactive chips
 */
export default function Chip({
  label,
  variant = 'default',
  subtext,
  difficultyKey,
  className = '',
  onClick,
}) {
  let styleClasses = 'bg-slate-800/80 text-slate-300 border-slate-700/60';

  if (variant === 'type') {
    const normalized = (label || '').toUpperCase().trim();
    const typeStyle = THEME.dataTypeChips[normalized] || THEME.dataTypeChips['DEFAULT'];
    styleClasses = `${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`;
  } else if (variant === 'clause') {
    const clauseStyle = THEME.clauseChips[label] || THEME.clauseChips['DEFAULT'];
    styleClasses = clauseStyle;
  } else if (variant === 'difficulty' && difficultyKey) {
    const diff = THEME.difficulty[difficultyKey];
    if (diff) {
      styleClasses = diff.pill;
    }
  } else if (variant === 'tag') {
    styleClasses = 'bg-slate-900/90 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300';
  }

  const clickableClasses = onClick ? 'cursor-pointer hover:brightness-110 active:scale-95 transition-transform' : '';

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border tracking-tight leading-none ${styleClasses} ${clickableClasses} ${className}`}
    >
      <span>{label}</span>
      {subtext && (
        <span className="text-[10px] opacity-75 font-sans font-normal border-l border-current/25 pl-1.5 ml-0.5">
          {subtext}
        </span>
      )}
    </span>
  );
}
