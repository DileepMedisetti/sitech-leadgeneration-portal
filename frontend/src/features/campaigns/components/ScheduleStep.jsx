import React, { useMemo } from 'react';
import {
  Send,
  Calendar,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { COMMON_TIMEZONES } from '../campaignConstants';

export default function ScheduleStep({
  sendImmediately,
  setSendImmediately,
  scheduledAtDate,
  setScheduledAtDate,
  scheduledAtTime,
  setScheduledAtTime,
  timezoneName,
  setTimezoneName,
  fieldErrors = {},
  clearFieldError,
}) {
  // Compute minimum selectable date (today in YYYY-MM-DD)
  const todayString = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const handleSelectImmediately = () => {
    setSendImmediately(true);
    if (clearFieldError) clearFieldError('schedule');
  };

  const handleSelectScheduled = () => {
    setSendImmediately(false);
    if (!scheduledAtDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduledAtDate(tomorrow.toISOString().split('T')[0]);
    }
    if (!scheduledAtTime) {
      setScheduledAtTime('09:00');
    }
    if (clearFieldError) clearFieldError('schedule');
  };

  const handlePresetTomorrow = () => {
    setSendImmediately(false);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledAtDate(tomorrow.toISOString().split('T')[0]);
    setScheduledAtTime('09:00');
    if (clearFieldError) clearFieldError('schedule');
  };

  const handlePresetNextMonday = () => {
    setSendImmediately(false);
    const d = new Date();
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
    setScheduledAtDate(d.toISOString().split('T')[0]);
    setScheduledAtTime('09:30');
    if (clearFieldError) clearFieldError('schedule');
  };

  return (
    <div className="campaign-step-container">
      <div className="campaign-card campaign-card-padded campaign-schedule-card">
        {/* Section Heading */}
        <div className="campaign-section-header campaign-section-header-centered">
          <h2 className="campaign-section-title">Delivery Schedule</h2>
          <p className="campaign-section-subtitle">
            Choose whether to dispatch your outreach campaign immediately upon preflight approval or schedule it for a verified future delivery window.
          </p>
        </div>

        {fieldErrors.schedule && (
          <div className="campaign-inline-alert campaign-inline-alert-danger" role="alert">
            <AlertTriangle size={16} />
            <span>{fieldErrors.schedule}</span>
          </div>
        )}

        {/* Two Selectable Option Cards */}
        <div className="campaign-schedule-options-grid">
          {/* Option 1: Send Immediately */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleSelectImmediately}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelectImmediately();
              }
            }}
            className={`campaign-schedule-option-card ${
              sendImmediately ? 'option-card-selected' : ''
            }`}
          >
            <div className="campaign-schedule-option-header">
              <div className="campaign-schedule-icon-badge">
                <Send size={20} />
              </div>
              <div className="campaign-schedule-radio-outer">
                {sendImmediately && <div className="campaign-schedule-radio-inner" />}
              </div>
            </div>
            <h3 className="campaign-schedule-option-title">Send Immediately</h3>
            <p className="campaign-schedule-option-desc">
              Campaign proceeds directly toward dispatch after final review and deliverability preflight validation.
            </p>
          </div>

          {/* Option 2: Schedule for Later */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleSelectScheduled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelectScheduled();
              }
            }}
            className={`campaign-schedule-option-card ${
              !sendImmediately ? 'option-card-selected' : ''
            }`}
          >
            <div className="campaign-schedule-option-header">
              <div className="campaign-schedule-icon-badge">
                <Calendar size={20} />
              </div>
              <div className="campaign-schedule-radio-outer">
                {!sendImmediately && <div className="campaign-schedule-radio-inner" />}
              </div>
            </div>
            <h3 className="campaign-schedule-option-title">Schedule for Later</h3>
            <p className="campaign-schedule-option-desc">
              Specify a future calendar date, time, and timezone for automated background dispatch.
            </p>
          </div>
        </div>

        {/* When Scheduling is Selected: Expanded Date/Time Configuration */}
        {!sendImmediately && (
          <div className="campaign-scheduled-config-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div className="campaign-scheduled-config-header">
                <Calendar size={16} />
                <span>Configure Future Dispatch Window</span>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handlePresetTomorrow}
                  className="campaign-micro-btn campaign-micro-btn-slate"
                >
                  <Sparkles size={11} color="#2563eb" />
                  <span>Tomorrow 9:00 AM</span>
                </button>
                <button
                  type="button"
                  onClick={handlePresetNextMonday}
                  className="campaign-micro-btn campaign-micro-btn-slate"
                >
                  <Sparkles size={11} color="#2563eb" />
                  <span>Next Monday 9:30 AM</span>
                </button>
              </div>
            </div>

            <div className="campaign-scheduled-fields-grid">
              {/* Send Date Input */}
              <div className="campaign-field-group">
                <label htmlFor="scheduled-date-input" className="campaign-label">
                  Send Date <span className="campaign-label-required">*</span>
                </label>
                <div className="campaign-input-with-icon">
                  <Calendar size={15} className="campaign-input-inner-icon" />
                  <input
                    id="scheduled-date-input"
                    type="date"
                    min={todayString}
                    className="campaign-input campaign-input-icon-padded"
                    value={scheduledAtDate}
                    onChange={(e) => {
                      setScheduledAtDate(e.target.value);
                      if (clearFieldError) clearFieldError('schedule');
                    }}
                  />
                </div>
              </div>

              {/* Send Time Input */}
              <div className="campaign-field-group">
                <label htmlFor="scheduled-time-input" className="campaign-label">
                  Send Time <span className="campaign-label-required">*</span>
                </label>
                <div className="campaign-input-with-icon">
                  <Clock size={15} className="campaign-input-inner-icon" />
                  <input
                    id="scheduled-time-input"
                    type="time"
                    className="campaign-input campaign-input-icon-padded"
                    value={scheduledAtTime}
                    onChange={(e) => {
                      setScheduledAtTime(e.target.value);
                      if (clearFieldError) clearFieldError('schedule');
                    }}
                  />
                </div>
              </div>

              {/* Timezone Dropdown */}
              <div className="campaign-field-group campaign-field-full">
                <label htmlFor="scheduled-timezone-select" className="campaign-label">
                  Timezone
                </label>
                <div className="campaign-input-with-icon">
                  <Globe size={15} className="campaign-input-inner-icon" />
                  <select
                    id="scheduled-timezone-select"
                    className="campaign-select campaign-input-icon-padded"
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

            {/* Scheduled Dispatch Confirmation Helper Note */}
            <div className="campaign-schedule-info-banner">
              <CheckCircle2 size={16} className="campaign-schedule-info-icon" />
              <div>
                Outreach emails will be queued and dispatched automatically on{' '}
                <strong>{scheduledAtDate || 'selected date'}</strong> at{' '}
                <strong>{scheduledAtTime || '09:00'}</strong> ({timezoneName}).
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
