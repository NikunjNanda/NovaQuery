import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  BarChart2, 
  Table as TableIcon, 
  RefreshCw, 
  Database, 
  Layers, 
  AlertCircle, 
  Activity, 
  Code, 
  BookOpen, 
  Sparkles 
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { uploadDatabase, executeQuery, fetchProfile } from './api';

export default function App() {
  const [file, setFile] = useState(null);
  const [dbPath, setDbPath] = useState(null);
  const [query, setQuery] = useState('Show me the top 10 rows');
  const [activeView, setActiveView] = useState('table'); // 'table' | 'chart'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data Profiling State
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Query Results & Educational Metadata State
  const [results, setResults] = useState([]);
  const [generatedSql, setGeneratedSql] = useState('');
  const [explanation, setExplanation] = useState('');
  const [suggestedQueries, setSuggestedQueries] = useState([]);

  // Load dataset profile from backend
  const loadProfile = async (targetPath = null) => {
    setLoadingProfile(true);
    try {
      const data = await fetchProfile(targetPath);
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch initial profile on mount if active DB exists
  useEffect(() => {
    loadProfile();
  }, []);

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    setError(null);

    try {
      const res = await uploadDatabase(uploadedFile);
      if (res.success) {
        setDbPath(res.db_path);
        await loadProfile(res.db_path);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteQuery = async (queryToRun = query) => {
    if (!queryToRun.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await executeQuery(queryToRun, dbPath);
      
      // Extract data rows
      if (res.data) {
        setResults(res.data);
      } else if (res.results) {
        setResults(res.results);
      } else if (Array.isArray(res)) {
        setResults(res);
      } else {
        setResults([]);
      }

      // Extract educational metadata returned by updated backend
      setGeneratedSql(res.generated_sql || '');
      setExplanation(res.explanation || '');
      setSuggestedQueries(res.suggested_queries || []);

    } catch (err) {
      setError(err.response?.data?.detail || 'Query execution failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestedText) => {
    setQuery(suggestedText);
    handleExecuteQuery(suggestedText);
  };

  // Safe Key extraction for Table headers and Chart axes
  const dataKeys = results && results.length > 0 ? Object.keys(results[0]) : [];
  const xAxisKey = dataKeys[0] || '';
  const numericKeys = dataKeys.filter(
    key => key !== xAxisKey && typeof results[0]?.[key] === 'number'
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4 flex items-center justify-between backdrop-blur">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-cyan-400" />
          <h1 className="text-lg font-bold text-slate-100">NovaQuery</h1>
        </div>

        {/* Upload Button */}
        <label className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 font-medium">
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Upload File</span>
          <input 
            type="file" 
            accept=".db,.sqlite,.sqlite3,.sql,.csv,.xlsx,.xls,.json,.parquet" 
            onChange={handleFileUpload} 
            className="hidden" 
          />
        </label>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col gap-6">
        {file && (
          <div className="text-xs text-cyan-400 bg-cyan-950/30 border border-cyan-800/50 rounded-lg p-2.5 flex items-center justify-between">
            <span>Loaded File: <strong>{file.name}</strong></span>
            <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}

        {/* Automated Data Profiling Banner */}
        {profile && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-md">
              <Layers className="w-8 h-8 text-cyan-400 p-1.5 bg-cyan-950/50 rounded-lg" />
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Total Rows</p>
                <p className="text-lg font-bold text-slate-100">{profile.total_rows?.toLocaleString() ?? 0}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-md">
              <TableIcon className="w-8 h-8 text-indigo-400 p-1.5 bg-indigo-950/50 rounded-lg" />
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Columns</p>
                <p className="text-lg font-bold text-slate-100">{profile.total_columns ?? 0}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-md">
              <AlertCircle className="w-8 h-8 text-amber-400 p-1.5 bg-amber-950/50 rounded-lg" />
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Missing Values</p>
                <p className="text-lg font-bold text-slate-100">{profile.total_missing_values?.toLocaleString() ?? 0}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-md">
              <Activity className="w-8 h-8 text-emerald-400 p-1.5 bg-emerald-950/50 rounded-lg" />
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase">Active Table</p>
                <p className="text-sm font-bold text-slate-100 truncate">{profile.table_name || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-800/50 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Query Editor Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Natural Language Query Engine</span>
            <button
              onClick={() => handleExecuteQuery(query)}
              disabled={loading}
              className="text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-1.5 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Run Query'}
            </button>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-20 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 transition resize-none"
            placeholder="Ask a question in plain English (e.g. Show me the top 10 rows)..."
          />
        </div>

        {/* Educational Cards: Generated SQL & Teacher Explanation */}
        {(generatedSql || explanation) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Generated SQL Box */}
            {generatedSql && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex flex-col gap-2">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider">
                  <Code className="w-4 h-4" />
                  <span>Generated SQL Statement</span>
                </div>
                <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto border border-slate-800/80">
                  {generatedSql}
                </pre>
              </div>
            )}

            {/* Teacher Explanation Box */}
            {explanation && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                  <BookOpen className="w-4 h-4" />
                  <span>Teacher Explanation</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                  {explanation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Suggested Follow-up Query Chips */}
        {suggestedQueries.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5 mr-2">
              <Sparkles className="w-3.5 h-3.5" /> Suggested Queries:
            </span>
            {suggestedQueries.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(item)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 px-3 py-1 rounded-full transition"
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {/* Results Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 shadow-lg flex-1">
          {/* Controls Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Query Output ({results.length} rows)
            </span>
            
            {/* View Toggle */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveView('table')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition ${
                  activeView === 'table' ? 'bg-slate-800 text-cyan-400 font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                onClick={() => setActiveView('chart')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition ${
                  activeView === 'chart' ? 'bg-slate-800 text-cyan-400 font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Visualization
              </button>
            </div>
          </div>

          {/* View Container */}
          <div className="flex-1 min-h-[300px]">
            {results.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
                No data returned. Upload a file or run a query to get started.
              </div>
            ) : activeView === 'table' ? (
              /* Data Table View */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                      {dataKeys.map((key) => (
                        <th key={key} className="p-3 font-semibold uppercase">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {results.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-800/30 transition">
                        {dataKeys.map((key) => (
                          <td key={key} className="p-3 text-slate-300 font-mono">{String(row[key] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Recharts Visualization View */
              <div className="w-full h-[320px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey={xAxisKey} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    {numericKeys.map((key, i) => (
                      <Bar 
                        key={key} 
                        dataKey={key} 
                        fill={i % 2 === 0 ? '#06b6d4' : '#6366f1'} 
                        radius={[4, 4, 0, 0]} 
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 