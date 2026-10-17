
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(url, config);

    if (!res.ok) {
      let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) {
          errorDetail = typeof errorJson.detail === 'string'
            ? errorJson.detail
            : JSON.stringify(errorJson.detail);
        }
      } catch {
        // Fallback to status text
      }
      throw new Error(errorDetail);
    }

    // For file downloads / text
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/csv')) {
      return await res.text();
    }

    return await res.json();
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

export const dashboardApi = {
  getStats: () => request('/api/dashboard/stats'),
};

export const searchJobsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', params.page);
    if (params.page_size) qs.set('page_size', params.page_size);
    if (params.status) qs.set('status', params.status);
    return request(`/api/search-jobs?${qs.toString()}`);
  },
  create: (data) =>
    request('/api/search-jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  get: (id) => request(`/api/search-jobs/${id}`),
  start: (id) =>
    request(`/api/search-jobs/${id}/start`, {
      method: 'POST',
    }),
  run: (id) =>
    request(`/api/search-jobs/${id}/run`, {
      method: 'POST',
    }),
  stop: (id) =>
    request(`/api/search-jobs/${id}/stop`, {
      method: 'POST',
    }),
  resume: (id) =>
    request(`/api/search-jobs/${id}/resume`, {
      method: 'POST',
    }),
  getResults: (id, params = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', params.page);
    if (params.page_size) qs.set('page_size', params.page_size);
    if (params.status) qs.set('status', params.status);
    return request(`/api/search-jobs/${id}/results?${qs.toString()}`);
  },
  getLeads: (id, params = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', params.page);
    if (params.page_size) qs.set('page_size', params.page_size);
    if (params.status) qs.set('status', params.status);
    return request(`/api/search-jobs/${id}/leads?${qs.toString()}`);
  },
  collect: (id, queryOverride = null) => {
    const qs = queryOverride ? `?query_override=${encodeURIComponent(queryOverride)}` : '';
    return request(`/api/search-jobs/${id}/collect${qs}`, {
      method: 'POST',
    });
  },
  extractLeads: (id, limit = 10) =>
    request(`/api/search-jobs/${id}/extract-leads?limit=${limit}`, {
      method: 'POST',
    }),
  retryFailed: (id, limit = 10) =>
    request(`/api/search-jobs/${id}/retry-failed?limit=${limit}`, {
      method: 'POST',
    }),
};

export const leadsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', params.page);
    if (params.page_size) qs.set('page_size', params.page_size);
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    if (params.country) qs.set('country', params.country);
    if (params.university) qs.set('university', params.university);
    if (params.profession) qs.set('profession', params.profession);
    if (params.job_id) qs.set('job_id', params.job_id);
    return request(`/api/leads?${qs.toString()}`);
  },
  get: (id) => request(`/api/leads/${id}`),
  update: (id, data) =>
    request(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
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
  audit: () =>
    request('/api/leads/audit', {
      method: 'POST',
    }),
};

export const reviewQueueApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', params.page);
    if (params.page_size) qs.set('page_size', params.page_size);
    if (params.search) qs.set('search', params.search);
    if (params.job_id) qs.set('job_id', params.job_id);
    return request(`/api/review-queue?${qs.toString()}`);
  },
  approve: (id, reason = null) =>
    request(`/api/review-queue/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  reject: (id, reason = null) =>
    request(`/api/review-queue/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

export const analyticsApi = {
  get: () => request('/api/analytics'),
};

export const settingsApi = {
  get: () => request('/api/settings'),
};
