import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Send,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { campaignsApi, audienceApi, deliverabilityApi } from '../../services/api-client';

import CampaignWizardHeader from './components/CampaignWizardHeader';
import ContentStep from './components/ContentStep';
import ChooseContactsStep from './components/ChooseContactsStep';
import ScheduleStep from './components/ScheduleStep';
import ReviewStep from './components/ReviewStep';
import TemplateSelectionModal from './components/TemplateSelectionModal';
import HtmlEditorModal from './components/HtmlEditorModal';
import './campaigns.css';

export default function CreateCampaignPage({ onNavigate }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [campaignId, setCampaignId] = useState(null);
  const [campaignName, setCampaignName] = useState('Academic Research Symposium Outreach');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showHtmlEditorModal, setShowHtmlEditorModal] = useState(false);

  // Step 1: Content State
  const [subject, setSubject] = useState('Cross-Institutional Research Initiative — Faculty Collaboration');
  const [previewText, setPreviewText] = useState('Reviewing joint computational research opportunities with faculty colleagues.');
  const [fromName, setFromName] = useState('Sitech Academic Outreach');
  const [fromEmail, setFromEmail] = useState('outreach@sitechseries.org');
  const [replyTo, setReplyTo] = useState('outreach@sitechseries.org');
  const [selectedTags, setSelectedTags] = useState(['Faculty Outreach']);
  const [htmlContent, setHtmlContent] = useState('');
  const [plainText, setPlainText] = useState('');
  const [trackingOptions, setTrackingOptions] = useState({
    track_opens: true,
    track_clicks: true,
  });

  // Step 2: Contacts State
  const [availableLists, setAvailableLists] = useState([]);
  const [selectedListIds, setSelectedListIds] = useState([]);
  const [audienceSummary, setAudienceSummary] = useState(null);
  const [loadingLists, setLoadingLists] = useState(false);

  // Step 3: Schedule State
  const [sendImmediately, setSendImmediately] = useState(true);
  const [scheduledAtDate, setScheduledAtDate] = useState('');
  const [scheduledAtTime, setScheduledAtTime] = useState('09:00');
  const [timezoneName, setTimezoneName] = useState('UTC');

  // Step 4: Deliverability & Review State
  const [deliverabilityReport, setDeliverabilityReport] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [placementTest, setPlacementTest] = useState(null);
  const [loadingPlacement, setLoadingPlacement] = useState(false);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [loadingML, setLoadingML] = useState(false);
  const [preflight, setPreflight] = useState(null);
  const [loadingPreflight, setLoadingPreflight] = useState(false);

  // Fetch available contact lists when entering Step 2
  useEffect(() => {
    if (currentStep === 2 && availableLists.length === 0) {
      setLoadingLists(true);
      audienceApi
        .getLists({ page: 1, page_size: 100 })
        .then((res) => {
          const items = res.items || [];
          setAvailableLists(items);
          if (items.length > 0 && selectedListIds.length === 0) {
            // Auto-select first list if none selected on initial load
            setSelectedListIds([Number(items[0].id)]);
          }
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Failed to load contact lists.');
        })
        .finally(() => setLoadingLists(false));
    }
  }, [currentStep, availableLists.length]);

  // Live calculation of authoritative deduplicated audience summary when selections change
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

  // Load preflight checks when reaching Step 4
  useEffect(() => {
    if (currentStep === 4 && campaignId) {
      loadPreflightAndIntelligence();
    }
  }, [currentStep, campaignId]);

  const loadPreflightAndIntelligence = async () => {
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
  };

  const handleApplyTemplate = (tmpl) => {
    setSubject(tmpl.subject);
    setPreviewText(tmpl.preview_text);
    setHtmlContent(tmpl.html_content);
    setPlainText(tmpl.plain_text);
  };

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
  };

  const handleClearAllLists = () => {
    setSelectedListIds([]);
    setAudienceSummary(null);
  };

  // Step 1 -> Step 2: Save campaign draft & content snapshot
  const handleProceedFromStep1 = async () => {
    setErrorMessage(null);
    if (!campaignName.trim()) {
      setErrorMessage('Please enter a campaign name in the header.');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Please enter an email subject line.');
      return;
    }
    if (!fromEmail.trim()) {
      setErrorMessage('Please enter a sender email address.');
      return;
    }
    if (!htmlContent.trim()) {
      setErrorMessage('Please add email content or choose a template.');
      return;
    }

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
          editor_mode: 'html_editor',
        },
      };

      if (!campaignId) {
        const created = await campaignsApi.create(payload);
        setCampaignId(created.id);
      } else {
        await campaignsApi.update(campaignId, payload);
      }
      setCurrentStep(2);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save campaign draft.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 -> Step 3: Save audience selection & snapshot
  const handleProceedFromStep2 = async () => {
    setErrorMessage(null);
    if (selectedListIds.length === 0) {
      setErrorMessage('Please select at least one contact list.');
      return;
    }

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
      setCurrentStep(3);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to assign audience lists.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3 -> Step 4: Validate schedule & review
  const handleProceedFromStep3 = () => {
    setErrorMessage(null);
    if (!sendImmediately) {
      if (!scheduledAtDate) {
        setErrorMessage('Please select a scheduled send date.');
        return;
      }
      const combined = new Date(`${scheduledAtDate}T${scheduledAtTime || '00:00'}:00Z`);
      if (combined <= new Date()) {
        setErrorMessage('Scheduled date and time must be in the future.');
        return;
      }
    }
    setCurrentStep(4);
  };

  // Step 4 Actions: Deliverability Analysis On-Demand
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

  // Step 4 Actions: Controlled Placement Test On-Demand
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

  // Step 4 Actions: Request ML Placement Prediction On-Demand
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

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      if (window.confirm('Leave campaign creation? Your draft changes may be lost.')) {
        onNavigate('campaigns');
      }
    }
  };

  const handleClose = () => {
    if (window.confirm('Exit campaign creation? Your draft will be saved.')) {
      onNavigate('campaigns');
    }
  };

  const selectedListNames = availableLists
    .filter((l) => selectedListIds.includes(l.id))
    .map((l) => l.name);

  const grossContactsCount = availableLists
    .filter((l) => selectedListIds.includes(l.id))
    .reduce((sum, l) => sum + (l.contact_count || 0), 0);

  return (
    <div className="campaign-wizard-page">
      {/* 1. Shared Campaign Wizard Header */}
      <CampaignWizardHeader
        currentStep={currentStep}
        campaignName={campaignName}
        onNameChange={setCampaignName}
        onStepClick={(step) => setCurrentStep(step)}
        onBack={handleBack}
        onClose={handleClose}
      />

      {/* 2. Main Step Content Area */}
      <main className="campaign-wizard-main">
        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: '14px 20px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              color: '#991b1b',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 700 }}
            >
              ×
            </button>
          </div>
        )}

        {/* Step 1: Content */}
        {currentStep === 1 && (
          <ContentStep
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
            htmlContent={htmlContent}
            plainText={plainText}
            onOpenTemplateModal={() => setShowTemplateModal(true)}
            onOpenHtmlEditor={() => setShowHtmlEditorModal(true)}
            trackingOptions={trackingOptions}
            setTrackingOptions={setTrackingOptions}
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
          />
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <ReviewStep
            campaignName={campaignName}
            subject={subject}
            previewText={previewText}
            fromName={fromName}
            fromEmail={fromEmail}
            replyTo={replyTo}
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

        {/* Wizard Step Navigation Footer (Steps 1, 2, 3) */}
        {currentStep < 4 && (
          <div
            style={{
              marginTop: '32px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #e2e8f0',
              paddingTop: '20px',
            }}
          >
            <button
              type="button"
              onClick={handleBack}
              className="campaign-action-btn-secondary"
            >
              <ArrowLeft size={15} /> Back
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                if (currentStep === 1) handleProceedFromStep1();
                else if (currentStep === 2) handleProceedFromStep2();
                else if (currentStep === 3) handleProceedFromStep3();
              }}
              className="campaign-action-btn-primary"
            >
              {submitting ? 'Saving...' : 'Save & Continue'} <ArrowRight size={15} />
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      <TemplateSelectionModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleApplyTemplate}
        onOpenHtmlEditor={() => setShowHtmlEditorModal(true)}
      />

      <HtmlEditorModal
        isOpen={showHtmlEditorModal}
        onClose={() => setShowHtmlEditorModal(false)}
        initialHtml={htmlContent}
        initialPlainText={plainText}
        onSave={(data) => {
          setHtmlContent(data.html_content);
          setPlainText(data.plain_text);
        }}
      />
    </div>
  );
}
