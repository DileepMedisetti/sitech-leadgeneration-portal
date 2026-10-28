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

// ==============================================================================
// Audience API (Contacts & Lists)
// ==============================================================================
export const audienceApi = {
  getContacts: (params = {}, options = {}) =>
    apiClient
      .get('/api/audience/contacts', {
        params: {
          page: params.page,
          page_size: params.page_size,
          search: params.search || undefined,
          country: params.country || undefined,
          university: params.university || undefined,
          department: params.department || undefined,
          profession: params.profession || undefined,
          job_id: params.job_id || undefined,
          sort_by: params.sort_by || undefined,
          sort_order: params.sort_order || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  getContactFilters: (options = {}) =>
    apiClient.get('/api/audience/contacts/filters', options).then((res) => res.data),

  getLists: (params = {}, options = {}) =>
    apiClient
      .get('/api/audience/lists', {
        params: {
          page: params.page,
          page_size: params.page_size,
          search: params.search || undefined,
          filter: params.filter || undefined,
          updated_within: params.updated_within || undefined,
          sort_by: params.sort_by || undefined,
          sort_order: params.sort_order || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  createList: (data, options = {}) =>
    apiClient.post('/api/audience/lists', data, options).then((res) => res.data),

  getList: (id, options = {}) =>
    apiClient.get(`/api/audience/lists/${id}`, options).then((res) => res.data),

  updateList: (id, data, options = {}) =>
    apiClient.patch(`/api/audience/lists/${id}`, data, options).then((res) => res.data),

  deleteList: (id, options = {}) =>
    apiClient.delete(`/api/audience/lists/${id}`, options).then((res) => res.data),

  getListContacts: (id, params = {}, options = {}) =>
    apiClient
      .get(`/api/audience/lists/${id}/contacts`, {
        params: {
          page: params.page,
          page_size: params.page_size,
          search: params.search || undefined,
          sort_by: params.sort_by || undefined,
          sort_order: params.sort_order || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  addContactsToList: (id, leadIds, options = {}) =>
    apiClient
      .post(`/api/audience/lists/${id}/contacts`, { lead_ids: leadIds }, options)
      .then((res) => res.data),

  removeContactsFromList: (id, leadIds, options = {}) =>
    apiClient
      .delete(`/api/audience/lists/${id}/contacts`, {
        data: { lead_ids: leadIds },
        ...options,
      })
      .then((res) => res.data),

  validateImportFile: (formData, options = {}) =>
    apiClient
      .post('/api/audience/import-contacts/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        ...options,
      })
      .then((res) => res.data),
};

// ==============================================================================
// Campaigns API
// ==============================================================================
export const campaignsApi = {
  list: (params = {}, options = {}) =>
    apiClient
      .get('/api/campaigns', {
        params: {
          page: params.page,
          page_size: params.page_size,
          status: params.status || undefined,
          search: params.search || undefined,
          sort_by: params.sort_by || undefined,
          sort_order: params.sort_order || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  create: (data, options = {}) =>
    apiClient.post('/api/campaigns', data, options).then((res) => res.data),

  get: (id, options = {}) =>
    apiClient.get(`/api/campaigns/${id}`, options).then((res) => res.data),

  update: (id, data, options = {}) =>
    apiClient.patch(`/api/campaigns/${id}`, data, options).then((res) => res.data),

  delete: (id, options = {}) =>
    apiClient.delete(`/api/campaigns/${id}`, options).then((res) => res.data),

  getAudience: (id, options = {}) =>
    apiClient.get(`/api/campaigns/${id}/audience`, options).then((res) => res.data),

  selectAudience: (id, contactListIds, options = {}) =>
    apiClient
      .post(`/api/campaigns/${id}/audience`, { contact_list_ids: contactListIds }, options)
      .then((res) => res.data),

  getPreflight: (id, options = {}) =>
    apiClient.get(`/api/campaigns/${id}/preflight`, options).then((res) => res.data),

  launch: (id, payload, options = {}) =>
    apiClient.post(`/api/campaigns/${id}/launch`, payload, options).then((res) => res.data),

  pause: (id, options = {}) =>
    apiClient.post(`/api/campaigns/${id}/pause`, null, options).then((res) => res.data),

  resume: (id, options = {}) =>
    apiClient.post(`/api/campaigns/${id}/resume`, null, options).then((res) => res.data),

  cancel: (id, options = {}) =>
    apiClient.post(`/api/campaigns/${id}/cancel`, null, options).then((res) => res.data),

  getSenderIdentities: (options = {}) =>
    apiClient.get('/api/campaigns/sender-identities', options).then((res) => res.data),

  getReport: (id, options = {}) =>
    apiClient.get(`/api/campaigns/${id}/report`, options).then((res) => res.data),

  getRecipientsReport: (id, params = {}, options = {}) =>
    apiClient
      .get(`/api/campaigns/${id}/report/recipients`, {
        params: {
          page: params.page,
          page_size: params.page_size,
          search: params.search || undefined,
          status: params.status || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  exportRecipientsCsvUrl: (id) => `${apiClient.defaults.baseURL || ''}/api/campaigns/${id}/report/export`,

  getReplies: (id, options = {}) =>
    apiClient.get(`/api/campaigns/${id}/replies`, options).then((res) => res.data),

  submitInboundReply: (campaignId, payload, options = {}) =>
    apiClient
      .post(campaignId ? `/api/campaigns/${campaignId}/inbound-reply` : '/api/campaigns/inbound-reply', payload, options)
      .then((res) => res.data),
};


// ==============================================================================
// Deliverability Intelligence API
// ==============================================================================
export const deliverabilityApi = {
  analyzeContent: (data, options = {}) =>
    apiClient.post('/api/deliverability/analyze-content', data, options).then((res) => res.data),

  analyzeCampaign: (campaignId, options = {}) =>
    apiClient.post(`/api/deliverability/campaigns/${campaignId}/analyze`, null, options).then((res) => res.data),

  getReport: (campaignId, options = {}) =>
    apiClient.get(`/api/deliverability/campaigns/${campaignId}/report`, options).then((res) => res.data),

  getHistory: (campaignId, limit = 10, options = {}) =>
    apiClient
      .get(`/api/deliverability/campaigns/${campaignId}/history`, {
        params: { limit },
        ...options,
      })
      .then((res) => res.data),

  compareReports: (reportAId, reportBId, options = {}) =>
    apiClient
      .get('/api/deliverability/reports/compare', {
        params: { report_a: reportAId, report_b: reportBId },
        ...options,
      })
      .then((res) => res.data),

  runPlacementTest: (campaignId, payload = {}, options = {}) =>
    apiClient
      .post(`/api/deliverability/campaigns/${campaignId}/placement-test`, payload, options)
      .then((res) => res.data),

  listPlacementTests: (campaignId, params = {}, options = {}) =>
    apiClient
      .get(`/api/deliverability/campaigns/${campaignId}/placement-tests`, {
        params: {
          page: params.page,
          page_size: params.page_size,
        },
        ...options,
      })
      .then((res) => res.data),

  getPlacementTest: (testId, options = {}) =>
    apiClient.get(`/api/deliverability/placement-tests/${testId}`, options).then((res) => res.data),

  getMLPrediction: (campaignId, options = {}) =>
    apiClient.get(`/api/deliverability/campaigns/${campaignId}/ml-prediction`, options).then((res) => res.data),

  listMLModels: (options = {}) =>
    apiClient.get('/api/deliverability/ml/models', options).then((res) => res.data),

  trainMLModel: (modelVersion = 'v1.0.0', options = {}) =>
    apiClient
      .post('/api/deliverability/ml/train', null, {
        params: { model_version: modelVersion },
        ...options,
      })
      .then((res) => res.data),
};

// ==============================================================================
// Authentication API
// ==============================================================================
export const authApi = {
  requestOtp: (email, options = {}) =>
    apiClient.post('/api/auth/request-otp', { email }, options).then((res) => res.data),

  verifyOtp: (email, otpCode, options = {}) =>
    apiClient.post('/api/auth/verify-otp', { email, otp_code: otpCode }, options).then((res) => res.data),

  getMe: (options = {}) =>
    apiClient.get('/api/auth/me', options).then((res) => res.data),

  logout: (options = {}) =>
    apiClient.post('/api/auth/logout', null, options).then((res) => res.data),
};

// ==============================================================================
// Email Accounts API
// ==============================================================================
export const emailAccountsApi = {
  list: (options = {}) =>
    apiClient.get('/api/email-accounts', options).then((res) => res.data),

  listDeleted: (options = {}) =>
    apiClient.get('/api/email-accounts/deleted', options).then((res) => res.data),

  requestConnectCode: (data, options = {}) =>
    apiClient.post('/api/email-accounts/connect/request-code', data, options).then((res) => res.data),

  verifyConnectCode: (data, options = {}) =>
    apiClient.post('/api/email-accounts/connect/verify-code', data, options).then((res) => res.data),

  create: (data, options = {}) =>
    apiClient.post('/api/email-accounts', data, options).then((res) => res.data),

  get: (id, options = {}) =>
    apiClient.get(`/api/email-accounts/${id}`, options).then((res) => res.data),

  update: (id, data, options = {}) =>
    apiClient.patch(`/api/email-accounts/${id}`, data, options).then((res) => res.data),

  activate: (id, options = {}) =>
    apiClient.post(`/api/email-accounts/${id}/activate`, null, options).then((res) => res.data),

  deactivate: (id, options = {}) =>
    apiClient.post(`/api/email-accounts/${id}/deactivate`, null, options).then((res) => res.data),

  delete: (id, options = {}) =>
    apiClient.delete(`/api/email-accounts/${id}`, options).then((res) => res.data),

  restore: (id, options = {}) =>
    apiClient.post(`/api/email-accounts/${id}/restore`, null, options).then((res) => res.data),

  permanentlyDelete: (id, options = {}) =>
    apiClient.delete(`/api/email-accounts/${id}/permanent`, options).then((res) => res.data),

  verify: (id, options = {}) =>
    apiClient.post(`/api/email-accounts/${id}/verify`, null, options).then((res) => res.data),
};


// ==============================================================================
// Email Templates API
// ==============================================================================
export const templatesApi = {
  list: (params = {}, options = {}) =>
    apiClient.get('/api/templates', { params, ...options }).then((res) => res.data),

  get: (id, options = {}) =>
    apiClient.get(`/api/templates/${id}`, options).then((res) => res.data),

  getRawHtml: (id, options = {}) =>
    apiClient.get(`/api/templates/${id}/raw`, { responseType: 'text', ...options }).then((res) => res.data),

  create: (data, options = {}) =>
    apiClient.post('/api/templates', data, options).then((res) => res.data),

  importFile: (formData, options = {}) =>
    apiClient.post('/api/templates/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...options,
    }).then((res) => res.data),

  update: (id, data, options = {}) =>
    apiClient.patch(`/api/templates/${id}`, data, options).then((res) => res.data),

  delete: (id, options = {}) =>
    apiClient.delete(`/api/templates/${id}`, options).then((res) => res.data),
};



// ==============================================================================
// Campaign Tracking API
// ==============================================================================
export const campaignTrackingApi = {
  getCompletedCampaigns: (params = {}, options = {}) =>
    apiClient
      .get('/api/campaign-tracking/campaigns', {
        params: {
          page: params.page || 1,
          page_size: params.page_size || 10,
          search: params.search || undefined,
          status: params.status || undefined,
          start_date: params.start_date || undefined,
          end_date: params.end_date || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  getCampaignSummary: (campaignId, options = {}) =>
    apiClient
      .get(`/api/campaign-tracking/campaigns/${campaignId}/summary`, options)
      .then((res) => res.data),

  getOpenedRecipients: (campaignId, params = {}, options = {}) =>
    apiClient
      .get(`/api/campaign-tracking/campaigns/${campaignId}/opened-recipients`, {
        params: {
          page: params.page || 1,
          page_size: params.page_size || 20,
          search: params.search || undefined,
          country: params.country || undefined,
          profession: params.profession || undefined,
          university: params.university || undefined,
          sort_by: params.sort_by || undefined,
          sort_order: params.sort_order || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  exportOpenedRecipientsUrl: (campaignId, params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.country && params.country !== 'all') query.append('country', params.country);
    if (params.profession && params.profession !== 'all') query.append('profession', params.profession);
    if (params.university && params.university !== 'all') query.append('university', params.university);
    const qs = query.toString();
    const base = apiClient.defaults.baseURL || '';
    return `${base}/api/campaign-tracking/campaigns/${campaignId}/opened-recipients/export${qs ? `?${qs}` : ''}`;
  },

  getBouncedMails: (campaignId, params = {}, options = {}) =>
    apiClient
      .get(`/api/campaign-tracking/campaigns/${campaignId}/bounces`, {
        params: {
          page: params.page || 1,
          page_size: params.page_size || 20,
          search: params.search || undefined,
          bounce_type: params.bounce_type || undefined,
          country: params.country || undefined,
          profession: params.profession || undefined,
          university: params.university || undefined,
          start_date: params.start_date || undefined,
          end_date: params.end_date || undefined,
        },
        ...options,
      })
      .then((res) => res.data),

  exportBouncedMailsUrl: (campaignId, params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.bounce_type && params.bounce_type !== 'all') query.append('bounce_type', params.bounce_type);
    if (params.country && params.country !== 'all') query.append('country', params.country);
    if (params.profession && params.profession !== 'all') query.append('profession', params.profession);
    if (params.university && params.university !== 'all') query.append('university', params.university);
    const qs = query.toString();
    const base = apiClient.defaults.baseURL || '';
    return `${base}/api/campaign-tracking/campaigns/${campaignId}/bounces/export${qs ? `?${qs}` : ''}`;
  },

  deleteBounceRecord: (campaignId, recordId, options = {}) =>
    apiClient
      .delete(`/api/campaign-tracking/campaigns/${campaignId}/bounces/${recordId}`, options)
      .then((res) => res.data),

  deleteAllBounces: (campaignId, params = {}, options = {}) =>
    apiClient
      .delete(`/api/campaign-tracking/campaigns/${campaignId}/bounces`, {
        params: {
          bounce_type: params.bounce_type || undefined,
        },
        ...options,
      })
      .then((res) => res.data),
};
