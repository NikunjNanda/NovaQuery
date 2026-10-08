import React from 'react';
import { useNovaQuery } from './hooks/useNovaQuery';
import { useDatasetBriefing } from './hooks/useDatasetBriefing';
import Shell from './components/layout/Shell';
import Modal from './components/common/Modal';
import Skeleton from './components/common/Skeleton';
import DatasetReadyBanner from './components/workspace/DatasetReadyBanner';
import QueryCard from './components/workspace/QueryCard';
import ResultsSection from './components/results/ResultsSection';
import HowQueryWorksPanel from './components/lesson/HowQueryWorksPanel';
import DatasetBriefingCard from './components/workspace/DatasetBriefingCard';
import StarterQueriesSection from './components/workspace/StarterQueriesSection';
import PracticeLab from './components/practice/PracticeLab';
import { Layers, Upload, RefreshCw } from 'lucide-react';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    datasetInfo,
    profile,
    loadingProfile,
    profileError,
    reloadProfile,
    dbPath,
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
    isUploading,
    uploadError,
    handleUploadFile,
  } = useNovaQuery();

  const {
    briefing,
    loadingBriefing,
    briefingError,
    reloadBriefing,
  } = useDatasetBriefing(dbPath, Boolean(profile));

  // Starter query card clicked: only fills the query input box without auto-running
  const handleSelectStarterQuery = (questionText) => {
    setQueryText(questionText);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Suggestion chip clicked: fills the query input box without auto-running
  const handleSelectSuggestion = (suggestionText) => {
    setQueryText(suggestionText);
  };

  // Active suggestions: backend suggested_queries prioritized over briefing.try_asking
  const activeSuggestions =
    queryResult?.suggested_queries && queryResult.suggested_queries.length > 0
      ? queryResult.suggested_queries
      : (briefing?.try_asking || []);

  return (
    <Shell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      datasetInfo={datasetInfo}
      profile={profile}
      history={history}
      activeHistoryId={activeHistoryId}
      onSelectHistory={handleSelectHistory}
      onRefreshSchema={() => reloadProfile(dbPath)}
      onOpenUpload={() => setIsUploadOpen(true)}
      onOpenHelp={() => setIsHelpOpen(true)}
    >
      {/* Tab 1: Workspace */}
      {activeTab === 'workspace' && (
        <div className="flex flex-col gap-6">
          {loadingProfile ? (
            <div className="flex flex-col gap-6 animate-fadeIn">
              <Skeleton className="w-full h-12 rounded-xl" />
              <Skeleton className="w-full h-36 rounded-2xl" />
              <Skeleton className="w-full h-48 rounded-2xl" />
            </div>
          ) : !profile ? (
            /* Empty State when no dataset active or loading failed */
            <div className="flex flex-col items-center justify-center p-12 sm:p-16 bg-[#0d1322] border border-[#1a243a] rounded-2xl text-center gap-4 my-6 animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
                <Upload className="w-7 h-7" />
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-base sm:text-lg font-semibold text-slate-100">
                  Upload a dataset to get started
                </h2>
                <p className="text-xs text-slate-400 max-w-md">
                  Upload a SQLite database or tabular file (.csv, .xlsx, .json, .parquet) to explore and query with AI.
                </p>
              </div>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition shadow-md shadow-cyan-950 active:scale-95 mt-1"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Dataset</span>
              </button>
              {profileError && (
                <p className="text-[11px] font-mono text-rose-400/90 max-w-lg mt-2 px-3 py-1.5 rounded bg-rose-950/20 border border-rose-900/30">
                  {profileError}
                </p>
              )}
            </div>
          ) : (
            /* Active Dataset Workspace */
            <>
              {/* 1. Dataset Ready Banner (Dismissible) */}
              <DatasetReadyBanner
                isDismissed={bannerDismissed}
                onDismiss={() => setBannerDismissed(true)}
                filename={datasetInfo?.name || ''}
                totalTables={datasetInfo?.totalTables || 1}
                rows={datasetInfo?.rows || 0}
                cols={datasetInfo?.cols || 0}
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
                filename={datasetInfo?.name || ''}
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

                  {/* Right Column: Educational Lesson Panel */}
                  <div className="w-full lg:w-[400px] xl:w-[440px] shrink-0">
                    <HowQueryWorksPanel
                      loading={loadingQuery}
                      error={queryError}
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

              {/* 4. Dataset Briefing & Starter Queries or Error State */}
              {briefingError ? (
                <div className="p-3.5 rounded-xl bg-[#0d1322] border border-[#1a243a] text-xs font-mono text-slate-400 flex items-center justify-between">
                  <span>Couldn't load the dataset briefing</span>
                  <button
                    onClick={() => reloadBriefing(true)}
                    className="text-cyan-400 hover:text-cyan-300 hover:underline text-[11px]"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div id="dataset-briefing-section">
                    <DatasetBriefingCard
                      loading={loadingBriefing}
                      briefing={briefing}
                      columns={profile?.columns || []}
                    />
                  </div>

                  <StarterQueriesSection
                    loading={loadingBriefing}
                    starterQueries={briefing?.starter_queries || []}
                    onSelectQuery={handleSelectStarterQuery}
                  />
                </>
              )}
            </>
          )}
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

      {/* Tab 3: Practice Lab */}
      {activeTab === 'practice' && <PracticeLab />}

      {/* Upload Data Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => {
          if (!isUploading) setIsUploadOpen(false);
        }}
        title="Upload Dataset"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-400">
            Select a database or tabular file to load into NovaQuery. Supported formats: .db, .sqlite, .sqlite3, .sql, .csv, .xlsx, .json, .parquet.
          </p>

          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs font-mono leading-relaxed">
              {uploadError}
            </div>
          )}

          <label className={`border-2 border-dashed border-[#1a243a] hover:border-cyan-500/50 rounded-xl p-8 flex flex-col items-center justify-center gap-2 transition bg-[#05080f]/50 ${isUploading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}>
            {isUploading ? (
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-cyan-400" />
            )}
            <span className="text-xs font-semibold text-slate-200">
              {isUploading ? 'Uploading and processing file...' : 'Click to browse or drop file here'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Max file size 50MB
            </span>
            <input
              type="file"
              accept=".db,.sqlite,.sqlite3,.sql,.csv,.xlsx,.xls,.json,.parquet"
              disabled={isUploading}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleUploadFile(file);
                  e.target.value = '';
                }
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