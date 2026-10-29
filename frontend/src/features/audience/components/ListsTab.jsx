import React, { useCallback, useEffect, useState } from 'react';
import {
  PlusCircle,
  FolderPlus,
  FileSpreadsheet,
  Search,
  Users,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { audienceApi } from '../../../services/api-client';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Pagination from '../../../components/ui/Pagination';
import EmptyState from '../../../components/ui/EmptyState';

export default function ListsTab({ onSelectList, onCreateList }) {
  const [lists, setLists] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [contactFilter, setContactFilter] = useState(''); // '', 'with_contacts', 'empty'
  const [timeFilter, setTimeFilter] = useState(''); // '', '7_days', '30_days'
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await audienceApi.getLists({
        page,
        page_size: 15,
        search: search.trim() || undefined,
        filter: contactFilter || undefined,
        updated_within: timeFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setLists(res.items || []);
      setTotalPages(res.total_pages || 1);
      setTotalCount(res.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load contact lists.');
    } finally {
      setLoading(false);
    }
  }, [page, search, contactFilter, timeFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const hasActiveFilters = Boolean(search || contactFilter || timeFilter || sortBy !== 'updated_at' || sortOrder !== 'desc');

  const handleResetFilters = () => {
    setSearch('');
    setContactFilter('');
    setTimeFilter('');
    setSortBy('updated_at');
    setSortOrder('desc');
    setPage(1);
  };

  return (
    <div>
      {/* Top Action & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Search & Filter Inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: '1 1 auto' }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px', maxWidth: '320px' }}>
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
              placeholder="Search lists by name..."
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
              }}
            />
          </div>

          {/* Contact Content Filter */}
          <select
            value={contactFilter}
            onChange={(e) => {
              setContactFilter(e.target.value);
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
            <option value="">All Lists</option>
            <option value="with_contacts">Lists with Contacts</option>
            <option value="empty">Empty Lists</option>
          </select>

          {/* Timeframe Filter */}
          <select
            value={timeFilter}
            onChange={(e) => {
              setTimeFilter(e.target.value);
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
            <option value="">Any Time</option>
            <option value="7_days">Updated in Last 7 Days</option>
            <option value="30_days">Updated in Last 30 Days</option>
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
            <option value="updated_at:desc">Recently Updated</option>
            <option value="updated_at:asc">Oldest Updated</option>
            <option value="created_at:desc">Recently Created</option>
            <option value="name:asc">Name (A–Z)</option>
            <option value="name:desc">Name (Z–A)</option>
            <option value="contact_count:desc">Most Contacts</option>
            <option value="contact_count:asc">Fewest Contacts</option>
          </select>

          {hasActiveFilters && (
            <button
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

        {/* Create Audience List Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onCreateList && onCreateList('custom')}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
            }}
            title="Create custom list by adding contacts manually or importing CSV/XLSX"
          >
            <PlusCircle size={15} />
            <span>Create New List</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner text="Loading contact lists..." />
      ) : error ? (
        <div className="card" style={{ borderLeft: '4px solid var(--border-focus)' }}>
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>{error}</p>
        </div>
      ) : lists.length === 0 ? (
        <EmptyState
          title="No contact lists found"
          message={
            hasActiveFilters
              ? 'No lists match your current search and filter settings.'
              : 'Create your first saved list to organize verified contacts for future outreach.'
          }
          action={
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => onCreateList && onCreateList('existing')}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FolderPlus size={14} /> Create from Leads
              </button>
              <button
                type="button"
                onClick={() => onCreateList && onCreateList('custom')}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <PlusCircle size={14} /> Custom Contact List
              </button>
            </div>
          }
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>List Name</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'center' }}>Contacts</th>
                  <th>Last Updated</th>
                  <th>Created</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lists.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onSelectList(item.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: item.list_type === 'generated' ? '#f5f3ff' : '#eff6ff',
                          color: item.list_type === 'generated' ? '#7c3aed' : '#2563eb',
                          border: item.list_type === 'generated' ? '1px solid #ddd6fe' : '1px solid #bfdbfe',
                        }}
                      >
                        {item.list_type === 'generated' ? 'Generated' : 'Custom'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: '320px' }}>
                      <span
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.description || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--bg-subtle)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        <Users size={12} />
                        {item.contact_count}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(item.updated_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lists.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={15}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
