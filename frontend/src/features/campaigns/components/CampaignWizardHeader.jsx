import React from 'react';
import { Check } from 'lucide-react';

const HEADER_STEPS = [
  { id: 1, label: 'Content', targetStep: 1 },
  { id: 2, label: 'Audience', targetStep: 2 },
  { id: 3, label: 'Settings', targetStep: 3 },
  { id: 4, label: 'Review & Send', targetStep: 5 },
];

export default function CampaignWizardHeader({
  currentStep = 1,
  onStepClick,
  onBackToCampaigns,
  campaignName = '',
}) {
  // Map 5 internal steps to 4 displayed header steps:
  // 1 -> 1 (Content)
  // 2 -> 2 (Audience)
  // 3, 4 -> 3 (Settings)
  // 5 -> 4 (Review & Send)
  const activeHeaderStep =
    currentStep === 1 ? 1 : currentStep === 2 ? 2 : currentStep <= 4 ? 3 : 4;

  const handleBackToCampaignsClick = (event) => {
    event?.preventDefault?.();
    onBackToCampaigns?.();
  };

  const handleHeaderStepClick = (step) => {
    if (step.id < activeHeaderStep && typeof onStepClick === 'function') {
      onStepClick(step.targetStep);
    }
  };

  return (
    <header className="campaign-wizard-top">
      {/* Top Navigation Row: Back Link | Breadcrumb */}
      <div className="campaign-top-nav-bar">
        <button
          type="button"
          onClick={handleBackToCampaignsClick}
          className="campaign-nav-back-button"
          title="Return to campaigns list"
        >
          <span className="campaign-back-arrow" aria-hidden="true">&lsaquo;</span>
          <span>Back to Campaigns</span>
        </button>

        <span className="campaign-nav-pipe" aria-hidden="true">|</span>

        <nav aria-label="Breadcrumb" className="campaign-top-breadcrumb">
          <button
            type="button"
            onClick={handleBackToCampaignsClick}
            className="campaign-breadcrumb-link"
          >
            Campaigns
          </button>
          <span className="campaign-breadcrumb-chevron" aria-hidden="true">&rsaquo;</span>
          <span className="campaign-breadcrumb-current" aria-current="page">
            Create Campaign
          </span>
          {campaignName?.trim() && (
            <>
              <span className="campaign-breadcrumb-dot" aria-hidden="true">·</span>
              <span className="campaign-breadcrumb-draft" title={campaignName}>
                {campaignName.trim()}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Main Title Row with Inline 4-Step Stepper */}
      <div className="campaign-title-stepper-row">
        <div className="campaign-title-col">
          <h1 className="campaign-page-title">Create Email Campaign</h1>
          <p className="campaign-page-subtitle">
            Configure your campaign details and design your email content.
          </p>
        </div>

        {/* 4-Step Progress Indicator Matching Approved Reference */}
        <nav aria-label="Campaign creation progress" className="campaign-inline-stepper">
          {HEADER_STEPS.map((step, index) => {
            const isActive = step.id === activeHeaderStep;
            const isCompleted = step.id < activeHeaderStep;
            const canNavigate = isCompleted && typeof onStepClick === 'function';

            return (
              <React.Fragment key={step.id}>
                <div
                  className={`campaign-inline-step ${isActive ? 'step-active' : isCompleted ? 'step-completed' : 'step-upcoming'}`}
                  role={canNavigate ? 'button' : undefined}
                  tabIndex={canNavigate ? 0 : undefined}
                  onClick={() => handleHeaderStepClick(step)}
                  onKeyDown={(e) => {
                    if (canNavigate && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleHeaderStepClick(step);
                    }
                  }}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${step.id}: ${step.label}${isActive ? ', current step' : isCompleted ? ', completed' : ''}`}
                  title={canNavigate ? `Go back to ${step.label}` : step.label}
                >
                  <div
                    className={`campaign-step-num-circle ${isActive ? 'circle-active' : isCompleted ? 'circle-completed' : 'circle-upcoming'}`}
                    aria-hidden="true"
                  >
                    {isCompleted ? <Check size={14} strokeWidth={2.5} /> : step.id}
                  </div>
                  <span className={`campaign-step-name ${isActive ? 'name-active' : isCompleted ? 'name-completed' : 'name-upcoming'}`}>
                    {step.label}
                  </span>
                </div>

                {index < HEADER_STEPS.length - 1 && (
                  <div
                    className={`campaign-step-divider-line ${isCompleted ? 'line-completed' : 'line-upcoming'}`}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
