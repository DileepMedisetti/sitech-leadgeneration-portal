/**
 * Canonical Application Route Definitions and Navigational Mappings.
 * Shared across App.jsx, navigation blockers, and automated route test suites.
 */

export function getRouteFromPath(pathname) {
  const clean = (pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/login') {
    return { tab: 'login', param: null };
  }
  if (clean === '/email-accounts') {
    return { tab: 'email-accounts', param: null };
  }
  if (
    clean === '/audience/lists/new' ||
    clean === '/audience/new-list' ||
    clean === '/audience/create-list'
  ) {
    const isCustom = typeof window !== 'undefined' && (
      window.location.search.includes('mode=custom') ||
      clean.includes('custom')
    );
    return {
      tab: 'create-contact-list',
      param: isCustom ? { mode: 'custom' } : { mode: 'existing' },
    };
  }
  if (clean.startsWith('/audience/lists/')) {
    const listId = clean.split('/')[3];
    return {
      tab: 'audience',
      param: { listId: Number(listId) || listId, tab: 'lists' },
    };
  }
  if (clean === '/audience' || clean === '/audience/contacts' || clean === '/audience/lists') {
    const subtab = clean.endsWith('/lists') ? 'lists' : 'contacts';
    return { tab: 'audience', param: { tab: subtab } };
  }

  // Campaign Tracking independent subroutes
  if (clean === '/campaign-tracking') {
    return { tab: 'campaign-tracking', param: null };
  }
  if (clean.startsWith('/campaigns/tracking/')) {
    const parts = clean.split('/');
    const cid = parts[3];
    if (parts.length > 4 && parts[4] === 'bounces') {
      return { tab: 'campaign-bounced-mails', param: Number(cid) || cid };
    }
    return { tab: 'campaign-tracking-detail', param: Number(cid) || cid };
  }

  // Canonical and specialized campaign subroutes (evaluated before general /campaigns/ prefix)
  if (
    clean === '/campaigns/create/templates' ||
    clean === '/campaigns/templates'
  ) {
    return { tab: 'campaign-templates', param: null };
  }
  if (clean.startsWith('/campaigns/create/templates/preview/')) {
    const tid = clean.split('/')[5];
    return { tab: 'campaign-template-preview', param: Number(tid) || tid };
  }
  if (
    clean === '/campaigns/create/html-editor' ||
    clean === '/campaigns/html-editor'
  ) {
    return { tab: 'campaign-html-editor', param: null };
  }
  if (
    clean === '/campaigns/new' ||
    clean === '/campaigns/create'
  ) {
    return { tab: 'create-campaign', param: null };
  }
  if (clean.startsWith('/campaigns/')) {
    const cid = clean.split('/')[2];
    if (cid === 'create' || cid === 'templates' || cid === 'html-editor') {
      return { tab: 'create-campaign', param: null };
    }
    if (cid === 'tracking') {
      return { tab: 'campaign-tracking', param: null };
    }
    return { tab: 'campaign-detail', param: Number(cid) || cid };
  }
  if (clean === '/campaigns') return { tab: 'campaigns', param: null };
  if (clean === '/jobs/new' || clean === '/new-job') {
    return { tab: 'new-job', param: null };
  }
  if (clean.startsWith('/jobs/')) {
    const jid = clean.split('/')[2];
    return { tab: 'job-detail', param: Number(jid) || jid };
  }
  if (clean === '/jobs') return { tab: 'jobs', param: null };
  if (clean === '/discovery') return { tab: 'discovery', param: null };
  if (clean === '/extraction') return { tab: 'extraction', param: null };
  if (clean === '/leads') return { tab: 'leads', param: null };
  if (clean === '/review-queue') return { tab: 'review-queue', param: null };
  if (clean === '/analytics') return { tab: 'analytics', param: null };
  if (clean === '/settings') return { tab: 'settings', param: null };
  return { tab: 'dashboard', param: null };
}

export function getPathFromRoute(tab, param) {
  switch (tab) {
    case 'login':
      return '/login';
    case 'email-accounts':
      return '/email-accounts';
    case 'create-contact-list':
      return '/audience/lists/new';
    case 'audience':
      if (param && typeof param === 'object') {
        if (param.listId) return `/audience/lists/${param.listId}`;
        if (param.tab === 'lists') return '/audience/lists';
        return '/audience';
      }
      if (typeof param === 'number' || typeof param === 'string') {
        return `/audience/lists/${param}`;
      }
      return '/audience';
    case 'create-campaign':
      return '/campaigns/create';
    case 'campaign-templates':
    case 'template-gallery':
      return '/campaigns/create/templates';
    case 'campaign-template-preview':
    case 'template-preview':
      return `/campaigns/create/templates/preview/${param}`;
    case 'campaign-html-editor':
    case 'custom-html-editor':
      return '/campaigns/create/html-editor';
    case 'campaign-detail':
      return `/campaigns/${param}`;
    case 'campaigns':
      return '/campaigns';
    case 'campaign-tracking':
      return '/campaign-tracking';
    case 'campaign-tracking-detail':
      return `/campaigns/tracking/${param}`;
    case 'campaign-bounced-mails':
      return `/campaigns/tracking/${param}/bounces`;
    case 'new-job':
      return '/jobs/new';
    case 'job-detail':
      return `/jobs/${param}`;
    case 'jobs':
      return '/jobs';
    case 'discovery':
      return '/discovery';
    case 'extraction':
      return '/extraction';
    case 'leads':
      return '/leads';
    case 'review-queue':
      return '/review-queue';
    case 'analytics':
      return '/analytics';
    case 'settings':
      return '/settings';
    case 'dashboard':
    default:
      return '/';
  }
}
