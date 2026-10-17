
import React, { useEffect, useState } from 'react';
import { BarChart2, Globe, Building, Zap, PieChart } from 'lucide-react';
import { analyticsApi } from '../../services/api-client';
import MetricCard from '../../components/ui/MetricCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await analyticsApi.get();
        setData(res);
      } catch (err) {
        setError(err.message || 'Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <LoadingSpinner text="Computing database analytics..." />;
  if (error || !data) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: 'var(--danger-light)' }}>
        <p style={{ color: 'var(--danger-text)', margin: 0 }}>{error || 'Unable to compute analytics.'}</p>
      </div>
    );
  }

  const { efficiency, leads_by_country, leads_by_university, leads_by_status, result_outcomes } = data;

  return (
    <div>
      {/* Top Efficiency Metrics */}
      <div className="grid-cols-4" style={{ marginBottom: '24px' }}>
        <MetricCard
          title="Qualified Leads"
          value={efficiency.qualified_leads}
          subtitle={`Out of ${efficiency.total_leads} total contacts`}
          icon={Zap}
          color="var(--text-primary)"
        />
        <MetricCard
          title="SerpApi Requests"
          value={efficiency.serpapi_requests_used}
          subtitle="Total discovery requests consumed"
          icon={BarChart2}
          color="var(--text-primary)"
        />
        <MetricCard
          title="Leads Per Credit"
          value={`${efficiency.leads_per_request}x`}
          subtitle="Target metric for discovery efficiency"
          icon={Zap}
          color="var(--text-primary)"
        />
        <MetricCard
          title="Discovered URLs"
          value={efficiency.total_urls_discovered}
          subtitle="Pages parsed by extraction engine"
          icon={Globe}
          color="var(--text-primary)"
        />
      </div>

      <div className="grid-cols-2" style={{ marginBottom: '24px' }}>
        {/* Leads by Country */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <span className="card-title">
              <Globe size={16} color="var(--text-primary)" />
              Qualified Leads by Country
            </span>
          </div>

          {leads_by_country.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No country data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {leads_by_country.map((c) => {
                const pct = efficiency.qualified_leads > 0
                  ? Math.round((c.count / efficiency.qualified_leads) * 100)
                  : 0;
                return (
                  <div key={c.country}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500 }}>{c.country}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        <strong>{c.count}</strong> leads ({pct}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--primary)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leads by University */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <span className="card-title">
              <Building size={16} color="var(--text-primary)" />
              Top Academic Institutions
            </span>
          </div>

          {leads_by_university.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No university affiliation data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {leads_by_university.map((u, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {u.university}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '9999px' }}>
                    {u.count} leads
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Outcome Distribution Breakdown */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <PieChart size={16} color="var(--text-primary)" />
            Search Result Outcomes & Qualification Distribution
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
              Webpage Processing Status
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result_outcomes.map((r) => (
                <div key={r.status} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ textTransform: 'capitalize', fontSize: '13px' }}>{r.status}</span>
                  <strong style={{ fontSize: '13px' }}>{r.count} pages</strong>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
              Lead Qualification Breakdown
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {leads_by_status.map((s) => (
                <div key={s.status} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ textTransform: 'capitalize', fontSize: '13px' }}>{s.status.replace('_', ' ')}</span>
                  <strong style={{ fontSize: '13px' }}>{s.count} contacts</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
