import { useState, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Trophy,
  Lightbulb,
  Sparkles,
  BarChart3,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { PRACTICE_QUESTIONS } from '../../data/practiceQuestions';
import Chip from '../common/Chip';
import SqlBlock from '../results/SqlBlock';
import { THEME } from '../../constants/theme';

/**
 * Shuffles an array immutably using Fisher-Yates algorithm.
 * 
 * @param {Array} array 
 * @returns {Array} Shuffled shallow copy
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

/**
 * NovaQuery Interactive Practice Lab Component.
 * Self-contained client-side quiz with 15 predefined SQL & database challenges.
 */
export default function PracticeLab() {
  // Filter states
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Quiz state
  const [seed, setSeed] = useState(0); // Incremented to trigger reshuffle
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { [questionId]: { selectedIndex, isCorrect } }
  const [showHint, setShowHint] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Derive distinct categories across the full bank
  const allCategories = useMemo(() => {
    const unique = new Set(PRACTICE_QUESTIONS.map((q) => q.category));
    return Array.from(unique);
  }, []);

  // Filter and randomize active questions
  const activeQuestions = useMemo(() => {
    // Reference seed to trigger re-randomization on restart
    void seed;

    let pool = PRACTICE_QUESTIONS;
    if (selectedDifficulty !== 'all') {
      pool = pool.filter((q) => q.difficulty === selectedDifficulty);
    }
    if (selectedCategory !== 'all') {
      pool = pool.filter((q) => q.category === selectedCategory);
    }

    return shuffleArray(pool);
  }, [selectedDifficulty, selectedCategory, seed]);

  // Restart or reset quiz action
  const handleRestart = useCallback(() => {
    setSeed((prev) => prev + 1);
    setCurrentIndex(0);
    setUserAnswers({});
    setShowHint(false);
    setIsCompleted(false);
  }, []);

  // Filter change handlers
  const handleDifficultyChange = (diff) => {
    setSelectedDifficulty(diff);
    setCurrentIndex(0);
    setUserAnswers({});
    setShowHint(false);
    setIsCompleted(false);
    setSeed((prev) => prev + 1);
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setCurrentIndex(0);
    setUserAnswers({});
    setShowHint(false);
    setIsCompleted(false);
    setSeed((prev) => prev + 1);
  };

  const totalQuestions = activeQuestions.length;
  const currentQuestion = activeQuestions[currentIndex] || null;
  const currentAnswer = currentQuestion ? userAnswers[currentQuestion.id] : null;
  const isAnswered = currentAnswer !== undefined;

  // Answer selection handler (locks question immediately)
  const handleSelectOption = (optionIndex) => {
    if (!currentQuestion || isAnswered) return;

    const isCorrect = optionIndex === currentQuestion.correctIndex;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        selectedIndex: optionIndex,
        isCorrect,
      },
    }));
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowHint(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setShowHint(false);
    }
  };

  // Performance calculations
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = Object.values(userAnswers).filter((a) => a.isCorrect).length;
  const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // Category breakdown calculation for results screen
  const categoryStats = useMemo(() => {
    const stats = {};
    activeQuestions.forEach((q) => {
      if (!stats[q.category]) {
        stats[q.category] = { total: 0, correct: 0 };
      }
      stats[q.category].total += 1;
      if (userAnswers[q.id]?.isCorrect) {
        stats[q.category].correct += 1;
      }
    });
    return stats;
  }, [activeQuestions, userAnswers]);

  // Difficulty breakdown for results screen
  const difficultyStats = useMemo(() => {
    const stats = {
      beginner: { total: 0, correct: 0 },
      intermediate: { total: 0, correct: 0 },
      advanced: { total: 0, correct: 0 },
    };
    activeQuestions.forEach((q) => {
      if (stats[q.difficulty]) {
        stats[q.difficulty].total += 1;
        if (userAnswers[q.id]?.isCorrect) {
          stats[q.difficulty].correct += 1;
        }
      }
    });
    return stats;
  }, [activeQuestions, userAnswers]);

  // ==========================================
  // RENDER: EMPTY FILTER STATE
  // ==========================================
  if (totalQuestions === 0) {
    return (
      <div className="flex flex-col gap-6 animate-fadeIn">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1a243a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-violet-400 shadow-md">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100">Practice Lab</h1>
              <p className="text-xs text-slate-400">
                Interactive SQL & database challenges with step-by-step feedback.
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center p-12 bg-[#0d1322] border border-[#1a243a] rounded-2xl text-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
            <Filter className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-200">No questions match the current filter</h2>
          <p className="text-xs text-slate-400 max-w-sm">
            Try adjusting your topic or difficulty filter to view available SQL practice questions.
          </p>
          <button
            onClick={() => {
              setSelectedDifficulty('all');
              setSelectedCategory('all');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-violet-950 active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: QUIZ COMPLETED SUMMARY VIEW
  // ==========================================
  if (isCompleted) {
    let performanceBadge = 'Solid Foundation 🚀';
    let performanceColor = 'text-violet-400 border-violet-800/50 bg-violet-950/40';
    if (scorePercentage === 100) {
      performanceBadge = 'Perfect Score! 🌟 SQL Expert';
      performanceColor = 'text-emerald-300 border-emerald-700/50 bg-emerald-950/40';
    } else if (scorePercentage >= 80) {
      performanceBadge = 'Great Job! 🎯 Advanced Mastery';
      performanceColor = 'text-emerald-400 border-emerald-800/40 bg-emerald-950/30';
    } else if (scorePercentage < 60) {
      performanceBadge = 'Keep Practicing! 💡 Review Concepts Below';
      performanceColor = 'text-amber-400 border-amber-800/40 bg-amber-950/30';
    }

    return (
      <div className="flex flex-col gap-6 animate-fadeIn max-w-4xl mx-auto w-full">
        {/* Results Banner */}
        <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center gap-5 shadow-xl relative overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 shadow-lg">
            <Trophy className="w-8 h-8" />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={`inline-block mx-auto text-xs font-mono px-3 py-1 rounded-full border ${performanceColor}`}>
              {performanceBadge}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight mt-1">
              Quiz Completed!
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              You scored <span className="text-violet-400 font-semibold">{correctCount}</span> out of{' '}
              <span className="text-slate-200 font-semibold">{totalQuestions}</span> questions correctly (
              <span className="text-violet-400 font-mono font-semibold">{scorePercentage}%</span>).
            </p>
          </div>

          {/* Key Metric Cards */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-lg mt-2">
            <div className="bg-[#070a13] border border-[#1a243a] rounded-xl p-3 flex flex-col items-center">
              <span className="text-slate-500 text-[11px] font-mono uppercase">Score</span>
              <span className="text-lg sm:text-xl font-bold text-slate-100">
                {correctCount}/{totalQuestions}
              </span>
            </div>
            <div className="bg-[#070a13] border border-[#1a243a] rounded-xl p-3 flex flex-col items-center">
              <span className="text-slate-500 text-[11px] font-mono uppercase">Accuracy</span>
              <span className="text-lg sm:text-xl font-bold text-violet-400 font-mono">
                {scorePercentage}%
              </span>
            </div>
            <div className="bg-[#070a13] border border-[#1a243a] rounded-xl p-3 flex flex-col items-center">
              <span className="text-slate-500 text-[11px] font-mono uppercase">Answered</span>
              <span className="text-lg sm:text-xl font-bold text-slate-200">
                {answeredCount}/{totalQuestions}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm transition shadow-md shadow-violet-950 active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart Quiz</span>
            </button>
            <button
              onClick={() => {
                setIsCompleted(false);
                setCurrentIndex(0);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-medium text-xs sm:text-sm transition active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>Review Answers</span>
            </button>
          </div>
        </div>

        {/* Breakdown by Difficulty */}
        <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#1a243a]">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs sm:text-sm font-semibold text-slate-200">
              Performance by Difficulty Level
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(difficultyStats).map(([diffKey, data]) => {
              if (data.total === 0) return null;
              const diffPct = Math.round((data.correct / data.total) * 100);
              const diffConfig = THEME.difficulty[diffKey];
              return (
                <div
                  key={diffKey}
                  className="bg-[#070a13] border border-[#1a243a] rounded-xl p-3.5 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: diffConfig?.dot || '#8b5cf6' }}
                      />
                      <span className="text-xs font-semibold capitalize text-slate-200">
                        {diffKey}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {data.correct}/{data.total}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 transition-all duration-500 rounded-full"
                      style={{ width: `${diffPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Breakdown by Category */}
        <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#1a243a]">
            <GraduationCap className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs sm:text-sm font-semibold text-slate-200">
              Performance by Topic Category
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(categoryStats).map(([category, data]) => {
              const catPct = Math.round((data.correct / data.total) * 100);
              return (
                <div
                  key={category}
                  className="bg-[#070a13] border border-[#1a243a] rounded-xl p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 truncate">{category}</span>
                    <span className="font-mono text-slate-400 ml-2">
                      {data.correct}/{data.total}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        catPct === 100
                          ? 'bg-emerald-400'
                          : catPct >= 50
                          ? 'bg-violet-400'
                          : 'bg-rose-400'
                      }`}
                      style={{ width: `${catPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: ACTIVE QUIZ VIEW
  // ==========================================
  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn max-w-4xl mx-auto w-full">
      {/* Top Header: Title, Subtitle, and Filter Controls */}
      <header className="flex flex-col gap-4 pb-4 border-b border-[#1a243a]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-violet-400 shadow-md">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-100">
                  SQL Practice Lab
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950/50 text-violet-300 border border-violet-800/40">
                  15 Questions
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interactive curriculum challenges with instantaneous clause explanations and hints.
              </p>
            </div>
          </div>

          {/* Reset / Reshuffle Button */}
          <button
            onClick={handleRestart}
            title="Randomize & restart quiz"
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Restart & Shuffle</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px] mr-1">
            <Filter className="w-3 h-3" />
            <span>Difficulty:</span>
          </div>

          {['all', 'beginner', 'intermediate', 'advanced'].map((diff) => {
            const isActive = selectedDifficulty === diff;
            return (
              <button
                key={diff}
                onClick={() => handleDifficultyChange(diff)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition capitalize ${
                  isActive
                    ? 'bg-violet-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                {diff === 'all' ? 'All Levels' : diff}
              </button>
            );
          })}

          <div className="hidden sm:inline-block w-px h-4 bg-slate-800 mx-1" />

          {/* Optional Category Quick Selector */}
          <div className="flex items-center gap-1.5 ml-auto">
            <label htmlFor="category-filter" className="text-slate-500 font-mono text-[11px]">
              Topic:
            </label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">All Topics ({PRACTICE_QUESTIONS.length})</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Progress Bar & Header Meta */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-violet-400 font-semibold">
              Question {currentIndex + 1}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{totalQuestions}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              Score:{' '}
              <strong className="text-slate-200 font-semibold">{correctCount}</strong>
              <span className="text-slate-600"> / </span>
              <span>{answeredCount} answered</span>
            </span>
            <span className="text-violet-300 font-semibold">
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-2 bg-slate-900 border border-slate-800/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-300 rounded-full shadow-sm shadow-violet-500/30"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      {currentQuestion && (
        <div className="bg-[#0d1322] border border-[#1a243a] rounded-2xl p-5 sm:p-7 flex flex-col gap-5 shadow-xl transition-all">
          {/* Card Meta Bar: Category, Difficulty, Hint Button */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#1a243a]">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip
                label={currentQuestion.category}
                variant="tag"
                className="text-violet-300 border-violet-800/40 bg-violet-950/30"
              />
              <Chip
                label={THEME.difficulty[currentQuestion.difficulty]?.label || currentQuestion.difficulty}
                variant="difficulty"
                difficultyKey={currentQuestion.difficulty}
              />
            </div>

            {/* Hint Toggle Button */}
            {currentQuestion.hint && (
              <button
                onClick={() => setShowHint((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition border ${
                  showHint
                    ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lightbulb className={`w-3.5 h-3.5 ${showHint ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>{showHint ? 'Hide Hint' : 'Show Hint'}</span>
              </button>
            )}
          </div>

          {/* Hint Drawer (if toggled) */}
          {showHint && currentQuestion.hint && (
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-700/30 text-amber-200 text-xs flex items-start gap-2.5 animate-fadeIn">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-amber-300">Helpful Hint: </span>
                {currentQuestion.hint}
              </div>
            </div>
          )}

          {/* Question Text */}
          <h2 className="text-base sm:text-lg font-semibold text-slate-100 leading-snug">
            {currentQuestion.question}
          </h2>

          {/* Optional Syntax-Highlighted SQL Snippet */}
          {currentQuestion.sqlSnippet && currentQuestion.sqlSnippet.trim().length > 0 && (
            <div className="w-full">
              <SqlBlock sql={currentQuestion.sqlSnippet} dialect="SQL" />
            </div>
          )}

          {/* Answer Options Grid */}
          <div className="flex flex-col gap-2.5 pt-1">
            {currentQuestion.options.map((optionText, optIdx) => {
              const isSelected = currentAnswer?.selectedIndex === optIdx;
              const isCorrectOption = optIdx === currentQuestion.correctIndex;

              let buttonStyle = 'bg-[#090e1a] border-[#1a243a] text-slate-200 hover:border-violet-500/50 hover:bg-[#0f172a]';
              let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';

              if (isAnswered) {
                if (isCorrectOption) {
                  // Highlight correct answer in emerald
                  buttonStyle = 'bg-emerald-950/40 border-emerald-500/70 text-emerald-200 ring-1 ring-emerald-500/30';
                  badgeStyle = 'bg-emerald-500 text-slate-950 font-bold border-transparent';
                } else if (isSelected && !currentAnswer.isCorrect) {
                  // Highlight user's wrong answer in rose
                  buttonStyle = 'bg-rose-950/40 border-rose-500/70 text-rose-200 ring-1 ring-rose-500/30';
                  badgeStyle = 'bg-rose-500 text-slate-950 font-bold border-transparent';
                } else {
                  // Dim unselected incorrect choices
                  buttonStyle = 'bg-[#090e1a]/40 border-[#151f33] text-slate-500 opacity-60 cursor-not-allowed';
                  badgeStyle = 'bg-slate-900 text-slate-600 border-slate-800';
                }
              }

              return (
                <button
                  key={optIdx}
                  onClick={() => handleSelectOption(optIdx)}
                  disabled={isAnswered}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 group ${buttonStyle} ${
                    !isAnswered ? 'cursor-pointer active:scale-[0.99]' : ''
                  }`}
                >
                  {/* Option Letter Indicator */}
                  <span
                    className={`w-6 h-6 rounded-lg text-xs font-mono font-semibold flex items-center justify-center shrink-0 border transition ${badgeStyle}`}
                  >
                    {OPTION_LABELS[optIdx]}
                  </span>

                  {/* Option Text */}
                  <span className="text-xs sm:text-sm leading-relaxed flex-1 pt-0.5">
                    {optionText}
                  </span>

                  {/* Trailing Feedback Icon */}
                  {isAnswered && (
                    <div className="shrink-0 pt-0.5">
                      {isCorrectOption ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : isSelected && !currentAnswer.isCorrect ? (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      ) : null}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Post-Answer Explanation & Feedback Drawer */}
          {isAnswered && (
            <div className="flex flex-col gap-3 pt-3 border-t border-[#1a243a] animate-fadeIn">
              {/* Outcome Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                  currentAnswer.isCorrect
                    ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                    : 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                }`}
              >
                {currentAnswer.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-300">Correct Answer!</h4>
                      <p className="text-[11px] text-emerald-400/90">
                        Excellent work understanding this database concept.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-300">Incorrect</h4>
                      <p className="text-[11px] text-rose-400/90">
                        The correct answer is option{' '}
                        <strong className="text-slate-100 font-mono">
                          {OPTION_LABELS[currentQuestion.correctIndex]}
                        </strong>
                        . Review the explanation below.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Detailed Explanation */}
              <div className="bg-[#090e1a] border border-[#1a243a] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <HelpCircle className="w-4 h-4 text-violet-400" />
                  <span>Explanation</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {currentQuestion.explanation}
                </p>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1a243a] gap-3">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
                currentIndex === 0
                  ? 'opacity-40 border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {/* Next / Finish Button */}
            <button
              onClick={handleNext}
              disabled={!isAnswered}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-md active:scale-95 ${
                !isAnswered
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40 shadow-none'
                  : currentIndex === totalQuestions - 1
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:brightness-110 shadow-violet-950'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-950'
              }`}
            >
              <span>
                {currentIndex === totalQuestions - 1 ? 'Complete Quiz & View Results' : 'Next Question'}
              </span>
              {currentIndex === totalQuestions - 1 ? (
                <Trophy className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
