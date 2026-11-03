/**
 * Theme tokens and design constants for NovaQuery
 * Centralized palette tokens, difficulty colors, chip variants, and chart aesthetics.
 */

export const THEME = {
  // Background surfaces
  bg: {
    page: '#070a13',         // Deep near-black navy page canvas
    card: '#0d1322',         // Card surface background
    cardHover: '#121a2e',    // Slightly elevated hover state
    cardBorder: '#1a243a',   // 1px subtle card border
    inset: '#05080f',        // Textarea / Code block / Terminal inset
    insetBorder: '#151f33',  // Inset input border
  },

  // Brand and accent colors - Unified to Landing Page Violet Visual Identity
  accent: {
    primary: '#8b5cf6',       // Electric Violet primary
    primaryHover: '#7c3aed',  // Bright Violet hover
    primaryMuted: 'rgba(139, 92, 246, 0.15)',
    primaryBorder: 'rgba(139, 92, 246, 0.35)',
    glow: 'rgba(139, 92, 246, 0.25)',
    lavender: '#d0bcff',      // Lavender highlight
    cyan: '#54d8e7',          // Controlled cyan secondary accent
    cyanHover: '#22d3ee',
    cyanMuted: 'rgba(84, 216, 231, 0.12)',
    cyanBorder: 'rgba(84, 216, 231, 0.3)',
  },

  // Text hierarchy
  text: {
    primary: '#f1f5f9',      // Slate-100 for titles and key content
    secondary: '#94a3b8',    // Slate-400 for descriptions and labels
    muted: '#64748b',        // Slate-500 for placeholders and subtle meta
    accent: '#d0bcff',       // Lavender for highlights
  },

  // Curriculum difficulty color tokens
  difficulty: {
    beginner: {
      label: 'Beginner',
      badge: 'Fundamentals',
      dot: '#10b981',        // emerald-500
      text: 'text-emerald-400',
      bg: 'bg-emerald-950/40',
      border: 'border-emerald-800/40',
      pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    intermediate: {
      label: 'Intermediate',
      badge: 'Aggregation',
      dot: '#6366f1',        // indigo-500
      text: 'text-indigo-400',
      bg: 'bg-indigo-950/40',
      border: 'border-indigo-800/40',
      pill: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    },
    advanced: {
      label: 'Advanced',
      badge: 'Filtering & Ranking',
      dot: '#f43f5e',        // rose-500
      text: 'text-rose-400',
      bg: 'bg-rose-950/40',
      border: 'border-rose-800/40',
      pill: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
  },

  // SQL data types chip token mappings
  dataTypeChips: {
    'INT PK': {
      bg: 'bg-purple-950/50',
      text: 'text-purple-300',
      border: 'border-purple-700/50',
    },
    'INT': {
      bg: 'bg-blue-950/50',
      text: 'text-blue-300',
      border: 'border-blue-700/50',
    },
    'INTEGER': {
      bg: 'bg-blue-950/50',
      text: 'text-blue-300',
      border: 'border-blue-700/50',
    },
    'REAL': {
      bg: 'bg-cyan-950/50',
      text: 'text-cyan-300',
      border: 'border-cyan-700/50',
    },
    'FLOAT': {
      bg: 'bg-cyan-950/50',
      text: 'text-cyan-300',
      border: 'border-cyan-700/50',
    },
    'DOUBLE': {
      bg: 'bg-cyan-950/50',
      text: 'text-cyan-300',
      border: 'border-cyan-700/50',
    },
    'TEXT': {
      bg: 'bg-emerald-950/50',
      text: 'text-emerald-300',
      border: 'border-emerald-700/50',
    },
    'VARCHAR': {
      bg: 'bg-emerald-950/50',
      text: 'text-emerald-300',
      border: 'border-emerald-700/50',
    },
    'DATE': {
      bg: 'bg-amber-950/50',
      text: 'text-amber-300',
      border: 'border-amber-700/50',
    },
    'BOOLEAN': {
      bg: 'bg-pink-950/50',
      text: 'text-pink-300',
      border: 'border-pink-700/50',
    },
    'DEFAULT': {
      bg: 'bg-slate-800/60',
      text: 'text-slate-300',
      border: 'border-slate-700/50',
    },
  },

  // SQL Clause keyword chips
  clauseChips: {
    'SELECT': 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50',
    'FROM': 'bg-blue-950/60 text-blue-300 border-blue-700/50',
    'WHERE': 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50',
    'GROUP BY': 'bg-purple-950/60 text-purple-300 border-purple-700/50',
    'HAVING': 'bg-pink-950/60 text-pink-300 border-pink-700/50',
    'ORDER BY': 'bg-amber-950/60 text-amber-300 border-amber-700/50',
    'LIMIT': 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
    'JOIN': 'bg-teal-950/60 text-teal-300 border-teal-700/50',
    'INNER JOIN': 'bg-teal-950/60 text-teal-300 border-teal-700/50',
    'LEFT JOIN': 'bg-teal-950/60 text-teal-300 border-teal-700/50',
    'DEFAULT': 'bg-slate-800/80 text-slate-300 border-slate-700/60',
  },

  // Chart palette for Recharts
  chart: {
    primary: '#8b5cf6',      // Violet-500 primary series
    secondary: '#54d8e7',    // Controlled Cyan secondary series
    tertiary: '#10b981',     // Emerald-500
    accent: '#f59e0b',       // Amber-500
    warning: '#f43f5e',      // Rose-500
    grid: '#1e293b',         // Slate-800 gridline
    text: '#94a3b8',         // Slate-400 tick text
    tooltipBg: '#0f172a',
    tooltipBorder: '#1e293b',
  },
};
