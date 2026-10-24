import React from 'react';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import { CAMPAIGN_STEPS } from '../campaignConstants';

export default function CampaignWizardHeader({
  currentStep = 1,
  onStepClick,
  onBackToCampaigns,
  campaignName = '',
}) {
  const currentStepObj = CAMPAIGN_STEPS.find((s) => s.id === currentStep) || CAMPAIGN_STEPS[0];
  const progressPercent = Math.round(((currentStep - 1) / (CAMPAIGN_STEPS.length - 1)) * 100);

  const handleBackToCampaignsClick = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof onBackToCampaigns === 'function') {
      onBackToCampaigns();
    }
  };

  return (
    <div className="campaign-wizard-top">
      {/* 1. Breadcrumbs and Page-Level Back Navigation */}
      <div className="campaign-top-bar">
        <nav aria-label="Breadcrumb" className="campaign-breadcrumb">
          <button
            type="button"
            onClick={handleBackToCampaignsClick}
            className="campaign-breadcrumb-link"
          >
            Campaigns
          </button>
          <ChevronRight size={14} className="campaign-breadcrumb-separator" />
          <span className="campaign-breadcrumb-current" aria-current="page">
            Create Campaign
          </span>
          {campaignName && campaignName.trim() && (
            <>
              <span className="campaign-breadcrumb-dot">·</span>
              <span className="campaign-breadcrumb-draft" title={campaignName}>
                {campaignName}
              </span>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={handleBackToCampaignsClick}
          className="campaign-back-btn"
          title="Return to campaigns list"
        >
          <ArrowLeft size={14} />
          <span>Back to Campaigns</span>
        </button>
      </div>

      {/* 2. Header Title and Descriptive Subtitle */}
      <div className="campaign-page-title-block">
        <h1 className="campaign-page-title">Create Email Campaign</h1>
        <p className="campaign-page-subtitle">
          Configure sender identities, design responsive templates, select targeted audience lists, and verify deliverability before launch.
        </p>
      </div>

      {/* 3. Horizontal Stepper Container */}
      <div className="campaign-stepper-wrapper">
        {/* Desktop Stepper */}
        <nav aria-label="Campaign Creation Progress" className="campaign-stepper-desktop">
          {CAMPAIGN_STEPS.map((step, idx) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;
            const canNavigate = isCompleted && onStepClick;

            return (
              <React.Fragment key={step.id}>
                <div
                  role={canNavigate ? 'button' : undefined}
                  tabIndex={canNavigate ? 0 : undefined}
                  onClick={() => {
                    if (canNavigate) onStepClick(step.id);
                  }}
                  onKeyDown={(e) => {
                    if (canNavigate && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onStepClick(step.id);
                    }
                  }}
                  className={`campaign-step-node ${
                    isCompleted
                      ? 'step-completed'
                      : isActive
                      ? 'step-active'
                      : 'step-upcoming'
                  }`}
                  title={
                    canNavigate
                      ? `Click to return to Step ${step.id}: ${step.label}`
                      : isActive
                      ? `Current Step: ${step.label}`
                      : `Step ${step.id}: ${step.label}`
                  }
                >
                  {/* Step Indicator Circle */}
                  <div
                    className={`campaign-step-badge ${
                      isCompleted
                        ? 'badge-completed'
                        : isActive
                        ? 'badge-active'
                        : 'badge-upcoming'
                    }`}
                  >
                    {isCompleted ? (
                      <Check size={13} strokeWidth={2.75} aria-hidden="true" />
                    ) : (
                      <span>{step.id}</span>
                    )}
                  </div>

                  {/* Step Labels */}
                  <div className="campaign-step-text-col">
                    <span className="campaign-step-title">{step.label}</span>
                    <span className="campaign-step-desc">{step.desc}</span>
                  </div>
                </div>

                {/* Connecting Line between steps */}
                {idx < CAMPAIGN_STEPS.length - 1 && (
                  <div
                    className={`campaign-step-track ${
                      step.id < currentStep ? 'track-completed' : 'track-upcoming'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Compact Mobile / Tablet Stepper */}
        <div className="campaign-stepper-mobile">
          <div className="campaign-stepper-mobile-info">
            <span className="campaign-mobile-step-number">
              Step {currentStep} of {CAMPAIGN_STEPS.length}
            </span>
            <span className="campaign-mobile-step-name">
              {currentStepObj.label}
            </span>
          </div>

          <div
            className="campaign-mobile-progress-track"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="campaign-mobile-progress-fill"
              style={{ width: `${Math.max(12, progressPercent)}%` }}
            />
          </div>

          {/* Quick step navigation pills for mobile */}
          <div className="campaign-mobile-step-pills">
            {CAMPAIGN_STEPS.map((s) => {
              const isPast = s.id < currentStep;
              const isCurr = s.id === currentStep;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!isPast}
                  onClick={() => isPast && onStepClick && onStepClick(s.id)}
                  className={`campaign-mobile-pill ${
                    isPast ? 'pill-past' : isCurr ? 'pill-current' : 'pill-future'
                  }`}
                  aria-label={`Step ${s.id}: ${s.shortLabel}`}
                >
                  {isPast ? <Check size={11} strokeWidth={3} /> : s.id}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
