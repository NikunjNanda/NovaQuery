import axios from 'axios';

// Change this line to include /api
const API_BASE = 'http://localhost:8000/api';

export const executeQuery = async (question, dbPath, dialect = 'SQLite') => {
  const response = await axios.post(`${API_BASE}/query`, {
    question: question,
    db_path: dbPath,
    dialect: dialect
  });
  return response.data;
};

export const uploadDatabase = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(`${API_BASE}/upload-db`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const connectLiveUri = async (connectionString) => {
  const response = await axios.post(`${API_BASE}/connect-uri`, {
    connection_string: connectionString
  });
  return response.data;
};

export const fetchProfile = async (dbPath = null) => {
  const response = await axios.get(`${API_BASE}/profile`, {
    params: dbPath ? { db_path: dbPath } : {}
  });
  return response.data;
};

export const fetchBriefing = async (dbPath = null, refresh = false) => {
  const params = {};
  if (dbPath) params.db_path = dbPath;
  if (refresh) params.refresh = refresh;
  const response = await axios.get(`${API_BASE}/briefing`, { params });
  return response.data;
};

