import { useState, useEffect, useCallback } from 'react';
import { fetchProfile, executeQuery, uploadDatabase } from '../api';

/**
 * Primary state management hook for NovaQuery.
 * Manages dataset state, tabs, active query, results, response timing, and history.
 */
export function useNovaQuery() {
  const [activeTab, setActiveTab] = useState('workspace');
  const [activeFile, setActiveFile] = useState(null);
  const [dbPath, setDbPath] = useState(null);

  // Profile data from backend
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Query editor state
  const [queryText, setQueryText] = useState('');
  const [queryMode, setQueryMode] = useState('english'); // 'english' | 'sql'
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [queryError, setQueryError] = useState(null);

  // Query output state & performance timing
  const [queryResult, setQueryResult] = useState(null);
  const [responseTime, setResponseTime] = useState(null);

  // Query history: starts empty, in-memory only
  const [history, setHistory] = useState([]);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  // UI state
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Load real profile from backend
  const reloadProfile = useCallback(async (targetPath = null) => {
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const data = await fetchProfile(targetPath);
      if (data && data.success) {
        setProfile(data);
        setProfileError(null);
        return data;
      } else {
        setProfile(null);
        setProfileError(data?.detail || data?.error || 'No dataset active.');
        return null;
      }
    } catch (err) {
      setProfile(null);
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.message ||
        'Failed to load dataset profile.';
      setProfileError(errorMsg);
      return null;
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  // Fetch initial profile on mount
  useEffect(() => {
    reloadProfile();
  }, [reloadProfile]);

  // Derived dataset info
  // File pill & banner naming priority:
  // profile.source_filename -> activeFile?.name -> profile.table_name. Do NOT append ".csv".
  const datasetName =
    profile?.source_filename ||
    activeFile?.name ||
    profile?.table_name ||
    '';

  const totalTables =
    profile?.total_tables ||
    (Array.isArray(profile?.tables) ? profile.tables.length : (profile?.table_name ? 1 : 0));

  const datasetInfo = profile ? {
    name: datasetName,
    totalTables: totalTables,
    rows: profile?.total_rows ?? 0,
    cols: profile?.total_columns ?? (profile?.columns?.length || 0),
  } : null;

  /**
   * Uploads database file and resets dataset-dependent state
   */
  const handleUploadFile = useCallback(async (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await uploadDatabase(file);
      if (res && res.success) {
        // 1. Store db_path and original_filename
        setDbPath(res.db_path);
        setActiveFile({ name: res.original_filename });

        // 2. RESET dataset-dependent state
        setQueryResult(null);
        setQueryError(null);
        setQueryText('');
        setResponseTime(null);
        setHistory([]);
        setActiveHistoryId(null);
        setBannerDismissed(false);

        // 3. Re-fetch profile with the new db_path
        await reloadProfile(res.db_path);

        setIsUploadOpen(false);
        setUploadError(null);
        return res;
      } else {
        throw new Error(res?.detail || 'Upload failed.');
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.message ||
        'File upload failed.';
      setUploadError(errorMsg);
    } finally {
      setIsUploading(false);
    }
  }, [reloadProfile]);

  /**
   * Real Query Execution wired to executeQuery in src/api.js
   * Measures client response time with performance.now()
   */
  const runQuery = useCallback(async (customQuery = null) => {
    const questionToRun = (customQuery !== null ? customQuery : queryText).trim();
    if (!questionToRun) return;
    const recent = history
    .filter((h) => h.status === 'executed' && h.sql)
    .slice(0, 2)
    .reverse()
    .map((h) => ({ question: h.question, sql: h.sql })); 

    setLoadingQuery(true);
    setQueryError(null);

    const startTime = performance.now();

    try {
      const res = await executeQuery(questionToRun, dbPath, 'SQLite',recent); 
      const endTime = performance.now();
      const elapsed = endTime - startTime;
      setResponseTime(elapsed);

      // Handle backend response error property
      if (res && res.success === false) {
        throw new Error(res.error || 'Query execution returned unsuccessful.');
      } 

      // Backward compatible extraction of data rows:
      const dataRows = res?.data || res?.results || (Array.isArray(res) ? res : []);

      // Only use backend lesson; null when unavailable
      const lessonData = res?.lesson || null;

      const formattedResult = {
        data: dataRows,
        generated_sql: res?.generated_sql || '',
         postgres_sql: res?.postgres_sql || '',
        explanation: res?.explanation || '',
        purpose: res?.purpose || null,
        suggested_queries: Array.isArray(res?.suggested_queries) ? res.suggested_queries : [],
        attempts_needed: res?.attempts_needed || 1,
        row_count: res?.row_count ?? dataRows.length,
        truncated: Boolean(res?.truncated),
        lesson: lessonData,
      };  

      setQueryResult(formattedResult);

      // Append to real history list
      const newHistoryItem = {
        id: `hist-${Date.now()}`,
        question: questionToRun,
        sql: res?.generated_sql || '',
        postgresSql: res?.postgres_sql || '', 
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
  }, [queryText, dbPath , history]); 

  const handleSelectHistory = (item) => {
    setActiveHistoryId(item.id);
    setQueryText(item.question);
    if (item.sql) {
      // Re-populate query result view if available
      setQueryResult((prev) => prev ? { ...prev, generated_sql: item.sql,postgres_sql: item.postgresSql || ''  } : null);
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
    profileError,
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
    isUploading,
    uploadError,
    handleUploadFile,
  };
}

