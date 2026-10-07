import React from 'react';
import { useNovaQuery } from './hooks/useNovaQuery';
import Shell from './components/layout/Shell';
import Modal from './components/common/Modal';
import DatasetReadyBanner from './components/workspace/DatasetReadyBanner';
import QueryCard from './components/workspace/QueryCard';
import ResultsSection from './components/results/ResultsSection';
import HowQueryWorksPanel from './components/lesson/HowQueryWorksPanel';
import DatasetBriefingCard from './components/workspace/DatasetBriefingCard';
import StarterQueriesSection from './components/workspace/StarterQueriesSection';
import {
  mockDatasetBriefing,
  mockStarterQueries,
  mockTryAskingSuggestions,
} from './mockData';
import { Layers, BookOpen, Upload } from 'lucide-react';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    datasetInfo,
    profile,
    reloadProfile,
    queryText,
    setQueryText,
    queryMode,
    setQueryMode,
    loadingQuery,
    queryError,
    queryResult,
    responseTime,
    runQuery,
    history,
    activeHistoryId,
    handleSelectHistory,
    bannerDismissed,
    setBannerDismissed,
    isUploadOpen,
    setIsUploadOpen,
    isHelpOpen,
    setIsHelpOpen,
  } = useNovaQuery();

  // Starter query card clicked: only fills the query input box without auto-running
  const handleSelectStarterQuery = (questionText) => {
    setQueryText(questionText);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Suggestion chip clicked: fills the query input box without auto-running
  const handleSelectSuggestion = (suggestionText) => {
    setQueryText(suggestionText);
  };

  // Active suggestions: backend suggested_queries prioritized over initial starters
  const activeSuggestions =
    queryResult?.suggested_queries && queryResult.suggested_queries.length > 0
      ? queryResult.suggested_queries
      : mockTryAskingSuggestions;

  return (
    <Shell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      datasetInfo={datasetInfo}
      profile={profile}
      history={history}
      activeHistoryId={activeHistoryId}
      onSelectHistory={handleSelectHistory}
      onRefreshSchema={() => reloadProfile()}
      onOpenUpload={() => setIsUploadOpen(true)}
      onOpenHelp={() => setIsHelpOpen(true)}
    >
      {/* Tab 1: Workspace */}
      {activeTab === 'workspace' && (
        <div className="flex flex-col gap-6">
          {/* 1. Dataset Ready Banner (Dismissible) */}
          <DatasetReadyBanner
            isDismissed={bannerDismissed}
            onDismiss={() => setBannerDismissed(true)}
            filename={datasetInfo.name}
            rows={datasetInfo.rows}
            cols={datasetInfo.cols}
            onQuickPreview={() => {
              const briefingEl = document.getElementById('dataset-briefing-section');
              if (briefingEl) briefingEl.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {/* 2. Query Card: Natural Language / SQL editor, Run button, Ctrl+Enter, Suggestion chips */}
          <QueryCard
            queryText={queryText}
            onChangeQuery={setQueryText}
            queryMode={queryMode}
            onChangeMode={setQueryMode}
            onRunQuery={() => runQuery()}
            loading={loadingQuery}
            filename={datasetInfo.name}
            suggestions={activeSuggestions}
            onSelectSuggestion={handleSelectSuggestion}
          />

          {/* 3. Query Execution Output: Results Area + Educational Lesson Panel */}
          {(loadingQuery || queryError || queryResult) && (
            <div id="results-and-lesson-section" className="flex flex-col lg:flex-row items-start gap-6">
              {/* Left Column: Results Section (Table, Charts, SQL) */}
              <div className="flex-1 min-w-0 w-full">
                <ResultsSection
                  loading={loadingQuery}
                  error={queryError}
                  result={queryResult}
                  responseTime={responseTime}
                  onRetry={() => runQuery()}
                />
              </div>

              {/* Right Column: Educational Lesson Panel (Stacked on tablet/mobile) */}
              <div className="w-full lg:w-[400px] xl:w-[440px] shrink-0">
                <HowQueryWorksPanel
                  loading={loadingQuery}
                  error={queryError}
                  // TODO(backend): lesson object returned by /api/query
                  lesson={queryResult?.lesson || null}
                  fallbackExplanation={queryResult?.explanation || ''}
                  onSelectModifyIdea={(questionText) => {
                    setQueryText(questionText);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            </div>
          )}

          {/* 4. Dataset Briefing Card: Schema metadata & Distribution Insight */}
          <div id="dataset-briefing-section">
            <DatasetBriefingCard
              // TODO(backend): briefing will come from GET /api/dataset-briefing
              briefing={mockDatasetBriefing}
              columns={profile?.columns || []}
            />
          </div>

          {/* 5. Recommended Starter Queries Curriculum (Beginner, Intermediate, Advanced) */}
          <StarterQueriesSection
            // TODO(backend): starterQueries will come from GET /api/starter-queries
            starterQueries={mockStarterQueries}
            onSelectQuery={handleSelectStarterQuery}
          />
        </div>
      )}

      {/* Tab 2: Schema Placeholder */}
      {activeTab === 'schema' && (
        <div className="flex flex-col items-center justify-center p-12 bg-[#0d1322] border border-[#1a243a] rounded-2xl text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Schema View</h2>
          <p className="text-xs text-slate-400 max-w-md">
            Full relational schema diagrams, entity relationships, and column statistics. Coming soon.
          </p>
        </div>
      )}

      {/* Tab 3: Practice Placeholder */}
      {activeTab === 'practice' && (
        <div className="flex flex-col items-center justify-center p-12 bg-[#0d1322] border border-[#1a243a] rounded-2xl text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Practice Mode</h2>
          <p className="text-xs text-slate-400 max-w-md">
            Interactive SQL challenges, curriculum exercises, and sandbox testing. Coming soon.
          </p>
        </div>
      )}

      {/* Upload Data Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Dataset"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-400">
            Select a database or tabular file to load into NovaQuery. Supported formats: .db, .sqlite, .sqlite3, .sql, .csv, .xlsx, .json, .parquet.
          </p>
          <label className="border-2 border-dashed border-[#1a243a] hover:border-cyan-500/50 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-[#05080f]/50">
            <Upload className="w-8 h-8 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">
              Click to browse or drop file here
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Max file size 50MB
            </span>
            <input
              type="file"
              accept=".db,.sqlite,.sqlite3,.sql,.csv,.xlsx,.xls,.json,.parquet"
              className="hidden"
              onChange={() => {
                // Upload flow will be fully wired in Stage 5
                setIsUploadOpen(false);
              }}
            />
          </label>
        </div>
      </Modal>

      {/* Help & Shortcuts Modal */}
      <Modal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="NovaQuery Help & Shortcuts"
      >
        <div className="flex flex-col gap-4 text-xs text-slate-300">
          <p>
            NovaQuery allows querying datasets using plain English natural language while simultaneously explaining the generated SQL statements.
          </p>
          <div className="flex flex-col gap-2 font-mono">
            <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Run Query</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 text-[11px]">
                Ctrl + Enter
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Upload Data</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 text-[11px]">
                Ctrl + 0
              </kbd>
            </div>
          </div>
        </div>
      </Modal>
    </Shell>
  );
}