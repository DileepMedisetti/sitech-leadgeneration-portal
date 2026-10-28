import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { campaignsApi, audienceApi, deliverabilityApi } from '../../services/api-client';

import { CAMPAIGN_STEPS } from './campaignConstants';
import CampaignWizardHeader from './components/CampaignWizardHeader';
import ContentStep from './components/ContentStep';
import ChooseContactsStep from './components/ChooseContactsStep';
import ScheduleStep from './components/ScheduleStep';
import PlacementAnalysisStep from './components/PlacementAnalysisStep';
import ReviewStep from './components/ReviewStep';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { getCampaignDraft, saveCampaignDraft } from './campaignDraftStore';
import { convertLocalToUtcIso, validateFutureScheduledTime } from './timezoneUtil';
import './campaigns.css';

export default function CreateCampaignPage({
  campaignId: initialCampaignId = null,
  onNavigate,
  registerNavBlocker,
  previousRoute,
}) {
  const initialDraft = getCampaignDraft();

  const [currentStep, setCurrentStep] = useState(1);
  const [campaignId, setCampaignId] = useState(initialCampaignId || initialDraft.campaignId || null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Centered Unsaved Changes Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingDestination, setPendingDestination] = useState(null);

  // Step 1: Content State (Campaign Details + Email Design)
  const [campaignName, setCampaignName] = useState(initialDraft.campaignName || 'Product Update - October 2024');
  const [subject, setSubject] = useState(initialDraft.subject || 'Exciting Updates from Sitech Series');
  const [previewText, setPreviewText] = useState(initialDraft.previewText || 'Discover new features and improvements to help you grow faster.');
  const [fromName, setFromName] = useState(initialDraft.fromName || 'Sitech Series');
  const [fromEmail, setFromEmail] = useState(initialDraft.fromEmail || 'noreply@sitechseries.com');
  const [replyTo, setReplyTo] = useState(initialDraft.replyTo || 'replies@sitechseries.com');
  const [isReplyToManuallyEdited, setIsReplyToManuallyEdited] = useState(Boolean(initialDraft.isReplyToManuallyEdited));
  const [emailAccountId, setEmailAccountId] = useState(initialDraft.emailAccountId || null);
  const [receiverName, setReceiverName] = useState(initialDraft.receiverName || 'Sitech Series');
  const [receiverEmail, setReceiverEmail] = useState(initialDraft.receiverEmail || 'replies@sitechseries.com');
  const [selectedTags, setSelectedTags] = useState(initialDraft.selectedTags || ['Product Update', 'Q4 2024']);
  const [trackingOptions, setTrackingOptions] = useState(
    initialDraft.trackingOptions || {
      track_opens: true,
      track_clicks: true,
    }
  );

  const [editorMode, setEditorMode] = useState(initialDraft.editorMode || 'template_gallery'); // 'template_gallery' | 'html_editor'
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialDraft.selectedTemplateId || null);
  const [htmlContent, setHtmlContent] = useState(initialDraft.htmlContent || '');
  const [plainText, setPlainText] = useState(initialDraft.plainText || '');

  // Step 2: Choose Contacts State
  const [availableLists, setAvailableLists] = useState([]);
  const [selectedListIds, setSelectedListIds] = useState(initialDraft.selectedListIds || []);
  const [audienceSummary, setAudienceSummary] = useState(null);
  const [loadingLists, setLoadingLists] = useState(false);

  // Step 3: Schedule State
  const [sendImmediately, setSendImmediately] = useState(
    initialDraft.sendImmediately !== undefined ? initialDraft.sendImmediately : true
  );
  const [scheduledAtDate, setScheduledAtDate] = useState(initialDraft.scheduledAtDate || '');
  const [scheduledAtTime, setScheduledAtTime] = useState(initialDraft.scheduledAtTime || '09:00');
  const [timezoneName, setTimezoneName] = useState(initialDraft.timezoneName || 'UTC');

  // Step 4 & 5: Deliverability, Placement, Preflight, and Review State
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

  // Auto-sync step 1 campaign fields to draft store
  useEffect(() => {
    saveCampaignDraft({
      campaignName,
      subject,
      previewText,
      fromName,
      fromEmail,
      replyTo,
      isReplyToManuallyEdited,
      emailAccountId,
      receiverName,
      receiverEmail,
      selectedTags,
      trackingOptions,
      htmlContent,
      selectedTemplateId,
      editorMode,
    });
  }, [
    campaignName,
    subject,
    previewText,
    fromName,
    fromEmail,
    replyTo,
    isReplyToManuallyEdited,
    emailAccountId,
    receiverName,
    receiverEmail,
    selectedTags,
    trackingOptions,
    htmlContent,
    selectedTemplateId,
    editorMode,
  ]);

  // Restore draft from backend if initialCampaignId prop is provided
  useEffect(() => {
    if (!initialCampaignId) return;

    let isMounted = true;
    setCampaignId(initialCampaignId);

    const loadDraft = async () => {
      try {
        const data = await campaignsApi.get(initialCampaignId);
        if (!isMounted || !data) return;

        if (data.name) setCampaignName(data.name);
        if (data.tags) setSelectedTags(data.tags);
        if (data.content) {
          if (data.content.subject) setSubject(data.content.subject);
          if (data.content.preview_text) setPreviewText(data.content.preview_text);
          if (data.content.from_name) setFromName(data.content.from_name);
          if (data.content.from_email) setFromEmail(data.content.from_email);
          if (data.content.reply_to) {
            setReplyTo(data.content.reply_to);
            setIsReplyToManuallyEdited(true);
          }
          if (data.content.html_content) setHtmlContent(data.content.html_content);
          if (data.content.plain_text) setPlainText(data.content.plain_text);
          if (data.content.editor_mode) setEditorMode(data.content.editor_mode);
          if (data.content.template_id) setSelectedTemplateId(data.content.template_id);
        }
        if (data.email_account_id) setEmailAccountId(data.email_account_id);
        if (data.audience_list_ids && data.audience_list_ids.length > 0) {
          setSelectedListIds(data.audience_list_ids.map(Number));
        }
        if (data.tracking_options) setTrackingOptions(data.tracking_options);
        if (data.scheduled_at) {
          setSendImmediately(false);
          const dt = new Date(data.scheduled_at);
          if (!isNaN(dt.getTime())) {
            setScheduledAtDate(dt.toISOString().split('T')[0]);
            const hh = String(dt.getUTCHours()).padStart(2, '0');
            const mm = String(dt.getUTCMinutes()).padStart(2, '0');
            setScheduledAtTime(`${hh}:${mm}`);
            setTimezoneName('UTC');
          }
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to load campaign draft for editing.');
        }
      }
    };

    loadDraft();
    return () => {
      isMounted = false;
    };
  }, [initialCampaignId]);

  // Fetch available contact lists when entering Step 2: Choose Contacts
  useEffect(() => {
    if (currentStep === 2 && availableLists.length === 0) {
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

  // Live calculation of deduplicated audience summary when selections change on Step 2
  useEffect(() => {
    if (currentStep !== 2) return;

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

  // Load preflight checks when entering Step 4 (Placement Analysis) or Step 5 (Review)
  useEffect(() => {
    if ((currentStep === 4 || currentStep === 5) && campaignId) {
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

  // Step 1 (Content) -> Step 2 (Choose Contacts)
  const handleProceedFromStep1 = async () => {
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
    if (!htmlContent || !htmlContent.trim()) {
      errors.content = 'Please select an email template or write HTML content.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
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
          reply_to: replyTo ? replyTo.trim().toLowerCase() : null,
          receiver_name: receiverName ? receiverName.trim() : null,
          receiver_email: receiverEmail ? receiverEmail.trim().toLowerCase() : null,
          html_content: htmlContent,
          plain_text: plainText.trim() || null,
          editor_mode: editorMode === 'template_gallery' ? 'template_gallery' : 'html_editor',
          template_id: editorMode === 'template_gallery' ? selectedTemplateId : null,
        },
        email_account_id: emailAccountId || undefined,
        tracking_options: trackingOptions,
      };

      let activeId = campaignId;
      if (!activeId) {
        const created = await campaignsApi.create(payload);
        activeId = created.id;
        setCampaignId(activeId);
      } else {
        await campaignsApi.update(activeId, payload);
      }

      saveCampaignDraft({
        campaignId: activeId,
        campaignName,
        subject,
        previewText,
        fromName,
        fromEmail,
        replyTo,
        isReplyToManuallyEdited,
        emailAccountId,
        receiverName,
        receiverEmail,
        selectedTags,
        htmlContent,
        plainText,
        editorMode,
        selectedTemplateId,
        trackingOptions,
        currentStep: 2,
      });

      setCurrentStep(2);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save campaign content draft.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 (Choose Contacts) -> Step 3 (Schedule)
  const handleProceedFromStep2 = async () => {
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

      saveCampaignDraft({
        selectedListIds,
        currentStep: 3,
      });

      setCurrentStep(3);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to assign audience lists.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3 (Schedule) -> Step 4 (Placement Analysis)
  const handleProceedFromStep3 = () => {
    setErrorMessage(null);
    if (!sendImmediately) {
      const scheduleValidation = validateFutureScheduledTime(scheduledAtDate, scheduledAtTime, timezoneName);
      if (!scheduleValidation.valid) {
        setFieldErrors({ schedule: scheduleValidation.error });
        return;
      }
    }

    setFieldErrors({});
    saveCampaignDraft({
      sendImmediately,
      scheduledAtDate,
      scheduledAtTime,
      timezoneName,
      currentStep: 4,
    });
    setCurrentStep(4);
  };

  // Step 4 (Placement Analysis) -> Step 5 (Review and Run)
  const handleProceedFromStep4 = async () => {
    setErrorMessage(null);
    await loadPreflightAndIntelligence();
    setCurrentStep(5);
  };

  // Deliverability Analysis On-Demand
  const handleRunDeliverabilityAnalysis = async () => {
    if (!campaignId) return;
    setLoadingAnalysis(true);
    setErrorMessage(null);
    try {
      const report = await deliverabilityApi.analyzeCampaign(campaignId);
      setDeliverabilityReport(report);
      await loadPreflightAndIntelligence();
    } catch (err) {
      setErrorMessage(err.message || 'Deliverability analysis failed.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Controlled Placement Test On-Demand
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

  // Request ML Placement Prediction On-Demand
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

  // Final Dispatch or Schedule Execution on Step 5
  const handleConfirmLaunch = async (bypassWarnings = false) => {
    if (!campaignId) return;
    setSubmitting(true);
    setErrorMessage(null);

    let scheduledUtc = null;
    if (!sendImmediately && scheduledAtDate) {
      try {
        scheduledUtc = convertLocalToUtcIso(scheduledAtDate, scheduledAtTime || '09:00', timezoneName);
      } catch (err) {
        setErrorMessage(err.message || 'Invalid scheduled date or time.');
        setSubmitting(false);
        return;
      }
    }

    try {
      await campaignsApi.launch(campaignId, {
        send_immediately: sendImmediately,
        scheduled_at: scheduledUtc,
        timezone_name: timezoneName,
        confirmed: true,
        bypass_warnings: bypassWarnings,
      });

      // Clear draft session upon verified launch/schedule
      try {
        sessionStorage.removeItem('sitech_campaign_draft_v1');
      } catch {
        // ignore
      }

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
    if (campaignId !== null && campaignId !== initialCampaignId) return true;
    if (campaignName !== (initialDraft.campaignName || 'Academic Research Symposium Outreach')) return true;
    if (subject !== (initialDraft.subject || 'Cross-Institutional Research Initiative — Faculty Collaboration')) return true;
    if (previewText !== (initialDraft.previewText || 'Reviewing joint computational research opportunities with faculty colleagues.')) return true;
    if (fromName !== (initialDraft.fromName || 'Sitech Academic Outreach')) return true;
    if (fromEmail !== (initialDraft.fromEmail || 'outreach@sitechseries.org')) return true;
    if (replyTo !== (initialDraft.replyTo || 'outreach@sitechseries.org')) return true;
    if (htmlContent.trim() !== '') return true;
    if (plainText.trim() !== '') return true;
    if (selectedListIds.length > 0) return true;
    return false;
  }, [
    currentStep,
    campaignId,
    initialCampaignId,
    campaignName,
    subject,
    previewText,
    fromName,
    fromEmail,
    replyTo,
    htmlContent,
    plainText,
    selectedListIds.length,
    initialDraft,
  ]);

  // Intercept in-app navigation if unsaved changes exist
  useEffect(() => {
    if (!registerNavBlocker) return;
    registerNavBlocker((targetTab, targetParam) => {
      if (targetTab === 'create-campaign') return false;
      const safeTab = (typeof targetTab === 'string' && targetTab.trim().length > 0) ? targetTab.trim() : 'campaigns';
      const safeParam = (typeof targetTab === 'string') ? (targetParam ?? null) : null;

      if (hasUnsavedChanges()) {
        setPendingDestination({ tab: safeTab, param: safeParam });
        setShowLeaveModal(true);
        return true;
      }
      return false;
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
    const target = pendingDestination;
    setPendingDestination(null);

    if (registerNavBlocker) {
      registerNavBlocker(null);
    }

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
        return 'Proceed to Choose Contacts';
      case 2:
        return 'Proceed to Schedule';
      case 3:
        return 'Proceed to Placement Analysis';
      case 4:
        return 'Proceed to Final Review';
      case 5:
        return sendImmediately ? 'Launch Outreach Campaign' : 'Schedule Outreach Campaign';
      default:
        return 'Next Step';
    }
  };

  return (
    <div className="campaign-create-page">
      {/* 1. Header with Breadcrumbs, Title, Subtitle, and 5-Step Stepper */}
      <CampaignWizardHeader
        currentStep={currentStep}
        onStepClick={(step) => {
          if (step <= currentStep) {
            setCurrentStep(step);
          }
        }}
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

        {/* Step 1: Content (Unified Campaign Details + Email Design) */}
        {currentStep === 1 && (
          <ContentStep
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
            isReplyToManuallyEdited={isReplyToManuallyEdited}
            setIsReplyToManuallyEdited={setIsReplyToManuallyEdited}
            emailAccountId={emailAccountId}
            setEmailAccountId={setEmailAccountId}
            receiverName={receiverName}
            setReceiverName={setReceiverName}
            receiverEmail={receiverEmail}
            setReceiverEmail={setReceiverEmail}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            htmlContent={htmlContent}
            setHtmlContent={setHtmlContent}
            plainText={plainText}
            setPlainText={setPlainText}
            editorMode={editorMode}
            setEditorMode={setEditorMode}
            trackingOptions={trackingOptions}
            setTrackingOptions={setTrackingOptions}
            fieldErrors={fieldErrors}
            clearFieldError={clearFieldError}
            onNavigate={onNavigate}
          />
        )}

        {/* Step 2: Choose Contacts */}
        {currentStep === 2 && (
          <ChooseContactsStep
            availableLists={availableLists}
            selectedListIds={selectedListIds}
            onToggleList={handleToggleList}
            onSelectAll={handleSelectAllLists}
            onClearAll={handleClearAllLists}
            audienceSummary={audienceSummary}
            loadingLists={loadingLists}
            fieldErrors={fieldErrors}
            onNavigate={onNavigate}
            onRefreshSummary={async () => {
              if (campaignId && selectedListIds.length > 0) {
                const s = await campaignsApi.selectAudience(campaignId, selectedListIds.map(Number));
                setAudienceSummary(s);
              }
            }}
          />
        )}

        {/* Step 3: Schedule */}
        {currentStep === 3 && (
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

        {/* Step 4: Placement Analysis */}
        {currentStep === 4 && (
          <PlacementAnalysisStep
            campaignId={campaignId}
            preflight={preflight}
            loadingPreflight={loadingPreflight}
            deliverabilityReport={deliverabilityReport}
            loadingAnalysis={loadingAnalysis}
            onRunDeliverabilityAnalysis={handleRunDeliverabilityAnalysis}
            mlPrediction={mlPrediction}
            loadingML={loadingML}
            onRequestMLPrediction={handleRequestMLPrediction}
            onJumpToStep={(s) => setCurrentStep(s)}
            onProceedToReview={() => setCurrentStep(5)}
          />
        )}

        {/* Step 5: Review and Run Campaign */}
        {currentStep === 5 && (
          <ReviewStep
            campaignName={campaignName}
            subject={subject}
            previewText={previewText}
            fromName={fromName}
            fromEmail={fromEmail}
            replyTo={replyTo}
            receiverName={receiverName}
            receiverEmail={receiverEmail}
            selectedTags={selectedTags}
            editorMode={editorMode}
            selectedTemplateId={selectedTemplateId}
            htmlContent={htmlContent}
            selectedListNames={selectedListNames}
            grossContacts={grossContactsCount}
            eligibleContacts={audienceSummary?.eligible_contacts ?? grossContactsCount}
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
