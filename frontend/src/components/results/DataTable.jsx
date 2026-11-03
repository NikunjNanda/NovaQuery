import React, { useMemo } from 'react';
import Chip from '../common/Chip';

/**
 * Data table rendering query output rows.
 * 
 * @param {Object} props
 * @param {Array<Object>} props.data - Query result row objects
 * @param {number} [props.maxRows=100] - Row rendering limit
 */
export default function DataTable({ data = [], maxRows = 100 }) {
  const rows = Array.isArray(data) ? data : [];
  const totalRows = rows.length;

  // Extract columns from first row
  const columns = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  // Find numeric column for relative distribution bar calculation
  const { numericColumn, maxNumericValue } = useMemo(() => {
    if (rows.length === 0) return { numericColumn: null, maxNumericValue: 0 };
    for (const col of columns) {
      const isNum = rows.some((r) => typeof r[col] === 'number');
      if (isNum) {
        let max = 0;
        rows.forEach((r) => {
          const val = Number(r[col]);
          if (!isNaN(val) && val > max) max = val;
        });
        return { numericColumn: col, maxNumericValue: max > 0 ? max : 1 };
      }
    }
    return { numericColumn: null, maxNumericValue: 0 };
  }, [rows, columns]);

  // Display limited rows for performance
  const displayRows = useMemo(() => {
    return rows.slice(0, maxRows);
  }, [rows, maxRows]);

  if (totalRows === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-slate-500 font-mono text-xs">
        <p>0 rows returned.</p>
        <p className="text-slate-600 font-sans text-[11px]">
          The query executed successfully but produced an empty dataset.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-[#1a243a] bg-[#05080f]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1a243a] bg-[#090e1a]/80 text-slate-400 font-mono">
              {columns.map((col) => {
                const sampleVal = rows[0]?.[col];
                let typeLabel = typeof sampleVal === 'number' ? (Number.isInteger(sampleVal) ? 'INT' : 'REAL') : 'TEXT';
                return (
                  <th key={col} className="p-3 font-semibold uppercase tracking-wider text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300">{col}</span>
                      <Chip label={typeLabel} variant="type" />
                    </div>
                  </th>
                );
              })}
              {numericColumn && (
                <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-slate-400 text-right">
                  Relative
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#151f33]">
            {displayRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-900/40 transition font-mono">
                {columns.map((col, colIndex) => {
                  const val = row[col];
                  const isFirstCol = colIndex === 0;

                  return (
                    <td key={col} className="p-3 text-slate-300">
                      <div className="flex items-center gap-2">
                        {isFirstCol && (
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                        )}
                        <span>{val !== null && val !== undefined ? String(val) : 'NULL'}</span>
                      </div>
                    </td>
                  );
                })}

                {/* Relative progress bar */}
                {numericColumn && (
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 sm:w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, (Number(row[numericColumn]) / maxNumericValue) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Truncation notice if rows exceed 100 */}
      {totalRows > maxRows && (
        <div className="px-3 py-2 rounded-lg bg-[#090e1a] border border-[#1a243a] text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <span>
            Showing first {maxRows} of {totalRows.toLocaleString()} rows.
          </span>
          <span className="text-slate-500">Download CSV to inspect all records.</span>
        </div>
      )}
    </div>
  );
}
