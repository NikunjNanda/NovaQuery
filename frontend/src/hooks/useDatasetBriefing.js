import { useState, useEffect, useCallback } from 'react';
import { fetchBriefing } from '../api';

/**
 * Hook to fetch and manage dataset briefing metadata, insights,
 * starter curriculum queries, and "try asking" prompts.
 * 
 * @param {string|null} dbPath - Database path parameter for backend
 * @param {boolean} profileReady - Whether an active dataset profile exists
 */
export function useDatasetBriefing(dbPath, profileReady) {
  const [briefing, setBriefing] = useState(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState(null);

  const reloadBriefing = useCallback(async (refresh = false) => {
    if (!profileReady && !dbPath) {
      setBriefing(null);
      setLoadingBriefing(false);
      setBriefingError(null);
      return;
    }

    setLoadingBriefing(true);
    setBriefingError(null);

    try {
      const data = await fetchBriefing(dbPath, refresh);
      if (data && data.success !== false) {
        setBriefing(data);
        setBriefingError(null);
      } else {
        setBriefing(null);
        setBriefingError(data?.error || data?.detail || "Couldn't load the dataset briefing");
      }
    } catch (err) {
      setBriefing(null);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.message ||
        "Couldn't load the dataset briefing";
      setBriefingError(msg);
    } finally {
      setLoadingBriefing(false);
    }
  }, [dbPath, profileReady]);

  useEffect(() => {
    if (profileReady) {
      reloadBriefing(false);
    } else {
      setBriefing(null);
      setLoadingBriefing(false);
      setBriefingError(null);
    }
  }, [profileReady, dbPath, reloadBriefing]);

  return {
    briefing,
    loadingBriefing,
    briefingError,
    reloadBriefing,
  };
}
