import React, { useState } from 'react';
import { ArrowLeft, Check, Edit2, X } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Content' },
  { id: 2, label: 'Choose Contacts' },
  { id: 3, label: 'Schedule' },
  { id: 4, label: 'Review' },
];

export default function CampaignWizardHeader({
  currentStep,
  campaignName,
  onNameChange,
  onStepClick,
  onBack,
  onClose,
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(campaignName || 'Untitled Campaign');

  const handleFinishEditing = () => {
    setIsEditingName(false);
    const trimmed = tempName.trim();
    if (trimmed && onNameChange) {
      onNameChange(trimmed);
    } else {
      setTempName(campaignName || 'Untitled Campaign');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleFinishEditing();
    } else if (e.key === 'Escape') {
      setTempName(campaignName || 'Untitled Campaign');
      setIsEditingName(false);
    }
  };

  return (
    <header className="campaign-wizard-header" role="banner">
      {/* 1. Left Section: Back Button */}
      <div className="campaign-header-left">
        <button
          type="button"
          onClick={onBack}
          className="campaign-header-back-btn"
          title="Back to previous step or campaigns"
        >
          <ArrowLeft size={15} />
          <span>Back</span>
        </button>
      </div>

      <div className="campaign-header-divider" />

      {/* 2. Campaign Name Section with Edit Icon */}
      <div className="campaign-header-name-section">
        {isEditingName ? (
          <input
            type="text"
            className="campaign-header-rename-input"
            value={tempName}
            autoFocus
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleFinishEditing}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div className="campaign-header-title-box">
            <span
              className="campaign-header-title-text"
              title={campaignName || 'Untitled Campaign'}
            >
              {campaignName || 'Untitled Campaign'}
            </span>
            <button
              type="button"
              onClick={() => {
                setTempName(campaignName || 'Untitled Campaign');
                setIsEditingName(true);
              }}
              className="campaign-header-rename-btn"
              title="Click to rename campaign"
              aria-label="Rename campaign"
            >
              <Edit2 size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="campaign-header-divider" />

      {/* 3. Center Section: 4-Step Progress Indicator */}
      <div className="campaign-header-center">
        <nav
          aria-label="Campaign Creation Progress"
          className="campaign-stepper-container"
        >
          {STEPS.map((step, idx) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;

            return (
              <React.Fragment key={step.id}>
                <div
                  className={`campaign-step-item ${
                    isCompleted ? 'step-completed' : isActive ? 'step-active' : 'step-upcoming'
                  }`}
                  onClick={() => {
                    if (isCompleted && onStepClick) {
                      onStepClick(step.id);
                    }
                  }}
                  style={{
                    cursor: isCompleted ? 'pointer' : 'default',
                  }}
                >
                  {/* Step Circle Indicator */}
                  <div
                    className={`campaign-step-circle ${
                      isCompleted
                        ? 'campaign-step-circle-completed'
                        : isActive
                        ? 'campaign-step-circle-active'
                        : 'campaign-step-circle-upcoming'
                    }`}
                  >
                    {isCompleted ? <Check size={13} strokeWidth={3} /> : step.id}
                  </div>

                  {/* Step Label */}
                  <span className="campaign-step-label">
                    {step.label}
                  </span>
                </div>

                {/* Connecting Line between steps */}
                {idx < STEPS.length - 1 && (
                  <div
                    className={`campaign-step-line ${
                      step.id < currentStep ? 'line-completed' : 'line-upcoming'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      <div className="campaign-header-divider" />

      {/* 4. Right Section: Close Button */}
      <div className="campaign-header-right">
        <button
          type="button"
          onClick={onClose}
          className="campaign-header-close-btn"
          title="Save and exit"
          aria-label="Close and save draft"
        >
          <X size={17} />
        </button>
      </div>
    </header>
  );
}
