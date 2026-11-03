import React, { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

/**
 * Lightweight pure-JS SQL syntax highlighter.
 * Tokenizes SQL string into highlighted spans without any external libraries.
 */
function highlightSql(sql) {
  if (!sql) return '';

  const keywords = new Set([
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
    'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'CROSS JOIN', 'ON',
    'AS', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'ILIKE',
    'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC',
    'UNION', 'ALL', 'EXISTS', 'BETWEEN', 'INSERT', 'INTO', 'VALUES',
    'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER',
    'OVER', 'PARTITION BY'
  ]);

  const functions = new Set([
    'COUNT', 'AVG', 'SUM', 'MIN', 'MAX', 'ROUND', 'COALESCE',
    'RANK', 'DENSE_RANK', 'ROW_NUMBER', 'UPPER', 'LOWER', 'LENGTH',
    'SUBSTR', 'DATE', 'DATETIME', 'STRFTIME', 'IFNULL', 'TOTAL'
  ]);

  // Tokenize preserving comments, strings, identifiers, and symbols
  const regex = /(--[^\n]*)|('(?:''|[^'])*')|("(?:""|[^"])*")|(\b(?:GROUP BY|ORDER BY|INNER JOIN|LEFT JOIN|RIGHT JOIN|CROSS JOIN|PARTITION BY)\b|\b\w+\b)|([^\s\w'"]+)/gi;

  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(sql)) !== null) {
    // Plain whitespace or text before match
    if (match.index > lastIndex) {
      elements.push(sql.substring(lastIndex, match.index));
    }

    const [full, comment, singleStr, doubleStr, word, symbol] = match;

    if (comment) {
      elements.push(
        <span key={match.index} className="text-slate-500 italic">
          {comment}
        </span>
      );
    } else if (singleStr || doubleStr) {
      elements.push(
        <span key={match.index} className="text-emerald-400">
          {singleStr || doubleStr}
        </span>
      );
    } else if (word) {
      const upper = word.toUpperCase();
      if (keywords.has(upper)) {
        elements.push(
          <span key={match.index} className="text-cyan-400 font-semibold">
            {word}
          </span>
        );
      } else if (functions.has(upper)) {
        elements.push(
          <span key={match.index} className="text-amber-400 font-semibold">
            {word}
          </span>
        );
      } else {
        // Table or column identifier
        elements.push(
          <span key={match.index} className="text-slate-200">
            {word}
          </span>
        );
      }
    } else if (symbol) {
      elements.push(
        <span key={match.index} className="text-slate-400">
          {symbol}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < sql.length) {
    elements.push(sql.substring(lastIndex));
  }

  return elements;
}

/**
 * Syntax-highlighted SQL block with Copy button.
 * 
 * @param {Object} props
 * @param {string} props.sql - Raw SQL string
 * @param {string} [props.dialect='SQLite'] - SQL dialect label
 */
export default function SqlBlock({ sql, postgresSql, dialect = 'sqlite', onDialectChange }) {
  const [copied, setCopied] = useState(false);

  const isPostgres = String(dialect).toLowerCase() === 'postgres' || String(dialect).toLowerCase() === 'postgresql';
  const showToggle = postgresSql !== undefined && postgresSql !== null;
  const isPostgresDisabled = !postgresSql;
  const displayedSql = isPostgres && postgresSql ? postgresSql : sql;

  const handleCopy = async () => {
    if (!displayedSql) return;
    try {
      await navigator.clipboard.writeText(displayedSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement('textarea');
      textarea.value = displayedSql;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-violet-300 text-[11px] transition active:scale-95"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400 font-semibold">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 text-slate-400" />
          <span>Copy SQL</span>
        </>
      )}
    </button>
  );

  const dialectLabel = isPostgres ? 'PostgreSQL' : 'SQLite';

  return (
    <div className="bg-[#05080f] border border-[#1a243a] rounded-xl overflow-hidden shadow-md flex flex-col font-mono text-xs">
      {/* Header bar */}
      <div className={`flex items-center justify-between px-3.5 py-2 bg-[#090e1a] border-b border-[#1a243a] ${showToggle ? 'gap-2 flex-wrap' : ''}`}>
        <div className="flex items-center gap-2 text-slate-400">
          <Terminal className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Generated {dialectLabel} Statement
          </span>
        </div>

        {showToggle ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-[#05080f] border border-[#151f33] text-[11px]">
              <button
                type="button"
                onClick={() => onDialectChange && onDialectChange('sqlite')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  !isPostgres
                    ? 'bg-slate-800 text-violet-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SQLite
              </button>
              <button
                type="button"
                disabled={isPostgresDisabled}
                onClick={() => onDialectChange && onDialectChange('postgres')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  isPostgresDisabled
                    ? 'text-slate-600 cursor-not-allowed opacity-50'
                    : isPostgres
                    ? 'bg-slate-800 text-violet-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                PostgreSQL (converted)
              </button>
            </div>
            {copyButton}
          </div>
        ) : (
          copyButton
        )}
      </div>

      {/* Code contents */}
      <pre className="p-4 overflow-x-auto text-xs leading-relaxed text-slate-100 whitespace-pre-wrap select-text">
        <code>{highlightSql(displayedSql)}</code>
      </pre>
    </div>
  );
}
