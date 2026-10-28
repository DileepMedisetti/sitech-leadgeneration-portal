import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  FolderPlus,
  PlusCircle,
  Search,
  Users,
  AlertCircle,
  RotateCcw,
  Loader2,
  X,
  Mail,
  Building,
  Plus,
  Upload,
  FileSpreadsheet,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Briefcase,
  Globe,
} from 'lucide-react';
import { audienceApi } from '../../../services/api-client';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Pagination from '../../../components/ui/Pagination';
import EmptyState from '../../../components/ui/EmptyState';
import ConfirmationModal from '../../../components/ui/ConfirmationModal';
import { COUNTRIES } from '../../../data/countries';

export default function CreateListPage({ onNavigate, onSuccess, activeParam }) {
  // Mode selection: 'existing' (Use Existing Data) vs 'custom' (Create Manually)
  const [creationMode, setCreationMode] = useState(() => {
    if (activeParam && typeof activeParam === 'object' && activeParam.mode) {
      return activeParam.mode === 'custom' ? 'custom' : 'existing';
    }
    if (typeof window !== 'undefined' && window.location.search.includes('mode=custom')) {
      return 'custom';
    }
    return 'existing';
  });

  useEffect(() => {
    if (activeParam && typeof activeParam === 'object' && activeParam.mode) {
      setCreationMode(activeParam.mode === 'custom' ? 'custom' : 'existing');
    }
  }, [activeParam]);

  // Shared List Metadata
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState({});
  const [nameError, setNameError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ============================================================================
  // Mode 1: Existing Leads State
  // ============================================================================
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loadingContacts, setLoadingContacts] = useState(true);

  const selectAllCheckboxRef = useRef(null);

  const fetchEligibleContacts = useCallback(async () => {
    try {
      setLoadingContacts(true);
      const res = await audienceApi.getContacts({
        page,
        page_size: 20,
        search: search.trim() || undefined,
        country: countryFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setContacts(res.items || []);
      setTotalPages(res.total_pages || 1);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.error('Failed to load eligible contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  }, [page, search, countryFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (creationMode === 'existing') {
      fetchEligibleContacts();
    }
  }, [creationMode, fetchEligibleContacts]);

  const visibleIds = contacts.map((c) => c.id);
  const isAllVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedLeadIds.includes(id));
  const isSomeVisibleSelected =
    visibleIds.some((id) => selectedLeadIds.includes(id)) && !isAllVisibleSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isSomeVisibleSelected;
    }
  }, [isSomeVisibleSelected]);

  const handleToggleLead = (id) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleDeselectAll = () => {
    setSelectedLeadIds([]);
  };

  const hasActiveFilters = Boolean(
    search || countryFilter || sortBy !== 'created_at' || sortOrder !== 'desc'
  );

  const handleResetFilters = () => {
    setSearch('');
    setCountryFilter('');
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
  };

  // ============================================================================
  // Mode 2: Custom Contacts State (Manual + Spreadsheet Import)
  // ============================================================================
  const [pendingContacts, setPendingContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Manual Contact Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingContactId, setEditingContactId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profession: '',
    university: '',
    country: '',
  });
  const [formErrors, setFormErrors] = useState({});

  // Delete Contact Modal
  const [contactToDelete, setContactToDelete] = useState(null);

  // Import Spreadsheet Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importTab, setImportTab] = useState('valid');
  const fileInputRef = useRef(null);

  const validateContactForm = () => {
    const errors = {};
    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim().toLowerCase();

    if (!trimmedName) {
      errors.name = 'Contact name is required.';
    }

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address (e.g. professor@university.edu).';
    } else {
      const isDuplicate = pendingContacts.some(
        (c) => c.email.toLowerCase() === trimmedEmail && c.id !== editingContactId
      );
      if (isDuplicate) {
        errors.email = 'A contact with this email address already exists in this list.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenAddModal = () => {
    setModalMode('create');
    setEditingContactId(null);
    setFormData({
      name: '',
      email: '',
      profession: '',
      university: '',
      country: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (contact) => {
    setModalMode('edit');
    setEditingContactId(contact.id);
    setFormData({
      name: contact.name,
      email: contact.email,
      profession: contact.profession || '',
      university: contact.university || '',
      country: contact.country || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSaveContactModal = (e) => {
    e.preventDefault();
    if (!validateContactForm()) return;

    if (modalMode === 'create') {
      const newContact = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        profession: formData.profession.trim() || null,
        university: formData.university.trim() || null,
        country: formData.country.trim() || null,
        addedAt: new Date().toISOString(),
      };
      setPendingContacts((prev) => [newContact, ...prev]);
    } else {
      setPendingContacts((prev) =>
        prev.map((c) =>
          c.id === editingContactId
            ? {
                ...c,
                name: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                profession: formData.profession.trim() || null,
                university: formData.university.trim() || null,
                country: formData.country.trim() || null,
              }
            : c
        )
      );
    }

    setIsModalOpen(false);
  };

  const handleDeleteContact = () => {
    if (!contactToDelete) return;
    setPendingContacts((prev) => prev.filter((c) => c.id !== contactToDelete.id));
    setContactToDelete(null);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  };

  const handleRunFileValidation = async () => {
    if (!importFile) return;
    try {
      setImporting(true);
      const res = await audienceApi.validateContactFile(importFile);
      setImportResult(res);
      setImportTab(res.valid_contacts?.length > 0 ? 'valid' : 'invalid');
    } catch (err) {
      console.error('File validation error:', err);
      alert(err.message || 'Failed to parse spreadsheet file.');
    } finally {
      setImporting(false);
    }
  };

  const handleCommitImport = () => {
    if (!importResult || !importResult.valid_contacts?.length) return;
    const existingEmails = new Set(pendingContacts.map((c) => c.email.toLowerCase()));
    const newItems = [];

    importResult.valid_contacts.forEach((v) => {
      const normEmail = v.email.toLowerCase();
      if (!existingEmails.has(normEmail)) {
        existingEmails.add(normEmail);
        newItems.push({
          id: `import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: v.name,
          email: normEmail,
          profession: v.profession || null,
          university: v.university || null,
          country: v.country || null,
          addedAt: new Date().toISOString(),
        });
      }
    });

    setPendingContacts((prev) => [...newItems, ...prev]);
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportResult(null);
  };

  const filteredCustomContacts = pendingContacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.university && c.university.toLowerCase().includes(q)) ||
      (c.profession && c.profession.toLowerCase().includes(q))
    );
  });

  // ============================================================================
  // Validation & Form Submission
  // ============================================================================
  const validateForm = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('List name is required.');
      return false;
    }
    if (trimmed.length > 255) {
      setNameError('List name cannot exceed 255 characters.');
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleNameBlur = () => {
    setTouched((prev) => ({ ...prev, name: true }));
    validateForm();
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
    if (nameError) {
      setNameError(null);
    }
  };

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('audience', { tab: 'lists' });
    } else {
      window.history.back();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true });

    if (!validateForm()) return;

    try {
      setSubmitting(true);
      setSubmitError(null);

      let payload;
      if (creationMode === 'existing') {
        payload = {
          name: name.trim(),
          description: description.trim() || null,
          list_type: 'generated',
          lead_ids: selectedLeadIds,
        };
      } else {
        payload = {
          name: name.trim(),
          description: description.trim() || null,
          list_type: 'custom',
          contacts: pendingContacts.map((c) => ({
            name: c.name.trim(),
            email: c.email.trim().toLowerCase(),
            profession: c.profession?.trim() || null,
            university: c.university?.trim() || null,
            country: c.country?.trim() || null,
          })),
        };
      }

      const res = await audienceApi.createList(payload);

      if (onSuccess) {
        onSuccess(res);
      } else if (onNavigate) {
        const count =
          res.contact_count ??
          (creationMode === 'existing'
            ? res.membership_summary?.added || selectedLeadIds.length
            : pendingContacts.length);

        if (res && res.id) {
          onNavigate('audience', {
            listId: res.id,
            tab: 'lists',
            notification: `Contact list "${res.name}" created successfully with ${count} contact(s).`,
          });
        } else {
          onNavigate('audience', {
            tab: 'lists',
            notification: `Contact list "${res.name}" created successfully.`,
          });
        }
      }
    } catch (err) {
      setSubmitError(
        err.message || 'Failed to create contact list. Please check your inputs and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const totalSelectedCount =
    creationMode === 'existing' ? selectedLeadIds.length : pendingContacts.length;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* Top Back Navigation & Page Title */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={handleBack}
          className="btn btn-secondary btn-sm"
          style={{
            marginBottom: '14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-secondary)',
          }}
        >
          <ArrowLeft size={14} /> Back to Lists
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                margin: '0 0 6px 0',
              }}
            >
              Create Audience List
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0 }}>
              Build an outreach list by selecting from existing database leads or supplying custom contacts.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full, 999px)',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-color, #e2e8f0)',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--text-primary, #0f172a)',
            }}
          >
            <Users size={14} />
            <span>
              {totalSelectedCount} contact{totalSelectedCount === 1 ? '' : 's'}{' '}
              {creationMode === 'existing' ? 'selected' : 'staged'}
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {submitError && (
        <div
          className="alert-banner alert-danger"
          style={{
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{submitError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Mode Selector Segmented Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        {/* Option 2: Create List — Use Existing Data */}
        <button
          type="button"
          onClick={() => setCreationMode('existing')}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            padding: '16px 18px',
            borderRadius: 'var(--radius-lg, 10px)',
            border: `2px solid ${creationMode === 'existing' ? '#2563eb' : 'var(--border-color, #e2e8f0)'}`,
            backgroundColor: creationMode === 'existing' ? '#eff6ff' : '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: creationMode === 'existing' ? '0 2px 8px rgba(37, 99, 235, 0.12)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: creationMode === 'existing' ? '#2563eb' : '#f1f5f9',
              color: creationMode === 'existing' ? '#ffffff' : '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Users size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                Create List — Use Existing Data
              </span>
              {creationMode === 'existing' && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                  }}
                >
                  Active
                </span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
              Browse and select from verified leads already discovered and stored in your database.
            </p>
          </div>
        </button>

        {/* Option 1: Custom List — Create Manually */}
        <button
          type="button"
          onClick={() => setCreationMode('custom')}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            padding: '16px 18px',
            borderRadius: 'var(--radius-lg, 10px)',
            border: `2px solid ${creationMode === 'custom' ? '#2563eb' : 'var(--border-color, #e2e8f0)'}`,
            backgroundColor: creationMode === 'custom' ? '#eff6ff' : '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: creationMode === 'custom' ? '0 2px 8px rgba(37, 99, 235, 0.12)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: creationMode === 'custom' ? '#2563eb' : '#f1f5f9',
              color: creationMode === 'custom' ? '#ffffff' : '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FileSpreadsheet size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                Custom List — Create Manually
              </span>
              {creationMode === 'custom' && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                  }}
                >
                  Active
                </span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
              Add contacts manually using a form or import contacts from a CSV or XLSX spreadsheet.
            </p>
          </div>
        </button>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit}>
        {/* Card 1: List Details (Shared across both modes) */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                1. List Details
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Define the identification metadata for your new saved list.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 24px' }}>
            {/* List Name */}
            <div>
              <label
                htmlFor="list-name"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: 'var(--text-primary)',
                }}
              >
                List Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="list-name"
                type="text"
                required
                maxLength={255}
                disabled={submitting}
                placeholder={
                  creationMode === 'existing'
                    ? 'e.g., Computer Science Chairs & AI Faculty 2026'
                    : 'e.g., Invited Keynote Speakers — Custom Roster'
                }
                value={name}
                onChange={handleNameChange}
                onBlur={handleNameBlur}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '13.5px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${touched.name && nameError ? '#dc2626' : 'var(--border-color)'}`,
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxShadow: touched.name && nameError ? '0 0 0 2px rgba(220, 38, 38, 0.15)' : 'none',
                  boxSizing: 'border-box',
                }}
              />
              {touched.name && nameError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    color: '#dc2626',
                    marginTop: '5px',
                  }}
                >
                  <AlertCircle size={12} />
                  <span>{nameError}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="list-description"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: 'var(--text-primary)',
                }}
              >
                Description{' '}
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>
                  (Optional)
                </span>
              </label>
              <textarea
                id="list-description"
                rows={3}
                disabled={submitting}
                placeholder="e.g., Target cohort for Sitech Series Academic Research Symposium invitations."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* Card 2 (Mode 1): Select Existing Leads                               */}
        {/* ==================================================================== */}
        {creationMode === 'existing' && (
          <div className="card" style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  2. Select Existing Leads
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Select verified eligible contacts from your database to enroll into this list.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: selectedLeadIds.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {selectedLeadIds.length} contact{selectedLeadIds.length === 1 ? '' : 's'} selected
                </span>
                {selectedLeadIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '11.5px', padding: '3px 8px' }}
                  >
                    Deselect All
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div
              style={{
                padding: '14px 20px',
                backgroundColor: 'var(--bg-subtle)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: '1 1 auto' }}>
                {/* Search */}
                <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px', maxWidth: '340px' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search contacts (name, email, university)..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      fontSize: '12.5px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Country Filter */}
                <select
                  value={countryFilter}
                  onChange={(e) => {
                    setCountryFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '7px 12px',
                    fontSize: '12.5px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">All Countries</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Sort By Dropdown */}
                <select
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => {
                    const [sb, so] = e.target.value.split(':');
                    setSortBy(sb);
                    setSortOrder(so);
                    setPage(1);
                  }}
                  style={{
                    padding: '7px 12px',
                    fontSize: '12.5px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="created_at:desc">Newest Discovered</option>
                  <option value="created_at:asc">Oldest Discovered</option>
                  <option value="name:asc">Name (A–Z)</option>
                  <option value="name:desc">Name (Z–A)</option>
                  <option value="university:asc">University (A–Z)</option>
                  <option value="country:asc">Country (A–Z)</option>
                  <option value="confidence_score:desc">Highest Confidence</option>
                </select>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="btn btn-sm btn-outline"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px' }}
                    title="Reset all filters"
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Contacts Table View */}
            {loadingContacts ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <LoadingSpinner size="md" />
                <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Loading eligible contacts...
                </div>
              </div>
            ) : contacts.length === 0 ? (
              <div style={{ padding: '40px 20px' }}>
                <EmptyState
                  title="No eligible contacts found"
                  description={
                    hasActiveFilters
                      ? 'No contacts match the current search query or filter criteria.'
                      : 'There are currently no verified eligible leads available in your database.'
                  }
                  action={
                    hasActiveFilters ? (
                      <button type="button" onClick={handleResetFilters} className="btn btn-secondary btn-sm">
                        Clear Filters
                      </button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ width: '40px', padding: '10px 14px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          ref={selectAllCheckboxRef}
                          checked={isAllVisibleSelected}
                          onChange={handleSelectVisible}
                          style={{ cursor: 'pointer', borderRadius: '3px' }}
                          title="Select all contacts on this page"
                        />
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Name & Email</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>University & Country</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Specialization / Role</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => {
                      const isSelected = selectedLeadIds.includes(contact.id);
                      return (
                        <tr
                          key={contact.id}
                          onClick={() => handleToggleLead(contact.id)}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'var(--bg-primary-subtle, #eff6ff)' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'background-color 0.1s ease',
                          }}
                        >
                          <td
                            style={{ padding: '11px 14px', textAlign: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleLead(contact.id)}
                              style={{ cursor: 'pointer', borderRadius: '3px' }}
                            />
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{contact.name}</div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                marginTop: '2px',
                              }}
                            >
                              <Mail size={12} style={{ color: 'var(--text-muted)' }} />
                              <span>{contact.email}</span>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-primary)' }}>
                              <Building size={12} style={{ color: 'var(--text-muted)' }} />
                              <span>{contact.university || '—'}</span>
                            </div>
                            {contact.country && (
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--text-muted)',
                                  marginTop: '2px',
                                  paddingLeft: '17px',
                                }}
                              >
                                {contact.country}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '11px 14px', maxWidth: '240px' }}>
                            <span
                              style={{
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: 'var(--text-secondary)',
                              }}
                              title={contact.research_specialization || contact.profession || ''}
                            >
                              {contact.research_specialization || contact.profession || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            {contact.confidence_score !== null && contact.confidence_score !== undefined ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 7px',
                                  borderRadius: 'var(--radius-sm, 4px)',
                                  backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                                  border: '1px solid var(--border-color, #e2e8f0)',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                }}
                              >
                                {Math.round(contact.confidence_score * 100)}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {contacts.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)' }}>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={20}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* Card 2 (Mode 2): Custom Contacts (Manual + Spreadsheet Import)       */}
        {/* ==================================================================== */}
        {creationMode === 'custom' && (
          <div className="card" style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  2. Custom Contacts
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Add contacts manually using a form or import a spreadsheet (.csv or .xlsx).
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={14} />
                  <span>Import Spreadsheet</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} />
                  <span>Add Contact Manually</span>
                </button>
              </div>
            </div>

            {/* Filter / Search Bar for staged contacts */}
            <div
              style={{
                padding: '12px 20px',
                backgroundColor: 'var(--bg-subtle)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 260px', maxWidth: '360px' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Filter staged contacts (name, email, university)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    fontSize: '12.5px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {pendingContacts.length} custom contact{pendingContacts.length === 1 ? '' : 's'} staged
              </div>
            </div>

            {/* Custom Contacts Table */}
            {pendingContacts.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <EmptyState
                  title="No custom contacts added yet"
                  description="Use the buttons above to manually add contacts or upload a CSV/XLSX spreadsheet."
                  action={
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Plus size={14} /> Add First Contact
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsImportModalOpen(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Upload size={14} /> Import File
                      </button>
                    </div>
                  }
                />
              </div>
            ) : filteredCustomContacts.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  No staged contacts match "{searchQuery}".
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '8px' }}
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Contact Name</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Email Address</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Profession / Title</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>University / Organization</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Country</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, width: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomContacts.map((contact) => (
                      <tr key={contact.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {contact.name}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                            <span>{contact.email}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                          {contact.profession || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building size={13} style={{ color: 'var(--text-muted)' }} />
                            <span>{contact.university || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                          {contact.country || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(contact)}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}
                              title="Edit contact"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setContactToDelete(contact)}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 6px', color: '#dc2626' }}
                              title="Delete contact"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Card 3: Sticky Action Footer */}
        <div
          className="card"
          style={{
            position: 'sticky',
            bottom: '16px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            zIndex: 30,
            padding: '16px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Ready to create list:</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {name.trim() ? `"${name.trim()}"` : '(Untitled)'} with {totalSelectedCount}{' '}
              {creationMode === 'existing' ? 'selected' : 'custom'} contact
              {totalSelectedCount === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={handleBack}
              className="btn btn-secondary"
              style={{ minWidth: '90px' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '150px',
                justifyContent: 'center',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="spinner" />
                  <span>Creating List...</span>
                </>
              ) : creationMode === 'existing' ? (
                <>
                  <FolderPlus size={15} />
                  <span>
                    Create List {selectedLeadIds.length > 0 ? `(${selectedLeadIds.length})` : ''}
                  </span>
                </>
              ) : (
                <>
                  <PlusCircle size={15} />
                  <span>
                    Create Custom List {pendingContacts.length > 0 ? `(${pendingContacts.length})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ==================================================================== */}
      {/* Modal: Add / Edit Manual Custom Contact                              */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {modalMode === 'create' ? 'Add Contact Manually' : 'Edit Contact'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContactModal} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Full Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                    Full Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prof. Alan Turing"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: `1px solid ${formErrors.name ? '#dc2626' : 'var(--border-color)'}`,
                      boxSizing: 'border-box',
                    }}
                  />
                  {formErrors.name && (
                    <span style={{ fontSize: '11.5px', color: '#dc2626', marginTop: '3px', display: 'block' }}>
                      {formErrors.name}
                    </span>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                    Email Address <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. aturing@cambridge.ac.uk"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: `1px solid ${formErrors.email ? '#dc2626' : 'var(--border-color)'}`,
                      boxSizing: 'border-box',
                    }}
                  />
                  {formErrors.email && (
                    <span style={{ fontSize: '11.5px', color: '#dc2626', marginTop: '3px', display: 'block' }}>
                      {formErrors.email}
                    </span>
                  )}
                </div>

                {/* Profession / Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                    Profession / Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Reader in Mathematics"
                    value={formData.profession}
                    onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* University / Company */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                    University / Company <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. University of Cambridge"
                    value={formData.university}
                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Country */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '5px' }}>
                    Country <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="">Select country...</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '22px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ minWidth: '80px' }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ minWidth: '110px' }}>
                  {modalMode === 'create' ? 'Add Contact' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Modal: Import Spreadsheet (CSV / XLSX)                               */}
      {/* ==================================================================== */}
      {isImportModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => {
            if (!importing) setIsImportModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '720px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={18} style={{ color: '#2563eb' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Import Spreadsheet (.csv or .xlsx)
                </h3>
              </div>
              <button
                type="button"
                disabled={importing}
                onClick={() => setIsImportModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {/* File Dropzone */}
              {!importResult ? (
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '36px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: '#f8fafc',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <Upload size={32} style={{ color: '#64748b', margin: '0 auto 10px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                      {importFile ? importFile.name : 'Click or drag a CSV or XLSX file here'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      Columns like name, email, university, country, and profession are auto-detected.
                    </div>
                  </div>

                  {importFile && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                      <button
                        type="button"
                        disabled={importing}
                        onClick={handleRunFileValidation}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        {importing ? (
                          <>
                            <Loader2 size={14} className="spinner" />
                            <span>Validating File...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} />
                            <span>Validate & Preview Records</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Import Partition Inspection View */
                <div>
                  {/* Summary Metric Badges */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '10px',
                      marginBottom: '16px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setImportTab('valid')}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: `1px solid ${importTab === 'valid' ? '#22c55e' : 'var(--border-color)'}`,
                        backgroundColor: importTab === 'valid' ? '#f0fdf4' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 600 }}>Valid Contacts</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d' }}>
                        {importResult.valid_count || 0}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportTab('invalid')}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: `1px solid ${importTab === 'invalid' ? '#ef4444' : 'var(--border-color)'}`,
                        backgroundColor: importTab === 'invalid' ? '#fef2f2' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 600 }}>Invalid Rows</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#b91c1c' }}>
                        {importResult.invalid_count || 0}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportTab('duplicate')}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: `1px solid ${importTab === 'duplicate' ? '#f59e0b' : 'var(--border-color)'}`,
                        backgroundColor: importTab === 'duplicate' ? '#fffbeb' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '11.5px', color: '#d97706', fontWeight: 600 }}>Duplicate Rows</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#b45309' }}>
                        {importResult.duplicate_count || 0}
                      </div>
                    </button>
                  </div>

                  {/* Tab Detail View */}
                  <div
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      maxHeight: '260px',
                      overflowY: 'auto',
                    }}
                  >
                    {importTab === 'valid' && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                          <tr>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Name</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Email</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>University</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Country</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(importResult.valid_contacts || []).map((v, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{v.name}</td>
                              <td style={{ padding: '7px 10px', color: '#475569' }}>{v.email}</td>
                              <td style={{ padding: '7px 10px', color: '#475569' }}>{v.university || '—'}</td>
                              <td style={{ padding: '7px 10px', color: '#475569' }}>{v.country || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {importTab === 'invalid' && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                          <tr>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '60px' }}>Row</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Data Sample</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Rejection Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(importResult.invalid_rows || []).map((inv, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: '#dc2626' }}>
                                #{inv.row_number}
                              </td>
                              <td style={{ padding: '7px 10px', color: '#475569' }}>
                                {inv.email || inv.name || JSON.stringify(inv.raw || {})}
                              </td>
                              <td style={{ padding: '7px 10px', color: '#dc2626' }}>{inv.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {importTab === 'duplicate' && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                          <tr>
                            <th style={{ padding: '8px 10px', textAlign: 'left', width: '60px' }}>Row</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Email</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Duplicate Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(importResult.duplicate_rows || []).map((dup, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: '#d97706' }}>
                                #{dup.row_number}
                              </td>
                              <td style={{ padding: '7px 10px', color: '#475569' }}>{dup.email}</td>
                              <td style={{ padding: '7px 10px', color: '#d97706' }}>
                                {dup.reason || 'Appears more than once in spreadsheet'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {importResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setImportResult(null);
                      setImportFile(null);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Upload Different File
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!importResult.valid_contacts?.length}
                      onClick={handleCommitImport}
                      className="btn btn-primary btn-sm"
                    >
                      Import {importResult.valid_contacts?.length || 0} Valid Contacts
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Contact Deletion */}
      <ConfirmationModal
        isOpen={Boolean(contactToDelete)}
        title="Remove Contact"
        message={`Are you sure you want to remove "${contactToDelete?.name}" (${contactToDelete?.email}) from this list?`}
        confirmLabel="Remove Contact"
        type="danger"
        onConfirm={handleDeleteContact}
        onCancel={() => setContactToDelete(null)}
      />
    </div>
  );
}
