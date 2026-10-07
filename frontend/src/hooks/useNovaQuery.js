import { useState, useEffect, useCallback } from 'react';
import { fetchProfile, executeQuery } from '../api';
import { mockDefaultProfile, mockHistory, getMockLessonForQuestion } from '../mockData';

/**
 * Primary state management hook for NovaQuery.
 * Manages dataset state, tabs, active query, results, response timing, and history.
 */
export function useNovaQuery() {
  const [activeTab, setActiveTab] = useState('workspace');
  const [activeFile, setActiveFile] = useState(null);
  const [dbPath, setDbPath] = useState(null);

  // Profile data (defaults to clean mock shape, refreshed if backend is live)
  const [profile, setProfile] = useState(mockDefaultProfile);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Query editor state
  const [queryText, setQueryText] = useState('Show average petal length for each species');
  const [queryMode, setQueryMode] = useState('english'); // 'english' | 'sql'
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [queryError, setQueryError] = useState(null);

  // Query output state & performance timing
  const [queryResult, setQueryResult] = useState(null);
  const [responseTime, setResponseTime] = useState(null);

  // Query history
  const [history, setHistory] = useState(mockHistory);
  const [activeHistoryId, setActiveHistoryId] = useState(mockHistory[0]?.id || null);

  // UI state
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Load real profile from backend if available
  const reloadProfile = useCallback(async (targetPath = null) => {
    setLoadingProfile(true);
    try {
      const data = await fetchProfile(targetPath);
      if (data && data.success) {
        setProfile(data);
      }
    } catch {
      // Backend not running or profile not available yet: keep fallback profile
      // TODO(backend): Handle connection retry or live database reconnection
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  // Fetch initial profile on mount
  useEffect(() => {
    reloadProfile();
  }, [reloadProfile]);

  // Derived dataset info
  const datasetInfo = {
    name: activeFile?.name || (profile?.table_name ? `${profile.table_name}.csv` : 'iris.csv'),
    rows: profile?.total_rows ?? 150,
    cols: profile?.total_columns ?? (profile?.columns?.length || 6),
  };

  /**
   * Real Query Execution wired to executeQuery in src/api.js
   * Measures client response time with performance.now()
   */
  const runQuery = useCallback(async (customQuery = null) => {
    const questionToRun = (customQuery !== null ? customQuery : queryText).trim();
    if (!questionToRun) return;

    setLoadingQuery(true);
    setQueryError(null);

    const startTime = performance.now();

    try {
      const res = await executeQuery(questionToRun, dbPath, 'SQLite');
      const endTime = performance.now();
      const elapsed = endTime - startTime;
      setResponseTime(elapsed);

      // Handle backend response error property
      if (res && res.success === false) {
        throw new Error(res.error || 'Query execution returned unsuccessful.');
      }

      // Backward compatible extraction of data rows:
      // res.data || res.results || Array.isArray(res)
      const dataRows = res?.data || res?.results || (Array.isArray(res) ? res : []);

      // // TODO(backend): lesson object returned by /api/query
      const lessonData = res?.lesson || getMockLessonForQuestion(questionToRun);

      const formattedResult = {
        data: dataRows,
        generated_sql: res?.generated_sql || '',
        explanation: res?.explanation || '',
        // // TODO(backend): add `purpose` to the query response
        purpose: res?.purpose || null,
        suggested_queries: Array.isArray(res?.suggested_queries) ? res.suggested_queries : [],
        attempts_needed: res?.attempts_needed || 1,
        lesson: lessonData,
      };

      setQueryResult(formattedResult);

      // Append to real history list
      const newHistoryItem = {
        id: `hist-${Date.now()}`,
        question: questionToRun,
        sql: res?.generated_sql || '',
        status: 'executed',
        executedAt: new Date().toISOString(),
        executionTimeMs: elapsed,
        rowCount: dataRows.length,
      };

      setHistory((prev) => [newHistoryItem, ...prev]);
      setActiveHistoryId(newHistoryItem.id);

    } catch (err) {
      const endTime = performance.now();
      const elapsed = endTime - startTime;
      setResponseTime(elapsed);

      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.message ||
        'Query execution failed.';

      setQueryError(errorMsg);

      // Record failed query in history
      const failedHistoryItem = {
        id: `hist-${Date.now()}`,
        question: questionToRun,
        sql: '',
        status: 'error',
        executedAt: new Date().toISOString(),
        executionTimeMs: elapsed,
        rowCount: 0,
      };

      setHistory((prev) => [failedHistoryItem, ...prev]);
      setActiveHistoryId(failedHistoryItem.id);

    } finally {
      setLoadingQuery(false);
    }
  }, [queryText, dbPath]);

  const handleSelectHistory = (item) => {
    setActiveHistoryId(item.id);
    setQueryText(item.question);
    if (item.sql) {
      // Re-populate query result view if available
      setQueryResult((prev) => prev ? { ...prev, generated_sql: item.sql } : null);
    }
  };

  return {
    activeTab,
    setActiveTab,
    activeFile,
    setActiveFile,
    dbPath,
    setDbPath,
    profile,
    loadingProfile,
    reloadProfile,
    datasetInfo,
    queryText,
    setQueryText,
    queryMode,
    setQueryMode,
    loadingQuery,
    queryError,
    setQueryError,
    queryResult,
    setQueryResult,
    responseTime,
    runQuery,
    history,
    setHistory,
    activeHistoryId,
    setActiveHistoryId,
    handleSelectHistory,
    bannerDismissed,
    setBannerDismissed,
    isUploadOpen,
    setIsUploadOpen,
    isHelpOpen,
    setIsHelpOpen,
  };
}
