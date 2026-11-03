import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { THEME } from '../../constants/theme';

const PIE_COLORS = [
  '#8b5cf6', // violet-500
  '#6366f1', // indigo-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
];

/**
 * Auto-selects optimal chart type from dataset shape.
 */
function determineOptimalChartType(rows, xAxisKey, numericKeys) {
  if (!rows || rows.length === 0 || numericKeys.length === 0) return 'bar';

  // Rule 1: Pie chart for 2 to 6 non-negative parts of a whole
  if (numericKeys.length === 1 && rows.length >= 2 && rows.length <= 6) {
    const allPositive = rows.every((r) => Number(r[numericKeys[0]]) >= 0);
    if (allPositive) return 'pie';
  }

  // Rule 2: Line chart for time-based, sequential or continuous trends
  const isTimeKey = /date|time|year|month|day|timestamp|hour|period|index/i.test(xAxisKey || '');
  if (isTimeKey || rows.length >= 10) {
    return 'line';
  }

  // Rule 3: Bar chart default for discrete categories, comparisons, rankings
  return 'bar';
}

/**
 * Smart auto-charting component using Recharts.
 * 
 * @param {Object} props
 * @param {Array<Object>} props.data - Query result row objects
 */
export default function DataChart({ data = [] }) {
  const rows = Array.isArray(data) ? data : [];

  // Determine keys
  const { xAxisKey, numericKeys, allKeys } = useMemo(() => {
    if (rows.length === 0) return { xAxisKey: '', numericKeys: [], allKeys: [] };
    const keys = Object.keys(rows[0]);
    const numKeys = keys.filter(
      (k) => rows.some((r) => typeof r[k] === 'number')
    );
    const catKeys = keys.filter((k) => !numKeys.includes(k));
    const xKey = catKeys[0] || keys[0] || '';

    return {
      xAxisKey: xKey,
      numericKeys: numKeys.length > 0 ? numKeys : (keys[1] ? [keys[1]] : []),
      allKeys: keys,
    };
  }, [rows]);

  // Determine auto-selected chart type
  const autoChartType = useMemo(
    () => determineOptimalChartType(rows, xAxisKey, numericKeys),
    [rows, xAxisKey, numericKeys]
  );

  // User can override chart type if desired
  const [selectedChartType, setSelectedChartType] = useState('auto');
  const activeType = selectedChartType === 'auto' ? autoChartType : selectedChartType;

  if (rows.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs">
        No data available to visualize.
      </div>
    );
  }

  if (numericKeys.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center p-6 gap-2 text-slate-400 font-mono text-xs bg-[#05080f] rounded-xl border border-[#1a243a]">
        <p>No numeric columns detected.</p>
        <p className="text-slate-500 font-sans text-[11px]">
          Charts require numerical metrics (integers or decimals) to plot.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Chart controls bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider">Dimension:</span>
          <span className="text-violet-400 font-semibold">{xAxisKey}</span>
          <span className="text-slate-600">•</span>
          <span className="text-[11px] text-slate-500 uppercase tracking-wider">Metric:</span>
          <span className="text-slate-200">{numericKeys.join(', ')}</span>
        </div>

        {/* Chart type selector pills */}
        <div className="flex items-center p-1 rounded-lg bg-[#05080f] border border-[#151f33] text-[11px] font-mono">
          <button
            onClick={() => setSelectedChartType('auto')}
            className={`px-2.5 py-0.5 rounded transition ${
              selectedChartType === 'auto'
                ? 'bg-slate-800 text-violet-300 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Auto ({autoChartType})
          </button>
          <button
            onClick={() => setSelectedChartType('bar')}
            className={`px-2 py-0.5 rounded transition ${
              selectedChartType === 'bar'
                ? 'bg-slate-800 text-violet-300 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bar
          </button>
          <button
            onClick={() => setSelectedChartType('line')}
            className={`px-2 py-0.5 rounded transition ${
              selectedChartType === 'line'
                ? 'bg-slate-800 text-violet-300 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Line
          </button>
          <button
            onClick={() => setSelectedChartType('pie')}
            className={`px-2 py-0.5 rounded transition ${
              selectedChartType === 'pie'
                ? 'bg-slate-800 text-violet-300 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pie
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[320px] bg-[#05080f] border border-[#1a243a] rounded-xl p-4">
        <ResponsiveContainer width="100%" height="100%">
          {activeType === 'bar' ? (
            <BarChart data={rows} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey={xAxisKey}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
              />
              {numericKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
              {numericKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={i === 0 ? '#8b5cf6' : PIE_COLORS[i % PIE_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          ) : activeType === 'line' ? (
            <LineChart data={rows} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey={xAxisKey}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
              />
              {numericKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
              {numericKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={i === 0 ? '#8b5cf6' : PIE_COLORS[i % PIE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          ) : (
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Pie
                data={rows}
                dataKey={numericKeys[0]}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={45}
                paddingAngle={3}
              >
                {rows.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
