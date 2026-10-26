import React, { useEffect, useState, useRef, useCallback } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';

import LoginPage from './features/auth/pages/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';
import SearchJobsPage from './features/search-jobs/SearchJobsPage';
import CreateJobPage from './features/search-jobs/CreateJobPage';
import JobDetailPage from './features/search-jobs/JobDetailPage';
import DiscoveryPage from './features/discovery/DiscoveryPage';
import ExtractionMonitorPage from './features/extraction/ExtractionMonitorPage';
import LeadsPage from './features/leads/LeadsPage';
import AudiencePage from './features/audience/AudiencePage';
import CreateListPage from './features/audience/pages/CreateListPage';
import CampaignsPage from './features/campaigns/CampaignsPage';
import CreateCampaignPage from './features/campaigns/CreateCampaignPage';
import CampaignDetailPage from './features/campaigns/CampaignDetailPage';
import EmailAccountsPage from './features/email-accounts/EmailAccountsPage';
import ReviewQueuePage from './features/review-queue/ReviewQueuePage';
import AnalyticsPage from './features/analytics/AnalyticsPage';
import SettingsPage from './features/settings/SettingsPage';
import LoadingSpinner from './components/ui/LoadingSpinner';

function getRouteFromPath(pathname) {
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
    return { tab: 'create-contact-list', param: null };
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
  if (clean === '/campaigns/new' || clean === '/campaigns/create') {
    return { tab: 'create-campaign', param: null };
  }
  if (clean.startsWith('/campaigns/')) {
    const cid = clean.split('/')[2];
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

function getPathFromRoute(tab, param) {
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
      return '/campaigns/new';
    case 'campaign-detail':
      return `/campaigns/${param}`;
    case 'campaigns':
      return '/campaigns';
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

function AppShell() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState(() => {
    return getRouteFromPath(window.location.pathname).tab;
  });
  const [activeParam, setActiveParam] = useState(() => {
    return getRouteFromPath(window.location.pathname).param;
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Clear any legacy permanent open sidebar state from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('sitech_sidebar_collapsed');
    } catch {
      // ignore
    }
  }, []);

  const navBlockerRef = useRef(null);
  const previousRouteRef = useRef({ tab: 'dashboard', param: null });

  const registerNavBlocker = useCallback((blockerFn) => {
    navBlockerRef.current = blockerFn;
  }, []);

  // Listen to popstate (Browser Back / Forward buttons)
  useEffect(() => {
    const handlePopState = (e) => {
      const route = (e.state && typeof e.state.tab === 'string')
        ? e.state
        : getRouteFromPath(window.location.pathname);

      const safeTab = typeof route.tab === 'string' ? route.tab : 'dashboard';
      const safeParam = route.param || null;

      if (navBlockerRef.current) {
        const isBlocked = navBlockerRef.current(safeTab, safeParam);
        if (isBlocked) {
          // Re-push current path so user remains here until confirmed
          const currentPath = getPathFromRoute(currentTab, activeParam);
          window.history.pushState({ tab: currentTab, param: activeParam }, '', currentPath);
          return;
        }
      }
      if (currentTab !== safeTab || activeParam !== safeParam) {
        previousRouteRef.current = { tab: currentTab, param: activeParam };
      }
      setCurrentTab(safeTab);
      setActiveParam(safeParam);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentTab, activeParam]);

  const navigate = (tab, param = null, replace = false, bypassBlocker = false) => {
    // 1. Sanitize 'tab' argument: NEVER allow an Event or non-string object to be used as route tab
    let safeTab = 'dashboard';
    if (typeof tab === 'string' && tab.trim().length > 0) {
      safeTab = tab.trim();
    } else if (tab && typeof tab === 'object' && typeof tab.tab === 'string' && tab.tab.trim().length > 0) {
      safeTab = tab.tab.trim();
    }

    // 2. Sanitize 'param' argument: ensure it is strictly serializable by structuredClone/history.pushState
    let safeParam = null;
    if (param !== null && param !== undefined) {
      if (typeof param === 'string' || typeof param === 'number' || typeof param === 'boolean') {
        safeParam = param;
      } else if (
        typeof param === 'object' &&
        !(param instanceof Event) &&
        !param.nativeEvent &&
        !param.target &&
        !param._reactName
      ) {
        try {
          JSON.stringify(param);
          safeParam = param;
        } catch {
          safeParam = null;
        }
      }
    }

    if (!bypassBlocker && navBlockerRef.current) {
      const isBlocked = navBlockerRef.current(safeTab, safeParam);
      if (isBlocked) {
        return false;
      }
    }

    // Track previous valid route before switching
    if (currentTab !== safeTab || activeParam !== safeParam) {
      previousRouteRef.current = { tab: currentTab, param: activeParam };
    }

    setCurrentTab(safeTab);
    setActiveParam(safeParam);
    setMobileSidebarOpen(false);
    const scrollArea = document.querySelector('.content-scroll-container');
    if (scrollArea) {
      scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const targetPath = getPathFromRoute(safeTab, safeParam);
    if (window.location.pathname !== targetPath) {
      const historyState = { tab: safeTab, param: safeParam };
      if (replace) {
        window.history.replaceState(historyState, '', targetPath);
      } else {
        window.history.pushState(historyState, '', targetPath);
      }
    }
    return true;
  };

  const getPageMeta = () => {
    switch (currentTab) {
      case 'login':
        return {
          title: 'Sign In',
          subtitle: 'Sitech Series Workspace Authentication',
        };
      case 'dashboard':
        return {
          title: 'Dashboard Overview',
          subtitle: 'Operational pipeline metrics, throughput, qualification yield, and deliverability status',
        };
      case 'jobs':
        return {
          title: 'Search Jobs',
          subtitle: 'Configure SerpApi-driven discovery runs targeting academic researchers and faculty profiles',
        };
      case 'new-job':
        return {
          title: 'New Search Job',
          subtitle: 'Set keywords, criteria, SerpApi budget cap, and target lead volume',
        };
      case 'job-detail':
        return {
          title: 'Job Inspection & Results',
          subtitle: 'Extracted academic prospects, qualification metrics, and extraction errors',
        };
      case 'discovery':
        return {
          title: 'Discovery Engine',
          subtitle: 'Search configuration, query formulation, and automated scraping workflows',
        };
      case 'extraction':
        return {
          title: 'Extraction Monitor',
          subtitle: 'Live webpage contact scraping health, credit efficiency, and parsing telemetry',
        };
      case 'leads':
        return {
          title: 'Lead Management',
          subtitle: 'Curate, filter, edit, and export qualified academic contacts to Excel spreadsheets',
        };
      case 'audience':
        return {
          title: 'Audience Management',
          subtitle: 'Organize verified faculty leads into targeted outreach contact lists and segments',
        };
      case 'create-contact-list':
        return {
          title: 'Create Contact List',
          subtitle: 'Curate and organize verified academic contacts into a dedicated outreach list',
        };
      case 'campaigns':
        return {
          title: 'Email Campaigns',
          subtitle: 'Design, schedule, and evaluate targeted academic email outreach campaigns',
        };
      case 'create-campaign':
        return {
          title: 'Create Email Campaign',
          subtitle: 'Configure sender identity, responsive HTML template, targeted audience lists, and deliverability preflight',
        };
      case 'campaign-detail':
        return {
          title: 'Campaign Performance & Intelligence',
          subtitle: 'Placement testing reports, audience delivery telemetry, and machine learning placement forecasts',
        };
      case 'email-accounts':
        return {
          title: 'Email Accounts',
          subtitle: 'Manage verified sender identities and delivery providers for outreach campaigns',
        };
      case 'review-queue':
        return {
          title: 'Review Queue',
          subtitle: 'Human-in-the-loop validation for borderline academic qualifications and ambiguous contacts',
        };
      case 'analytics':
        return {
          title: 'Analytics & Reporting',
          subtitle: 'Academic domain coverage, university distribution, and SerpApi credit consumption history',
        };
      case 'settings':
        return {
          title: 'System Settings',
          subtitle: 'PostgreSQL connectivity, SerpApi safety policies, and operational configuration',
        };
      default:
        return {
          title: 'Sitech Series',
          subtitle: 'Academic Lead Intelligence Portal',
        };
    }
  };

  // 1. Initial Session Loading Screen
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          gap: '16px',
        }}
      >
        <LoadingSpinner size="lg" />
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>
          Initializing Sitech Series Workspace...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Protected Route Enforcer: render Login Page
  if (!isAuthenticated) {
    return <LoginPage onNavigate={navigate} />;
  }

  // 3. Authenticated: if currently on login route, redirect to dashboard
  if (currentTab === 'login') {
    navigate('dashboard', null, true);
  }

  const { title, subtitle } = getPageMeta();

  return (
    <div className="app-container">
      {/* Hover-to-expand Responsive Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => navigate(tab, null)}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area: Fixed Viewport Container with Stationary Header & Independent Scrolling */}
      <div className="main-content">
        <Header
          title={title}
          subtitle={subtitle}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onRefresh={() => setRefreshKey((k) => k + 1)}
          onNavigate={navigate}
        />

        <div className="content-scroll-container">
          <main className="page-body" key={refreshKey}>
            {currentTab === 'dashboard' && <DashboardPage onNavigate={navigate} />}
            {currentTab === 'jobs' && <SearchJobsPage onNavigate={navigate} />}
            {currentTab === 'new-job' && <CreateJobPage onNavigate={navigate} />}
            {currentTab === 'job-detail' && (
              <JobDetailPage jobId={activeParam} onNavigate={navigate} />
            )}
            {currentTab === 'discovery' && <DiscoveryPage onNavigate={navigate} />}
            {currentTab === 'extraction' && <ExtractionMonitorPage onNavigate={navigate} />}
            {currentTab === 'leads' && (
              <LeadsPage initialLeadId={activeParam} onNavigate={navigate} />
            )}
            {currentTab === 'audience' && (
              <AudiencePage onNavigate={navigate} activeParam={activeParam} />
            )}
            {currentTab === 'create-contact-list' && (
              <CreateListPage onNavigate={navigate} />
            )}
            {currentTab === 'campaigns' && <CampaignsPage onNavigate={navigate} />}
            {currentTab === 'create-campaign' && (
              <CreateCampaignPage
                onNavigate={navigate}
                registerNavBlocker={registerNavBlocker}
                previousRoute={previousRouteRef.current}
              />
            )}
            {currentTab === 'campaign-detail' && (
              <CampaignDetailPage campaignId={activeParam} onNavigate={navigate} />
            )}
            {currentTab === 'email-accounts' && (
              <EmailAccountsPage onNavigate={navigate} />
            )}
            {currentTab === 'review-queue' && <ReviewQueuePage onNavigate={navigate} />}
            {currentTab === 'analytics' && <AnalyticsPage onNavigate={navigate} />}
            {currentTab === 'settings' && <SettingsPage onNavigate={navigate} />}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <AppShell />
      </ModalProvider>
    </AuthProvider>
  );
}
