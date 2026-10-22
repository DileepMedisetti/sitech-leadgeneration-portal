import React from 'react';
import {
  Send,
  Calendar,
  Clock,
  Globe,
  Info,
  CheckCircle2,
} from 'lucide-react';

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London, Edinburgh (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Rome (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi (GST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore, Hong Kong (SGT/HKT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Seoul (JST/KST)' },
  { value: 'Australia/Sydney', label: 'Sydney, Melbourne (AEST/AEDT)' },
];

export default function ScheduleStep({
  sendImmediately,
  setSendImmediately,
  scheduledAtDate,
  setScheduledAtDate,
  scheduledAtTime,
  setScheduledAtTime,
  timezoneName,
  setTimezoneName,
}) {
  const strategies = [
    {
      id: 'immediately',
      title: 'Send immediately',
      desc: 'Campaign proceeds directly toward dispatch after final review and deliverability preflight validation.',
      icon: Send,
      isSelected: sendImmediately,
      onSelect: () => {
        setSendImmediately(true);
      },
    },
    {
      id: 'scheduled',
      title: 'Schedule for later',
      desc: 'Specify a future calendar date, time, and timezone for automated durable background dispatch.',
      icon: Calendar,
      isSelected: !sendImmediately,
      onSelect: () => {
        setSendImmediately(false);
        if (!scheduledAtDate) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          setScheduledAtDate(tomorrow.toISOString().split('T')[0]);
        }
      },
    },
  ];

  return (
    <div
      className="campaign-card campaign-card-padded"
      style={{
        maxWidth: '820px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
      }}
    >
      {/* Centered Heading */}
      <div>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
          When to send
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
          Choose whether to launch your campaign immediately or schedule it for a verified future delivery window.
        </p>
      </div>

      {/* Exactly Two Selectable Strategy Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
        }}
      >
        {strategies.map((strat) => {
          const Icon = strat.icon;
          return (
            <div
              key={strat.id}
              onClick={strat.onSelect}
              style={{
                backgroundColor: strat.isSelected ? '#eff6ff' : '#ffffff',
                border: '1.5px solid',
                borderColor: strat.isSelected ? '#2563eb' : '#cbd5e1',
                borderRadius: '14px',
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                boxShadow: strat.isSelected ? '0 4px 14px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
              }}
              onMouseEnter={(e) => {
                if (!strat.isSelected) {
                  e.currentTarget.style.borderColor = '#94a3b8';
                }
              }}
              onMouseLeave={(e) => {
                if (!strat.isSelected) {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }
              }}
            >
              <div>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: strat.isSelected ? '#dbeafe' : '#f8fafc',
                    color: strat.isSelected ? '#2563eb' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <Icon size={24} />
                </div>

                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {strat.title}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
                  {strat.desc}
                </p>
              </div>

              <div
                style={{
                  marginTop: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: strat.isSelected ? '#2563eb' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {strat.isSelected ? (
                  <>
                    <CheckCircle2 size={16} /> Selected
                  </>
                ) : (
                  'Click to select'
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Future Scheduling Controls (when Schedule for Later is selected) */}
      {!sendImmediately && (
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
            Configure Dispatch Date & Timezone
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Date */}
            <div>
              <label className="campaign-label">
                Delivery Date
              </label>
              <input
                type="date"
                className="campaign-input"
                min={new Date().toISOString().split('T')[0]}
                value={scheduledAtDate}
                onChange={(e) => setScheduledAtDate(e.target.value)}
              />
            </div>

            {/* Time */}
            <div>
              <label className="campaign-label">
                Delivery Time
              </label>
              <input
                type="time"
                className="campaign-input"
                value={scheduledAtTime}
                onChange={(e) => setScheduledAtTime(e.target.value)}
              />
            </div>

            {/* Timezone */}
            <div>
              <label className="campaign-label">
                Timezone
              </label>
              <select
                className="campaign-select"
                value={timezoneName}
                onChange={(e) => setTimezoneName(e.target.value)}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Contextual Information Panel */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          fontSize: '13px',
          color: '#1e40af',
          lineHeight: 1.5,
        }}
      >
        <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          {sendImmediately ? (
            <span>
              <strong>Immediate Dispatch:</strong> Your outreach will be queued and sent immediately upon explicit confirmation in the Review step. Preflight deliverability checks and audience eligibility are evaluated before sending.
            </span>
          ) : (
            <span>
              <strong>Scheduled Dispatch:</strong> This campaign will be scheduled for{' '}
              <strong>
                {scheduledAtDate || 'selected date'} at {scheduledAtTime || '09:00'} ({timezoneName})
              </strong>
              . Normalized UTC timestamps will be stored. You can pause or cancel the schedule anytime before delivery begins.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
