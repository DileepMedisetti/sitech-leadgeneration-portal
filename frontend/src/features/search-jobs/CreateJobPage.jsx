import React, { useState } from 'react';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { searchJobsApi } from '../../services/api-client';
import CountrySelect from '../../components/ui/CountrySelect';

export default function CreateJobPage({ onNavigate }) {
  const [formData, setFormData] = useState({
    search_name: '',
    description: '',
    country: '',
    university: '',
    department: '',
    profession: '',
    keywords: '',
    target_leads: 25,
    max_serpapi_requests: 5,
  });

  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const validate = () => {
    const newErrors = {};

    if (formData.search_name && formData.search_name.length > 255) {
      newErrors.search_name = 'Job name cannot exceed 255 characters.';
    }

    if (!formData.keywords.trim()) {
      newErrors.keywords = 'Search keywords are required.';
    }

    const leadsNum = Number(formData.target_leads);
    if (!formData.target_leads || isNaN(leadsNum) || leadsNum <= 0) {
      newErrors.target_leads = 'Target leads must be a positive integer greater than 0.';
    }

    const requestsNum = Number(formData.max_serpapi_requests);
    if (!formData.max_serpapi_requests || isNaN(requestsNum) || requestsNum <= 0) {
      newErrors.max_serpapi_requests = 'Max search requests must be a positive integer greater than 0.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validate();
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Math.max(0, parseInt(value, 10) || 0)) : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleCountryChange = (countryName) => {
    setFormData((prev) => ({ ...prev, country: countryName }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({
      search_name: true,
      keywords: true,
      target_leads: true,
      max_serpapi_requests: true,
    });

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      setSubmitError(null);

      const criteria = {};
      if (formData.description.trim()) criteria.description = formData.description.trim();
      if (formData.country.trim()) criteria.country = formData.country.trim();
      if (formData.university.trim()) criteria.university = formData.university.trim();
      if (formData.department.trim()) criteria.department = formData.department.trim();
      if (formData.profession.trim()) criteria.profession = formData.profession.trim();

      const payload = {
        search_name: formData.search_name.trim() || undefined,
        keywords: formData.keywords.trim(),
        target_leads: Number(formData.target_leads) || 25,
        max_serpapi_requests: Number(formData.max_serpapi_requests) || 5,
        search_criteria: Object.keys(criteria).length > 0 ? criteria : undefined,
      };

      const createdJob = await searchJobsApi.create(payload);
      onNavigate('job-detail', createdJob.id);
    } catch (err) {
      setSubmitError(err.message || 'Failed to create search job.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Page Header with Back Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => onNavigate('jobs')}
          className="btn btn-secondary btn-sm"
          style={{
            marginBottom: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-secondary)',
          }}
        >
          <ArrowLeft size={14} /> Back to Search Jobs
        </button>

        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
            marginBottom: '4px',
          }}
        >
          Create Search Job
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Configure a search to discover relevant academic leads.
        </p>
      </div>

      {/* Backend / Submission Error Banner */}
      {submitError && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--danger-light)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger-text)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{submitError}</span>
        </div>
      )}

      {/* Single Main Form Container */}
      <div
        className="card"
        style={{
          padding: '28px 32px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: 0,
        }}
      >
        <form onSubmit={handleSubmit} noValidate>
          {/* 1. Job Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="job-name">
              Job Name
            </label>
            <input
              id="job-name"
              type="text"
              name="search_name"
              value={formData.search_name}
              onChange={handleChange}
              onBlur={() => handleBlur('search_name')}
              placeholder="e.g. Stanford University Faculty Search"
              maxLength={255}
              className={`form-control ${touched.search_name && errors.search_name ? 'is-invalid' : ''}`}
              style={{
                borderColor: touched.search_name && errors.search_name ? 'var(--danger)' : undefined,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span className="form-helper">
                A descriptive name to identify and organize this search job.
              </span>
              {touched.search_name && errors.search_name && (
                <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 500 }}>
                  {errors.search_name}
                </span>
              )}
            </div>
          </div>

          {/* 2. Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="job-description">
              Description
            </label>
            <textarea
              id="job-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="e.g. Discovering engineering and computer science professors for academic outreach."
              rows={2}
              className="form-control"
              style={{ resize: 'vertical' }}
            />
            <span className="form-helper" style={{ marginTop: '2px' }}>
              Optional notes or objectives for this search.
            </span>
          </div>

          {/* 3. Country & University (2-column) */}
          <div className="grid-cols-2" style={{ marginBottom: '18px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="job-country">
                Country
              </label>
              <CountrySelect
                id="job-country"
                value={formData.country}
                onChange={handleCountryChange}
              />
              <span className="form-helper" style={{ marginTop: '2px' }}>
                Geographic location of target institutions.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="job-university">
                University / Institution
              </label>
              <input
                id="job-university"
                type="text"
                name="university"
                value={formData.university}
                onChange={handleChange}
                placeholder="e.g. Stanford University"
                className="form-control"
              />
              <span className="form-helper" style={{ marginTop: '2px' }}>
                Target a specific institution, or leave empty for nationwide.
              </span>
            </div>
          </div>

          {/* 4. Department & Academic Role (2-column) */}
          <div className="grid-cols-2" style={{ marginBottom: '18px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="job-department">
                Department
              </label>
              <input
                id="job-department"
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="e.g. Computer Science"
                className="form-control"
              />
              <span className="form-helper" style={{ marginTop: '2px' }}>
                Academic department or faculty division.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="job-profession">
                Academic Role / Lead Type
              </label>
              <input
                id="job-profession"
                type="text"
                name="profession"
                value={formData.profession}
                onChange={handleChange}
                placeholder="e.g. Professor, Assistant Professor, Researcher"
                className="form-control"
              />
              <span className="form-helper" style={{ marginTop: '2px' }}>
                Target academic rank or role designation.
              </span>
            </div>
          </div>

          {/* 5. Search Keywords (Required) */}
          <div className="form-group">
            <label className="form-label" htmlFor="job-keywords">
              Search Keywords <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="job-keywords"
              type="text"
              name="keywords"
              value={formData.keywords}
              onChange={handleChange}
              onBlur={() => handleBlur('keywords')}
              placeholder='e.g. "Stanford University" "Computer Science" professor email directory'
              className={`form-control ${touched.keywords && errors.keywords ? 'is-invalid' : ''}`}
              style={{
                borderColor: touched.keywords && errors.keywords ? 'var(--danger)' : undefined,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span className="form-helper">
                Primary search query executed by the search provider to discover candidate profiles and directories.
              </span>
              {touched.keywords && errors.keywords && (
                <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 500 }}>
                  {errors.keywords}
                </span>
              )}
            </div>
          </div>

          {/* 6. Target Leads & Max Search Requests (2-column, Required) */}
          <div className="grid-cols-2" style={{ marginBottom: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="job-target-leads">
                Target Leads <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="job-target-leads"
                type="number"
                min="1"
                step="1"
                name="target_leads"
                value={formData.target_leads}
                onChange={handleChange}
                onBlur={() => handleBlur('target_leads')}
                className={`form-control ${touched.target_leads && errors.target_leads ? 'is-invalid' : ''}`}
                style={{
                  borderColor: touched.target_leads && errors.target_leads ? 'var(--danger)' : undefined,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span className="form-helper">
                  Number of qualified leads to acquire before completing.
                </span>
                {touched.target_leads && errors.target_leads && (
                  <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 500 }}>
                    {errors.target_leads}
                  </span>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="job-max-requests">
                Max Search Requests <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="job-max-requests"
                type="number"
                min="1"
                step="1"
                name="max_serpapi_requests"
                value={formData.max_serpapi_requests}
                onChange={handleChange}
                onBlur={() => handleBlur('max_serpapi_requests')}
                className={`form-control ${touched.max_serpapi_requests && errors.max_serpapi_requests ? 'is-invalid' : ''}`}
                style={{
                  borderColor: touched.max_serpapi_requests && errors.max_serpapi_requests ? 'var(--danger)' : undefined,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span className="form-helper">
                  Maximum number of search provider requests allocated.
                </span>
                {touched.max_serpapi_requests && errors.max_serpapi_requests && (
                  <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 500 }}>
                    {errors.max_serpapi_requests}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Subtle divider */}
          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              margin: '28px 0 20px',
            }}
          />

          {/* Actions: Cancel & Create Search Job */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => onNavigate('jobs')}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                minWidth: '160px',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Creating Job...</span>
                </>
              ) : (
                <span>Create Search Job</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
