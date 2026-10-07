import React from 'react';
import Chip from '../common/Chip';

/**
 * Individual clause step in the SQL anatomy breakdown.
 * 
 * @param {Object} props
 * @param {string} props.clause - SQL clause keyword (e.g. 'SELECT', 'FROM', 'GROUP BY')
 * @param {string} [props.sql] - SQL expression fragment
 * @param {string} props.explanation - Plain-English explanation
 */
export default function ClauseCard({
  clause,
  sql,
  explanation,
}) {
  return (
    <div className="bg-[#090e1a] border border-[#1a243a] rounded-xl p-3.5 flex flex-col gap-2 transition hover:border-cyan-500/30">
      {/* Header: Clause Chip + SQL expression */}
      <div className="flex items-start gap-2 flex-wrap">
        <Chip label={clause} variant="clause" className="shrink-0" />
        {sql && (
          <code className="text-xs font-mono text-cyan-300 break-all select-text">
            {sql}
          </code>
        )}
      </div>

      {/* Explanation text */}
      <p className="text-xs text-slate-300 leading-relaxed font-sans">
        {explanation}
      </p>
    </div>
  );
}
