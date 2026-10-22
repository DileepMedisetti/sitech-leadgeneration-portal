import React, { useEffect, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

import DashboardPage from './features/dashboard/DashboardPage';
import SearchJobsPage from './features/search-jobs/SearchJobsPage';
import CreateJobPage from './features/search-jobs/CreateJobPage';
import JobDetailPage from './features/search-jobs/JobDetailPage';
import DiscoveryPage from './features/discovery/DiscoveryPage';
import ExtractionMonitorPage from './features/extraction/ExtractionMonitorPage';
import LeadsPage from './features/leads/LeadsPage';
import AudiencePage from './features/audience/AudiencePage';
import CreateListPage from './features/audience/pages/CreateListPage';
import ReviewQueuePage from './features/review-queue/ReviewQueuePage';
import AnalyticsPage from './features/analytics/AnalyticsPage';
import SettingsPage from './features/settings/SettingsPage';

function getRouteFromPath(pathname) {
  const clean = (pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
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

export default function App() {
  const [currentTab, setCurrentTab] = useState(() => {
    return getRouteFromPath(window.location.pathname).tab;
  });
  const [activeParam, setActiveParam] = useState(() => {
    return getRouteFromPath(window.location.pathname).param;
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Persistent sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sitech_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sitech_sidebar_collapsed', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Keyboard shortcut to toggle sidebar: Ctrl+[ or Cmd+[
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen to popstate (Browser Back / Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromPath(window.location.pathname);
      setCurrentTab(route.tab);
      setActiveParam(route.param);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (tab, param = null, replace = false) => {
    setCurrentTab(tab);
    setActiveParam(param);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const targetPath = getPathFromRoute(tab, param);
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({ tab, param }, '', targetPath);
      } else {
        window.history.pushState({ tab, param }, '', targetPath);
      }
    }
  };

  const getPageMeta = () => {
    switch (currentTab) {
      case 'dashboard':
        return {
          title: 'Dashboard Overview',
          subtitle: 'Live conversion rates, active search jobs, and recent academic discoveries',
        };
      case 'jobs':
        return {
          title: 'Search Jobs Management',
          subtitle: 'Configure search plans, monitor request budgets, and inspect progress',
        };
      case 'new-job':
        return {
          title: 'Create Search Job',
          subtitle: 'Define target universities, academic departments, and SerpApi budgets',
        };
      case 'job-detail':
        return {
          title: activeParam ? `Search Job Workspace · Job ${String(activeParam).padStart(3, '0')}` : 'Search Job Workspace',
          subtitle: 'Collect results, trigger extraction, and inspect discovered contacts',
        };
      case 'discovery':
        return {
          title: 'Discovery Engine',
          subtitle: 'Targeted Google Search query execution with deterministic SHA-256 caching',
        };
      case 'extraction':
        return {
          title: 'Extraction Monitor',
          subtitle: 'Zero-credit webpage contact parsing, faculty card detection, and retry policies',
        };
      case 'leads':
        return {
          title: 'Lead Management',
          subtitle: 'Verified academic faculty contacts with structured evidence provenance',
        };
      case 'create-contact-list':
        return {
          title: 'Create Contact List',
          subtitle: 'Segment verified eligible faculty contacts into a dedicated outreach list',
        };
      case 'audience':
        return {
          title: 'Audience Management',
          subtitle: 'Segment verified eligible faculty contacts and manage curated outreach lists',
        };
      case 'review-queue':
        return {
          title: 'Candidate Review Queue',
          subtitle: 'Human-in-the-loop verification for ambiguous candidate contacts',
        };
      case 'analytics':
        return {
          title: 'System Analytics',
          subtitle: 'Lead quality distributions, credit efficiency ratios, and institution breakdown',
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

  const { title, subtitle } = getPageMeta();

  return (
    <div className="app-container">
      {/* Fixed, Collapsible, and Responsive Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => navigate(tab, null)}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* Main Content Wrapper (Dynamically offset by sidebar width) */}
      <div className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          title={title}
          subtitle={subtitle}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />

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
          {currentTab === 'review-queue' && <ReviewQueuePage onNavigate={navigate} />}
          {currentTab === 'analytics' && <AnalyticsPage onNavigate={navigate} />}
          {currentTab === 'settings' && <SettingsPage onNavigate={navigate} />}
        </main>
      </div>
    </div>
  );
}
