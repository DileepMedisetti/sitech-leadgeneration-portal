export const ALL_COLUMNS = [
  // Campaign Information
  { id: 'name', label: 'Campaign Name', category: 'Campaign Information', required: true, defaultVisible: true },
  { id: 'subject', label: 'Subject Line', category: 'Campaign Information', required: false, defaultVisible: true },
  { id: 'status', label: 'Status', category: 'Campaign Information', required: true, defaultVisible: true },
  { id: 'created_at', label: 'Created Date', category: 'Campaign Information', required: false, defaultVisible: true },
  { id: 'updated_at', label: 'Last Updated', category: 'Campaign Information', required: false, defaultVisible: false },

  // Delivery Metrics
  { id: 'total_recipients', label: 'Total Recipients', category: 'Delivery Metrics', required: false, defaultVisible: true },
  { id: 'delivered_count', label: 'Delivered Count', category: 'Delivery Metrics', required: false, defaultVisible: true },
  { id: 'sent_count', label: 'Sent Count', category: 'Delivery Metrics', required: false, defaultVisible: false },
  { id: 'bounced_count', label: 'Bounced Count', category: 'Delivery Metrics', required: false, defaultVisible: false },

  // Engagement Metrics
  { id: 'open_rate', label: 'Open Rate', category: 'Engagement Metrics', required: false, defaultVisible: true },
  { id: 'unsubscribed_count', label: 'Unsubscribe Count', category: 'Engagement Metrics', required: false, defaultVisible: false },

  // Spam & Schedule Metrics
  { id: 'scheduled_at', label: 'Scheduled / Sent Time', category: 'Spam & Inbox Metrics', required: false, defaultVisible: true },
  { id: 'actions', label: 'Row Actions', category: 'Spam & Inbox Metrics', required: true, defaultVisible: true },
];

export const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id);

export const STORAGE_KEY = 'sitech_campaign_table_columns_v1';

export function getSavedColumns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE_COLUMNS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure required columns are always present
      const req = ALL_COLUMNS.filter((c) => c.required).map((c) => c.id);
      return Array.from(new Set([...parsed, ...req]));
    }
  } catch {
    // fallback
  }
  return DEFAULT_VISIBLE_COLUMNS;
}
