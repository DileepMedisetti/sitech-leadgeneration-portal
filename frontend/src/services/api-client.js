import axios from 'axios';

// Resolve base URL from Vite environment variable; default to relative path in development for proxy
const rawBase = import.meta.env.VITE_API_BASE_URL || '';
export const API_BASE = rawBase.replace(/\/+$/, '');

// Centralized Axios client instance
export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Attach authentication token if present in browser storage
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token =
        localStorage.getItem('sitech_token') ||
        sessionStorage.getItem('sitech_token');
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Storage access blocked or unavailable
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Standardize error formats (FastAPI 422 arrays, string details, network timeouts)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    let message = 'An unexpected network error occurred.';

    if (error.response) {
      const { status, data } = error.response;
      if (data && data.detail) {
        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (Array.isArray(data.detail)) {
          // FastAPI 422 Unprocessable Content schema validation errors
          message = data.detail
            .map((item) => {
              const field = item.loc ? item.loc.slice(1).join('.') : '';
              return field ? `${field}: ${item.msg}` : item.msg;
            })
            .join(' | ');
        } else {
          message = JSON.stringify(data.detail);
        }
      } else if (data && data.message) {
        message = data.message;
      } else {
        message = `Request failed (${status}: ${error.response.statusText || 'Error'})`;
      }
      error.message = message;
      error.status = status;
    } else if (error.request) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        message = 'Request timed out after 30 seconds. Please verify your backend server.';
      } else {
        message = `Unable to reach the backend service at ${API_BASE || 'localhost:8000'}. Ensure the FastAPI server is running.`;
      }
      error.message = message;
    }

    console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`, message);
    return Promise.reject(error);
  }
);

// Helper for triggering browser file downloads from Blob data
export function triggerBlobDownload(blobData, defaultFilename, response, forceFilename = false) {
  let filename = defaultFilename;
  if (!forceFilename) {
    const disposition = response?.headers?.['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename=["']?([^"';]+)["']?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }
  }

  const blob = blobData instanceof Blob ? blobData : new Blob([blobData], {
    type: response?.headers?.['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
  return filename;
}

// ==============================================================================
// Dashboard API
// ==============================================================================
export const dashboardApi = {
  getStats: (options = {}) =>
    apiClient.get('/api/dashboard/stats', options).then((res) => res.data),
};

// ==============================================================================
// Search Jobs API
// ==============================================================================
export const searchJobsApi = {
  list: (params = {}, options = {}) =>
    apiClient
      .get('/api/search-jobs', {
        params: {
          page: params.page,
          page_size: params.page_size,
          status: params.status || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  create: (data, options = {}) =>
    apiClient.post('/api/search-jobs', data, options).then((res) => res.data),

  get: (id, options = {}) =>
    apiClient.get(`/api/search-jobs/${id}`, options).then((res) => res.data),

  start: (id, options = {}) =>
    apiClient.post(`/api/search-jobs/${id}/start`, null, options).then((res) => res.data),

  run: (id, options = {}) =>
    apiClient.post(`/api/search-jobs/${id}/run`, null, options).then((res) => res.data),

  stop: (id, options = {}) =>
    apiClient.post(`/api/search-jobs/${id}/stop`, null, options).then((res) => res.data),

  resume: (id, options = {}) =>
    apiClient.post(`/api/search-jobs/${id}/resume`, null, options).then((res) => res.data),

  getResults: (id, params = {}, options = {}) =>
    apiClient
      .get(`/api/search-jobs/${id}/results`, {
        params: {
          page: params.page,
          page_size: params.page_size,
          status: params.status || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  getLeads: (id, params = {}, options = {}) =>
    apiClient
      .get(`/api/search-jobs/${id}/leads`, {
        params: {
          page: params.page,
          page_size: params.page_size,
          status: params.status || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  collect: (id, queryOverride = null, options = {}) =>
    apiClient
      .post(`/api/search-jobs/${id}/collect`, null, {
        params: queryOverride ? { query_override: queryOverride } : {},
        ...options,
      })
      .then((res) => res.data),

  extractLeads: (id, limit = 10, options = {}) =>
    apiClient
      .post(`/api/search-jobs/${id}/extract-leads`, null, {
        params: { limit },
        ...options,
      })
      .then((res) => res.data),

  retryFailed: (id, limit = 10, options = {}) =>
    apiClient
      .post(`/api/search-jobs/${id}/retry-failed`, null, {
        params: { limit },
        ...options,
      })
      .then((res) => res.data),

  // Axios blob download for Excel (.xlsx) extraction results export
  downloadResultsXlsx: async (jobId, customFilename = null, options = {}) => {
    const res = await apiClient.get(`/api/search-jobs/${jobId}/results/export-xlsx`, {
      responseType: 'blob',
      ...options,
    });
    const defaultName = customFilename || `job_${String(jobId).padStart(3, '0')}_all_results.xlsx`;
    return triggerBlobDownload(
      res.data,
      defaultName,
      res,
      Boolean(customFilename)
    );
  },
};


// ==============================================================================
// Leads API
// ==============================================================================
export const leadsApi = {
  list: (params = {}, options = {}) =>
    apiClient
      .get('/api/leads', {
        params: {
          page: params.page,
          page_size: params.page_size,
          search: params.search || undefined,
          status: params.status || undefined,
          country: params.country || undefined,
          university: params.university || undefined,
          profession: params.profession || undefined,
          job_id: params.job_id || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  get: (id, options = {}) =>
    apiClient.get(`/api/leads/${id}`, options).then((res) => res.data),

  update: (id, data, options = {}) =>
    apiClient.patch(`/api/leads/${id}`, data, options).then((res) => res.data),

  audit: (options = {}) =>
    apiClient.post('/api/leads/audit', null, options).then((res) => res.data),

  // Axios blob download for Excel (.xlsx) export
  downloadXlsx: async (status = 'qualified', jobId = null, customFilename = null, options = {}) => {
    const res = await apiClient.get('/api/leads/export-xlsx', {
      params: {
        status: status || undefined,
        job_id: jobId || undefined,
      },
      responseType: 'blob',
      ...options,
    });
    const defaultName = customFilename || `sitech_leads_${status || 'all'}.xlsx`;
    return triggerBlobDownload(
      res.data,
      defaultName,
      res,
      Boolean(customFilename)
    );
  },

  // Axios blob download for CSV export
  downloadCsv: async (status = 'qualified', jobId = null, options = {}) => {
    const res = await apiClient.get('/api/leads/export', {
      params: {
        status: status || undefined,
        job_id: jobId || undefined,
      },
      responseType: 'blob',
      ...options,
    });
    return triggerBlobDownload(
      res.data,
      `sitech_leads_${status || 'all'}.csv`,
      res
    );
  },

  // Preserved for fallback URL reference
  exportUrl: (status = 'qualified', jobId = null) => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (jobId) qs.set('job_id', jobId);
    return `${API_BASE}/api/leads/export?${qs.toString()}`;
  },

  exportXlsxUrl: (status = 'qualified', jobId = null) => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (jobId) qs.set('job_id', jobId);
    return `${API_BASE}/api/leads/export-xlsx?${qs.toString()}`;
  },
};

// ==============================================================================
// Review Queue API
// ==============================================================================
export const reviewQueueApi = {
  list: (params = {}, options = {}) =>
    apiClient
      .get('/api/review-queue', {
        params: {
          page: params.page,
          page_size: params.page_size,
          search: params.search || undefined,
          job_id: params.job_id || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  approve: (id, reason = null, options = {}) =>
    apiClient
      .post(`/api/review-queue/${id}/approve`, { reason }, options)
      .then((res) => res.data),

  reject: (id, reason = null, options = {}) =>
    apiClient
      .post(`/api/review-queue/${id}/reject`, { reason }, options)
      .then((res) => res.data),
};

// ==============================================================================
// Analytics API
// ==============================================================================
export const analyticsApi = {
  get: (options = {}) =>
    apiClient.get('/api/analytics', options).then((res) => res.data),
};

// ==============================================================================
// Settings API
// ==============================================================================
export const settingsApi = {
  get: (options = {}) =>
    apiClient.get('/api/settings', options).then((res) => res.data),
};
