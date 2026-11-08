import React, { useState } from 'react';
import {
  Layers,
  Database,
  Key,
  Link2,
  Table,
  Hash,
  Calendar,
  Type,
  CheckCircle,
  HelpCircle,
  Eye,
} from 'lucide-react';
import Chip from '../common/Chip';

const RELATIONSHIP_COLORS = [
  { border: 'border-cyan-500/50', bg: 'bg-cyan-950/40', text: 'text-cyan-300', dot: 'bg-cyan-400' },
  { border: 'border-violet-500/50', bg: 'bg-violet-950/40', text: 'text-violet-300', dot: 'bg-violet-400' },
  { border: 'border-emerald-500/50', bg: 'bg-emerald-950/40', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  { border: 'border-amber-500/50', bg: 'bg-amber-950/40', text: 'text-amber-300', dot: 'bg-amber-400' },
  { border: 'border-pink-500/50', bg: 'bg-pink-950/40', text: 'text-pink-300', dot: 'bg-pink-400' },
  { border: 'border-blue-500/50', bg: 'bg-blue-950/40', text: 'text-blue-300', dot: 'bg-blue-400' },
];

function getTypeIcon(kind) {
  const k = (kind || '').toUpperCase();
  if (k.includes('INT') || k.includes('REAL') || k.includes('NUM') || k.includes('FLOAT')) {
    return <Hash className="w-3.5 h-3.5 text-cyan-400" />;
  }
  if (k.includes('DATE') || k.includes('TIME')) {
    return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
  }
  return <Type className="w-3.5 h-3.5 text-slate-400" />;
}

export default function SchemaView({ profile }) {
  const [selectedTable, setSelectedTable] = useState(null);
  const [showSamples, setShowSamples] = useState(false);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center p-12 sm:p-16 bg-[#0d1322] border border-[#1a243a] rounded-2xl text-center gap-3 my-6 animate-fadeIn">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
          <Layers className="w-6 h-6" />
        </div>
        <h2 className="text-base sm:text-lg font-semibold text-slate-100">
          No Schema Available
        </h2>
        <p className="text-xs text-slate-400 max-w-md">
          Upload a dataset to view its relational structure, column definitions, and detected relationships.
        </p>
      </div>
    );
  }

  // Extract tables from profile (supports both legacy single-table and multi-table profiles)
  const tables = Array.isArray(profile.tables) && profile.tables.length > 0
    ? profile.tables
    : [
        {
          table_name: profile.table_name || 'dataset',
          total_rows: profile.total_rows || 0,
          total_columns: profile.total_columns || (profile.columns?.length || 0),
          columns: profile.columns || [],
          sample_rows: profile.sample_rows || [],
        },
      ];

  const relationships = Array.isArray(profile.relationships) ? profile.relationships : [];
  const totalRows = tables.reduce((sum, t) => sum + (t.total_rows || 0), 0);
  const totalColumns = tables.reduce((sum, t) => sum + (t.total_columns || 0), 0);

  // Map relationships by table and column for quick lookup
  const relMap = {};
  relationships.forEach((rel, idx) => {
    const color = RELATIONSHIP_COLORS[idx % RELATIONSHIP_COLORS.length];
    const leftKey = `${rel.left_table}.${rel.left_column}`;
    const rightKey = `${rel.right_table}.${rel.right_column}`;

    if (!relMap[leftKey]) relMap[leftKey] = [];
    relMap[leftKey].push({ target: rightKey, rel, color, idx });

    if (!relMap[rightKey]) relMap[rightKey] = [];
    relMap[rightKey].push({ target: leftKey, rel, color, idx });
  });

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Header Overview Card */}
      <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-violet-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>Relational Schema</span>
              {relationships.length > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-800/40 font-normal">
                  Connected Workspace
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Interactive schema breakdown and entity relationships for your active data.
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-[#070b14] border border-[#172033] flex items-center gap-2 text-xs font-mono">
            <Table className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-slate-200 font-semibold">{tables.length}</span>
            <span className="text-slate-500">table{tables.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-[#070b14] border border-[#172033] flex items-center gap-2 text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-200 font-semibold">{totalRows.toLocaleString()}</span>
            <span className="text-slate-500">rows</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-[#070b14] border border-[#172033] flex items-center gap-2 text-xs font-mono">
            <Link2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-200 font-semibold">{relationships.length}</span>
            <span className="text-slate-500">join key{relationships.length !== 1 ? 's' : ''}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowSamples(!showSamples)}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-mono transition ${
              showSamples
                ? 'bg-violet-950/60 border-violet-700/60 text-violet-300'
                : 'bg-[#070b14] border-[#172033] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showSamples ? 'Hide Samples' : 'Show Samples'}</span>
          </button>
        </div>
      </div>

      {/* Relationships Legend (when present) */}
      {relationships.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#0d1322] border border-[#1a243a] flex flex-col gap-2.5 shadow-lg">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
            <Link2 className="w-3 h-3 text-cyan-400" />
            <span>Active Relationships ({relationships.length})</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {relationships.map((rel, idx) => {
              const color = RELATIONSHIP_COLORS[idx % RELATIONSHIP_COLORS.length];
              const card = (rel.cardinality || 'link').replace(/_/g, ' ');
              return (
                <div
                  key={`${rel.left_table}-${rel.left_column}-${rel.right_table}-${rel.right_column}-${idx}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${color.border} ${color.bg} text-xs font-mono`}
                >
                  <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                  <span className="text-slate-200 font-medium">{rel.left_table}.{rel.left_column}</span>
                  <span className="text-slate-500">⟷</span>
                  <span className="text-slate-200 font-medium">{rel.right_table}.{rel.right_column}</span>
                  <span className={`text-[10px] uppercase tracking-wider ${color.text} font-semibold`}>
                    ({card})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Table ER Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {tables.map((table) => {
          const tableName = table.table_name || 'table';
          const rowCount = table.total_rows || 0;
          const cols = table.columns || [];
          const samples = table.sample_rows || [];

          return (
            <div
              key={tableName}
              className="bg-[#0d1322] border border-[#1a243a] hover:border-[#22314f] rounded-2xl shadow-xl overflow-hidden flex flex-col transition"
            >
              {/* Table Card Header */}
              <div className="p-4 bg-[#080d19] border-b border-[#1a243a] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-violet-950/70 border border-violet-800/40 flex items-center justify-center text-violet-400 shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-100 truncate font-mono">
                      {tableName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {rowCount.toLocaleString()} rows • {cols.length} cols
                    </span>
                  </div>
                </div>

                <Chip label={`${cols.length} cols`} className="text-[10px] font-mono shrink-0" />
              </div>

              {/* Column Rows */}
              <div className="divide-y divide-[#141d30] max-h-96 overflow-y-auto">
                {cols.map((col) => {
                  const colKey = `${tableName}.${col.name}`;
                  const relLinks = relMap[colKey] || [];
                  const isPK = col.is_pk || (col.type && col.type.includes('PK'));

                  return (
                    <div
                      key={col.name}
                      className="p-3 flex flex-col gap-1.5 hover:bg-[#070b14]/50 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isPK ? (
                            <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Primary Key" />
                          ) : (
                            getTypeIcon(col.sql_type || col.type)
                          )}
                          <span
                            className={`text-xs font-mono truncate ${
                              isPK ? 'text-amber-200 font-semibold' : 'text-slate-200'
                            }`}
                          >
                            {col.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            {col.type || col.sql_type || 'TEXT'}
                          </span>
                        </div>
                      </div>

                      {/* Associated Relationship Badge */}
                      {relLinks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {relLinks.map((link, lIdx) => (
                            <span
                              key={lIdx}
                              className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md border ${link.color.border} ${link.color.bg} ${link.color.text}`}
                            >
                              <Link2 className="w-2.5 h-2.5" />
                              <span>🔗 {link.target}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Missing / Distribution Micro-facts */}
                      {col.unique_values !== undefined && (
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                          <span>{col.unique_values} distinct</span>
                          {col.missing > 0 && (
                            <span className="text-amber-400/80">• {col.missing} missing</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sample Rows Preview (when toggled) */}
              {showSamples && samples.length > 0 && (
                <div className="p-3 bg-[#060913] border-t border-[#1a243a] flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                    Sample Data
                  </span>
                  <div className="overflow-x-auto text-[11px] font-mono">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#141d30] text-slate-500">
                          {cols.slice(0, 4).map((c) => (
                            <th key={c.name} className="p-1 font-normal">
                              {c.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0e1628] text-slate-300">
                        {samples.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {cols.slice(0, 4).map((c) => (
                              <td key={c.name} className="p-1 truncate max-w-[120px]">
                                {row[c.name] ?? 'null'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

