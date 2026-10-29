/**
 * Campaign Draft Store
 * Persists in-progress campaign details across template selection, HTML editor,
 * and the multi-step creation wizard without risking state loss on navigation.
 */

const DRAFT_STORAGE_KEY = 'sitech_campaign_draft_v1';

export const DEFAULT_CAMPAIGN_DRAFT = {
  campaignId: null,
  campaignName: 'Product Update - October 2024',
  subject: 'Exciting Updates from Sitech Series',
  previewText: 'Discover new features and improvements to help you grow faster.',
  fromName: 'Sitech Series',
  fromEmail: 'noreply@sitechseries.com',
  replyTo: 'replies@sitechseries.com',
  isReplyToManuallyEdited: false,
  emailAccountId: null,
  receiverName: 'Sitech Series',
  receiverEmail: 'replies@sitechseries.com',
  selectedTags: ['Product Update', 'Q4 2024'],
  trackingOptions: {
    track_opens: true,
    track_clicks: true,
  },
  editorMode: 'template_gallery', // 'template_gallery' | 'html_editor'
  selectedTemplateId: null,
  selectedTemplateName: '',
  htmlContent: '',
  plainText: '',
  selectedListIds: [],
  sendImmediately: true,
  scheduledAtDate: '',
  scheduledAtTime: '09:00',
  timezoneName: 'UTC',
  currentStep: 1,
  lastAnalysisFingerprint: null,
};

export function getCampaignDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CAMPAIGN_DRAFT };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CAMPAIGN_DRAFT, ...parsed };
  } catch {
    return { ...DEFAULT_CAMPAIGN_DRAFT };
  }
}

export function saveCampaignDraft(updates) {
  try {
    const current = getCampaignDraft();
    const merged = { ...current, ...updates };
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.error('Failed to save campaign draft:', err);
    return updates;
  }
}

export function clearCampaignDraft() {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore storage error
  }
}
