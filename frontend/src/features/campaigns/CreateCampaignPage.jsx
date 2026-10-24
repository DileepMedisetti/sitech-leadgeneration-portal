import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { campaignsApi, audienceApi, deliverabilityApi } from '../../services/api-client';

import { CAMPAIGN_STEPS } from './campaignConstants';
import CampaignWizardHeader from './components/CampaignWizardHeader';
import CampaignDetailsStep from './components/CampaignDetailsStep';
import EmailDesignStep from './components/EmailDesignStep';
import ChooseContactsStep from './components/ChooseContactsStep';
import ScheduleStep from './components/ScheduleStep';
import ReviewStep from './components/ReviewStep';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import './campaigns.css';

export default function CreateCampaignPage({ onNavigate, registerNavBlocker, previousRoute }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [campaignId, setCampaignId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Centered Unsaved Changes Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingDestination, setPendingDestination] = useState(null);

  // Step 1: Campaign Details State
  const [campaignName, setCampaignName] = useState('Academic Research Symposium Outreach');
  const [subject, setSubject] = useState('Cross-Institutional Research Initiative — Faculty Collaboration');
  const [previewText, setPreviewText] = useState('Reviewing joint computational research opportunities with faculty colleagues.');
  const [fromName, setFromName] = useState('Sitech Academic Outreach');
  const [fromEmail, setFromEmail] = useState('outreach@sitechseries.org');
  const [replyTo, setReplyTo] = useState('outreach@sitechseries.org');
  const [selectedTags, setSelectedTags] = useState(['Faculty Outreach']);
  const [trackingOptions, setTrackingOptions] = useState({
    track_opens: true,
    track_clicks: true,
  });

  // Step 2: Email Design State
  const [editorMode, setEditorMode] = useState('template_gallery'); // 'template_gallery' | 'html_editor'
  const [selectedTemplateId, setSelectedTemplateId] = useState('research_collab');
  const [htmlContent, setHtmlContent] = useState('');
  const [plainText, setPlainText] = useState('');

  // Step 3: Audience State
  const [availableLists, setAvailableLists] = useState([]);
  const [selectedListIds, setSelectedListIds] = useState([]);
  const [audienceSummary, setAudienceSummary] = useState(null);
  const [loadingLists, setLoadingLists] = useState(false);

  // Step 4: Schedule State
  const [sendImmediately, setSendImmediately] = useState(true);
  const [scheduledAtDate, setScheduledAtDate] = useState('');
  const [scheduledAtTime, setScheduledAtTime] = useState('09:00');
  const [timezoneName, setTimezoneName] = useState('UTC');

  // Step 5: Deliverability & Review State
  const [deliverabilityReport, setDeliverabilityReport] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [placementTest, setPlacementTest] = useState(null);
  const [loadingPlacement, setLoadingPlacement] = useState(false);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [loadingML, setLoadingML] = useState(false);
  const [preflight, setPreflight] = useState(null);
  const [loadingPreflight, setLoadingPreflight] = useState(false);

  const clearFieldError = (fieldName) => {
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  };

  // Fetch available contact lists when entering Step 3
  useEffect(() => {
    if (currentStep === 3 && availableLists.length === 0) {
      setLoadingLists(true);
      audienceApi
        .getLists({ page: 1, page_size: 100 })
        .then((res) => {
          const items = res.items || [];
          setAvailableLists(items);
          if (items.length > 0 && selectedListIds.length === 0) {
            setSelectedListIds([Number(items[0].id)]);
          }
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Failed to load contact lists.');
        })
        .finally(() => setLoadingLists(false));
    }
  }, [currentStep, availableLists.length, selectedListIds.length]);

  // Live calculation of deduplicated audience summary when selections change on Step 3
  useEffect(() => {
    if (currentStep !== 3) return;

    if (selectedListIds.length === 0) {
      setAudienceSummary(null);
      return;
    }

    if (!campaignId) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const numericIds = selectedListIds.map(Number);
        const summary = await campaignsApi.selectAudience(campaignId, numericIds);
        if (!cancelled) {
          setAudienceSummary(summary);
        }
      } catch (err) {
        console.error('Failed to update live recipient estimate:', err);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentStep, campaignId, selectedListIds]);

  const loadPreflightAndIntelligence = useCallback(async () => {
    if (!campaignId) return;
    setLoadingPreflight(true);
    try {
      const pf = await campaignsApi.getPreflight(campaignId);
      setPreflight(pf);
      if (pf.deliverability_report) setDeliverabilityReport(pf.deliverability_report);
      if (pf.placement_test) setPlacementTest(pf.placement_test);
      if (pf.ml_prediction) setMlPrediction(pf.ml_prediction);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreflight(false);
    }
  }, [campaignId]);

  // Load preflight checks when reaching Step 5
  useEffect(() => {
    if (currentStep === 5 && campaignId) {
      loadPreflightAndIntelligence();
    }
  }, [currentStep, campaignId, loadPreflightAndIntelligence]);

  // Selection handlers matching choose-contacts.test.js specifications
  const handleToggleList = (id) => {
    const targetId = Number(id);
    setSelectedListIds((prev) => {
      const numericPrev = prev.map(Number);
      if (numericPrev.includes(targetId)) {
        return numericPrev.filter((item) => item !== targetId);
      } else {
        return [...numericPrev, targetId];
      }
    });
    clearFieldError('audience');
  };

  const handleSelectAllLists = (listsToSelect) => {
    if (Array.isArray(listsToSelect) && listsToSelect.length > 0) {
      setSelectedListIds((prev) => {
        const set = new Set(prev.map(Number));
        listsToSelect.forEach((l) => {
          const id = Number(l && typeof l === 'object' && l.id !== undefined ? l.id : l);
          if (!isNaN(id)) set.add(id);
        });
        return Array.from(set);
      });
    } else {
      setSelectedListIds(availableLists.map((l) => Number(l.id)));
    }
    clearFieldError('audience');
  };

  const handleClearAllLists = () => {
    setSelectedListIds([]);
    setAudienceSummary(null);
  };

  // Step 1 -> Step 2 validation
  const handleProceedFromStep1 = () => {
    setErrorMessage(null);
    const errors = {};

    if (!campaignName.trim()) {
      errors.name = 'Campaign name is required.';
    }
    if (!subject.trim()) {
      errors.subject = 'Email subject line is required.';
    }
    if (!fromName.trim()) {
      errors.fromName = 'Sender display name is required.';
    }
    if (!fromEmail.trim()) {
      errors.fromEmail = 'Sender email address is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setCurrentStep(2);
  };

  // Step 2 -> Step 3: Save campaign draft & content snapshot
  const handleProceedFromStep2 = async () => {
    setErrorMessage(null);
    if (!htmlContent || !htmlContent.trim()) {
      setFieldErrors({ content: 'Please select an email template or write HTML content.' });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload = {
        name: campaignName.trim(),
        tags: selectedTags,
        content: {
          subject: subject.trim(),
          preview_text: previewText.trim() || null,
          from_name: fromName.trim(),
          from_email: fromEmail.trim().toLowerCase(),
          reply_to: replyTo.trim().toLowerCase() || null,
          html_content: htmlContent,
          plain_text: plainText.trim() || null,
          editor_mode: editorMode === 'template_gallery' ? 'template_gallery' : 'html_editor',
          template_id: editorMode === 'template_gallery' ? selectedTemplateId : null,
        },
      };

      if (!campaignId) {
        const created = await campaignsApi.create(payload);
        setCampaignId(created.id);
      } else {
        await campaignsApi.update(campaignId, payload);
      }
      setCurrentStep(3);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save campaign content draft.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3 -> Step 4: Save audience selection & snapshot
  const handleProceedFromStep3 = async () => {
    setErrorMessage(null);
    if (selectedListIds.length === 0) {
      setFieldErrors({ audience: 'Please select at least one contact list to receive this outreach.' });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const summary = await campaignsApi.selectAudience(campaignId, selectedListIds.map(Number));
      setAudienceSummary(summary);
      if (summary.eligible_contacts === 0) {
        setErrorMessage(
          'The selected lists contain 0 eligible contacts. Select at least one list with verified, qualified contacts.'
        );
        setSubmitting(false);
        return;
      }
      setCurrentStep(4);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to assign audience lists.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 4 -> Step 5: Validate schedule
  const handleProceedFromStep4 = () => {
    setErrorMessage(null);
    if (!sendImmediately) {
      if (!scheduledAtDate) {
        setFieldErrors({ schedule: 'Please select a scheduled send date.' });
        return;
      }
      const combined = new Date(`${scheduledAtDate}T${scheduledAtTime || '00:00'}:00Z`);
      if (combined <= new Date()) {
        setFieldErrors({ schedule: 'Scheduled date and time must be set in the future.' });
        return;
      }
    }
    setFieldErrors({});
    setCurrentStep(5);
  };

  // Step 5 Actions: Deliverability Analysis On-Demand
  const handleRunDeliverabilityAnalysis = async () => {
    if (!campaignId) return;
    setLoadingAnalysis(true);
    setErrorMessage(null);
    try {
      const report = await deliverabilityApi.analyzeCampaign(campaignId);
      setDeliverabilityReport(report);
      await loadPreflightAndIntelligence();
    } catch (err) {
      setErrorMessage(err.message || 'Analysis failed.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Step 5 Actions: Controlled Placement Test On-Demand
  const handleRunPlacementTest = async () => {
    if (!campaignId) return;
    setLoadingPlacement(true);
    setErrorMessage(null);
    try {
      const result = await deliverabilityApi.runPlacementTest(campaignId, {
        notes: 'Pre-launch controlled seedbox verification',
      });
      setPlacementTest(result);
      await loadPreflightAndIntelligence();
    } catch (err) {
      setErrorMessage(err.message || 'Placement test failed.');
    } finally {
      setLoadingPlacement(false);
    }
  };

  // Step 5 Actions: Request ML Placement Prediction On-Demand
  const handleRequestMLPrediction = async () => {
    if (!campaignId) return;
    setLoadingML(true);
    setErrorMessage(null);
    try {
      const pred = await deliverabilityApi.getMLPrediction(campaignId);
      setMlPrediction(pred);
    } catch (err) {
      setErrorMessage(err.message || 'ML prediction request failed.');
    } finally {
      setLoadingML(false);
    }
  };

  // Final Dispatch or Schedule Execution
  const handleConfirmLaunch = async () => {
    if (!campaignId) return;
    setSubmitting(true);
    setErrorMessage(null);

    let scheduledUtc = null;
    if (!sendImmediately && scheduledAtDate) {
      scheduledUtc = new Date(`${scheduledAtDate}T${scheduledAtTime || '09:00'}:00Z`).toISOString();
    }

    try {
      await campaignsApi.launch(campaignId, {
        send_immediately: sendImmediately,
        scheduled_at: scheduledUtc,
        timezone_name: timezoneName,
        confirmed: true,
      });
      onNavigate('campaigns');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to dispatch campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  // Evaluate whether form has modified unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (currentStep > 1) return true;
    if (campaignId !== null) return true;
    if (campaignName !== 'Academic Research Symposium Outreach') return true;
    if (subject !== 'Cross-Institutional Research Initiative — Faculty Collaboration') return true;
    if (previewText !== 'Reviewing joint computational research opportunities with faculty colleagues.') return true;
    if (fromName !== 'Sitech Academic Outreach') return true;
    if (fromEmail !== 'outreach@sitechseries.org') return true;
    if (replyTo !== 'outreach@sitechseries.org') return true;
    if (htmlContent.trim() !== '') return true;
    if (plainText.trim() !== '') return true;
    if (selectedListIds.length > 0) return true;
    return false;
  }, [
    currentStep,
    campaignId,
    campaignName,
    subject,
    previewText,
    fromName,
    fromEmail,
    replyTo,
    htmlContent,
    plainText,
    selectedListIds.length,
  ]);

  // Intercept in-app navigation (sidebar, header, etc.) if unsaved changes exist
  useEffect(() => {
    if (!registerNavBlocker) return;
    registerNavBlocker((targetTab, targetParam) => {
      if (targetTab === 'create-campaign') return false;
      const safeTab = (typeof targetTab === 'string' && targetTab.trim().length > 0) ? targetTab.trim() : 'campaigns';
      const safeParam = (typeof targetTab === 'string') ? (targetParam ?? null) : null;

      if (hasUnsavedChanges()) {
        setPendingDestination({ tab: safeTab, param: safeParam });
        setShowLeaveModal(true);
        return true; // Block immediate navigation
      }
      return false; // Proceed directly
    });
    return () => registerNavBlocker(null);
  }, [registerNavBlocker, hasUnsavedChanges]);

  // Standard browser unload warning for tab reload / close
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      const fallbackTab =
        previousRoute &&
        typeof previousRoute.tab === 'string' &&
        previousRoute.tab !== 'create-campaign'
          ? previousRoute.tab
          : 'campaigns';
      const fallbackParam =
        previousRoute &&
        typeof previousRoute.tab === 'string' &&
        previousRoute.tab !== 'create-campaign'
          ? previousRoute.param ?? null
          : null;
      handleExitToCampaigns(fallbackTab, fallbackParam);
    }
  };

  const handleExitToCampaigns = (targetDestination = 'campaigns', targetParam = null) => {
    // Strictly sanitize destination: ensure valid route string, reject event objects
    const isValidString = typeof targetDestination === 'string' && targetDestination.trim().length > 0;
    const resolvedTab = isValidString ? targetDestination.trim() : 'campaigns';
    const resolvedParam = isValidString ? (targetParam ?? null) : null;

    if (hasUnsavedChanges()) {
      setPendingDestination({ tab: resolvedTab, param: resolvedParam });
      setShowLeaveModal(true);
    } else {
      onNavigate(resolvedTab, resolvedParam);
    }
  };

  const handleConfirmLeave = () => {
    setShowLeaveModal(false);

    // Retrieve pending destination and clear pending state
    const target = pendingDestination;
    setPendingDestination(null);

    // Unregister navigation blocker so it does not block the confirmed departure
    if (registerNavBlocker) {
      registerNavBlocker(null);
    }

    // Determine final destination:
    // 1) Explicit pendingDestination intercepted by blocker or exit action
    // 2) Previous valid in-app route if known (and not self)
    // 3) 'campaigns' as default fallback
    let destinationTab = 'campaigns';
    let destinationParam = null;

    if (target && typeof target.tab === 'string' && target.tab.trim().length > 0) {
      destinationTab = target.tab.trim();
      destinationParam = target.param ?? null;
    } else if (
      previousRoute &&
      typeof previousRoute.tab === 'string' &&
      previousRoute.tab.trim().length > 0 &&
      previousRoute.tab !== 'create-campaign'
    ) {
      destinationTab = previousRoute.tab.trim();
      destinationParam = previousRoute.param ?? null;
    }

    onNavigate(destinationTab, destinationParam, false, true);
  };

  const handleCancelLeave = () => {
    setShowLeaveModal(false);
    setPendingDestination(null);
  };

  const selectedListNames = availableLists
    .filter((l) => selectedListIds.includes(Number(l.id)))
    .map((l) => l.name);

  const grossContactsCount = availableLists
    .filter((l) => selectedListIds.includes(Number(l.id)))
    .reduce((sum, l) => sum + (Number(l.contact_count) || 0), 0);

  const getNextButtonLabel = () => {
    if (submitting) return 'Saving...';
    switch (currentStep) {
      case 1:
        return 'Continue to Email Design';
      case 2:
        return 'Continue to Audience';
      case 3:
        return 'Continue to Schedule';
      case 4:
        return 'Continue to Review';
      default:
        return 'Save & Continue';
    }
  };

  return (
    <div className="campaign-create-page">
      {/* 1. Header with Breadcrumbs, Title, Subtitle, and 5-Step Stepper */}
      <CampaignWizardHeader
        currentStep={currentStep}
        onStepClick={(step) => setCurrentStep(step)}
        onBackToCampaigns={() => handleExitToCampaigns('campaigns')}
        campaignName={campaignName}
      />

      {/* 2. Main Step Content Area */}
      <main className="campaign-create-main">
        {/* Top-Level Error Alert Banner */}
        {errorMessage && (
          <div className="campaign-inline-alert-banner campaign-inline-alert-danger" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#991b1b',
                fontWeight: 700,
                fontSize: '18px',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Step 1: Campaign Details */}
        {currentStep === 1 && (
          <CampaignDetailsStep
            campaignName={campaignName}
            setCampaignName={setCampaignName}
            subject={subject}
            setSubject={setSubject}
            previewText={previewText}
            setPreviewText={setPreviewText}
            fromName={fromName}
            setFromName={setFromName}
            fromEmail={fromEmail}
            setFromEmail={setFromEmail}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            trackingOptions={trackingOptions}
            setTrackingOptions={setTrackingOptions}
            fieldErrors={fieldErrors}
            clearFieldError={clearFieldError}
            onNavigate={onNavigate}
          />
        )}

        {/* Step 2: Email Design */}
        {currentStep === 2 && (
          <EmailDesignStep
            editorMode={editorMode}
            setEditorMode={setEditorMode}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            htmlContent={htmlContent}
            setHtmlContent={setHtmlContent}
            plainText={plainText}
            setPlainText={setPlainText}
            subject={subject}
            setSubject={setSubject}
            previewText={previewText}
            setPreviewText={setPreviewText}
            fromName={fromName}
            fromEmail={fromEmail}
            fieldErrors={fieldErrors}
            clearFieldError={clearFieldError}
            onNavigate={onNavigate}
          />
        )}

        {/* Step 3: Audience */}
        {currentStep === 3 && (
          <ChooseContactsStep
            availableLists={availableLists}
            selectedListIds={selectedListIds}
            onToggleList={handleToggleList}
            onSelectAll={handleSelectAllLists}
            onClearAll={handleClearAllLists}
            audienceSummary={audienceSummary}
            loadingLists={loadingLists}
            fieldErrors={fieldErrors}
            onRefreshSummary={async () => {
              if (campaignId && selectedListIds.length > 0) {
                const s = await campaignsApi.selectAudience(campaignId, selectedListIds.map(Number));
                setAudienceSummary(s);
              }
            }}
          />
        )}

        {/* Step 4: Schedule */}
        {currentStep === 4 && (
          <ScheduleStep
            sendImmediately={sendImmediately}
            setSendImmediately={setSendImmediately}
            scheduledAtDate={scheduledAtDate}
            setScheduledAtDate={setScheduledAtDate}
            scheduledAtTime={scheduledAtTime}
            setScheduledAtTime={setScheduledAtTime}
            timezoneName={timezoneName}
            setTimezoneName={setTimezoneName}
            fieldErrors={fieldErrors}
            clearFieldError={clearFieldError}
            onNavigate={onNavigate}
          />
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <ReviewStep
            campaignName={campaignName}
            subject={subject}
            previewText={previewText}
            fromName={fromName}
            fromEmail={fromEmail}
            replyTo={replyTo}
            selectedTags={selectedTags}
            editorMode={editorMode}
            selectedTemplateId={selectedTemplateId}
            htmlContent={htmlContent}
            selectedListNames={selectedListNames}
            grossContacts={grossContactsCount}
            eligibleContacts={audienceSummary?.eligible_contacts || grossContactsCount}
            sendImmediately={sendImmediately}
            scheduledAtDate={scheduledAtDate}
            scheduledAtTime={scheduledAtTime}
            timezoneName={timezoneName}
            trackingOptions={trackingOptions}
            deliverabilityReport={deliverabilityReport}
            loadingAnalysis={loadingAnalysis}
            onRunDeliverabilityAnalysis={handleRunDeliverabilityAnalysis}
            placementTest={placementTest}
            loadingPlacement={loadingPlacement}
            onRunPlacementTest={handleRunPlacementTest}
            mlPrediction={mlPrediction}
            loadingML={loadingML}
            onRequestMLPrediction={handleRequestMLPrediction}
            preflight={preflight}
            loadingPreflight={loadingPreflight}
            onJumpToStep={(s) => setCurrentStep(s)}
            onLaunch={handleConfirmLaunch}
            submitting={submitting}
          />
        )}

        {/* 3. Wizard Step Navigation Footer (Steps 1, 2, 3, 4) */}
        {currentStep < 5 && (
          <div className="campaign-wizard-footer">
            <button
              type="button"
              onClick={handleBack}
              className="campaign-action-btn-secondary"
            >
              <ArrowLeft size={15} />
              <span>{currentStep === 1 ? 'Cancel & Return' : 'Previous Step'}</span>
            </button>

            <span className="campaign-footer-step-counter">
              Step {currentStep} of {CAMPAIGN_STEPS.length} · {CAMPAIGN_STEPS[currentStep - 1]?.label}
            </span>

            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                if (currentStep === 1) handleProceedFromStep1();
                else if (currentStep === 2) handleProceedFromStep2();
                else if (currentStep === 3) handleProceedFromStep3();
                else if (currentStep === 4) handleProceedFromStep4();
              }}
              className="campaign-action-btn-primary"
            >
              <span>{getNextButtonLabel()}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </main>

      {/* Centered Unsaved Changes Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLeaveModal}
        type="warning"
        title="Leave campaign creation?"
        message="Any unsaved changes may be lost. Are you sure you want to leave this page?"
        cancelLabel="Stay on Page"
        confirmLabel="Discard Changes & Leave"
        confirmVariant="danger"
        autoFocus="cancel"
        onCancel={handleCancelLeave}
        onConfirm={handleConfirmLeave}
        onClose={handleCancelLeave}
      />
    </div>
  );
}
