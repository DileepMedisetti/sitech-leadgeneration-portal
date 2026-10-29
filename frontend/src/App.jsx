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

import TemplateGalleryPage from './features/campaigns/templates/TemplateGalleryPage';
import TemplatePreviewPage from './features/campaigns/templates/TemplatePreviewPage';
import CustomHtmlEditorPage from './features/campaigns/editor/CustomHtmlEditorPage';

// Campaign Tracking pages
import CampaignTrackingPage from './features/campaign-tracking/CampaignTrackingPage';
import CampaignTrackingDetailPage from './features/campaign-tracking/CampaignTrackingDetailPage';
import BouncedMailsPage from './features/campaign-tracking/BouncedMailsPage';

import EmailAccountsPage from './features/email-accounts/EmailAccountsPage';
import ReviewQueuePage from './features/review-queue/ReviewQueuePage';
import AnalyticsPage from './features/analytics/AnalyticsPage';
import SettingsPage from './features/settings/SettingsPage';

import LoadingSpinner from './components/ui/LoadingSpinner';

import { getRouteFromPath, getPathFromRoute } from './routes';


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

  // Clear any legacy permanent open sidebar state from localStorage.
  useEffect(() => {
    try {
      localStorage.removeItem('sitech_sidebar_collapsed');
    } catch {
      // Ignore localStorage errors.
    }
  }, []);

  const navBlockerRef = useRef(null);

  const [previousRoute, setPreviousRoute] = useState({
    tab: 'dashboard',
    param: null,
  });

  const registerNavBlocker = useCallback((blockerFn) => {
    navBlockerRef.current = blockerFn;
  }, []);

  // Listen to browser Back / Forward navigation.
  useEffect(() => {
    const handlePopState = (e) => {
      const route =
        e.state && typeof e.state.tab === 'string'
          ? e.state
          : getRouteFromPath(window.location.pathname);

      const safeTab =
        typeof route.tab === 'string' ? route.tab : 'dashboard';

      const safeParam = route.param || null;

      if (navBlockerRef.current) {
        const isBlocked = navBlockerRef.current(safeTab, safeParam);

        if (isBlocked) {
          // Restore the current route if navigation is blocked.
          const currentPath = getPathFromRoute(currentTab, activeParam);

          window.history.pushState(
            { tab: currentTab, param: activeParam },
            '',
            currentPath
          );

          return;
        }
      }

      if (currentTab !== safeTab || activeParam !== safeParam) {
        setPreviousRoute({
          tab: currentTab,
          param: activeParam,
        });
      }

      setCurrentTab(safeTab);
      setActiveParam(safeParam);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentTab, activeParam]);

  const navigate = (
    tab,
    param = null,
    replace = false,
    bypassBlocker = false
  ) => {
    // Sanitize the route tab.
    let safeTab = 'dashboard';

    if (typeof tab === 'string' && tab.trim().length > 0) {
      safeTab = tab.trim();
    } else if (
      tab &&
      typeof tab === 'object' &&
      typeof tab.tab === 'string' &&
      tab.tab.trim().length > 0
    ) {
      safeTab = tab.tab.trim();
    }

    // Sanitize the route parameter.
    let safeParam = null;

    if (param !== null && param !== undefined) {
      if (
        typeof param === 'string' ||
        typeof param === 'number' ||
        typeof param === 'boolean'
      ) {
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

    // Check whether the current page blocks navigation.
    if (!bypassBlocker && navBlockerRef.current) {
      const isBlocked = navBlockerRef.current(safeTab, safeParam);

      if (isBlocked) {
        return false;
      }
    }

    // Track the previous route.
    if (currentTab !== safeTab || activeParam !== safeParam) {
      setPreviousRoute({
        tab: currentTab,
        param: activeParam,
      });
    }

    setCurrentTab(safeTab);
    setActiveParam(safeParam);
    setMobileSidebarOpen(false);

    // Scroll the main content to the top.
    const scrollArea = document.querySelector('.content-scroll-container');

    if (scrollArea) {
      scrollArea.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }

    // Update the browser URL.
    const targetPath = getPathFromRoute(safeTab, safeParam);

    if (window.location.pathname !== targetPath) {
      const historyState = {
        tab: safeTab,
        param: safeParam,
      };

      if (replace) {
        window.history.replaceState(historyState, '', targetPath);
      } else {
        window.history.pushState(historyState, '', targetPath);
      }
    }

    return true;
  };

  // Redirect authenticated users from Login to Dashboard.
  useEffect(() => {
    if (isAuthenticated && currentTab === 'login') {
      navigate('dashboard', null, true);
    }
  }, [isAuthenticated, currentTab]);

  // Page titles and subtitles.
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
          subtitle:
            'Operational pipeline metrics, throughput, qualification yield, and deliverability status',
        };

      case 'jobs':
        return {
          title: 'Search Jobs',
          subtitle:
            'Configure SerpApi-driven discovery runs targeting academic researchers and faculty profiles',
        };

      case 'new-job':
        return {
          title: 'New Search Job',
          subtitle:
            'Set keywords, criteria, SerpApi budget cap, and target lead volume',
        };

      case 'job-detail':
        return {
          title: 'Job Inspection & Results',
          subtitle:
            'Extracted academic prospects, qualification metrics, and extraction errors',
        };

      case 'discovery':
        return {
          title: 'Discovery Engine',
          subtitle:
            'Search configuration, query formulation, and automated scraping workflows',
        };

      case 'extraction':
        return {
          title: 'Extraction Monitor',
          subtitle:
            'Live webpage contact scraping health, credit efficiency, and parsing telemetry',
        };

      case 'leads':
        return {
          title: 'Lead Management',
          subtitle:
            'Curate, filter, edit, and export qualified academic contacts to Excel spreadsheets',
        };

      case 'audience':
        return {
          title: 'Audience Management',
          subtitle:
            'Organize verified faculty leads into targeted outreach contact lists and segments',
        };

      case 'create-contact-list':
        return {
          title: 'Create Contact List',
          subtitle:
            'Curate and organize verified academic contacts into a dedicated outreach list',
        };

      case 'campaigns':
        return {
          title: 'Email Campaigns',
          subtitle:
            'Design, schedule, and evaluate targeted academic email outreach campaigns',
        };

      // Campaign Tracking overview.
      case 'campaign-tracking':
        return {
          title: 'Campaign Tracking',
          subtitle:
            'Monitor campaign engagement, email opens, clicks, and bounce metrics',
        };

      // Opened-recipient details for a specific campaign.
      case 'campaign-tracking-detail':
        return {
          title: 'Campaign Tracking Details',
          subtitle:
            'Review opened-email recipients and campaign engagement details',
        };

      // Bounced-email listing for a specific campaign.
      case 'campaign-bounced-mails':
        return {
          title: 'Bounced Mails',
          subtitle:
            'Review, filter, export, and manage bounced email records',
        };

      case 'create-campaign':
        return {
          title: 'Create Email Campaign',
          subtitle:
            'Configure sender identity, responsive HTML template, targeted audience lists, and deliverability preflight',
        };

      case 'campaign-templates':
      case 'template-gallery':
        return {
          title: 'Email Template Gallery',
          subtitle:
            'Choose from pre-built responsive templates or import custom HTML files',
        };

      case 'campaign-template-preview':
      case 'template-preview':
        return {
          title: 'Template Preview',
          subtitle:
            'Inspect responsive email design across desktop and mobile devices',
        };

      case 'campaign-html-editor':
      case 'custom-html-editor':
        return {
          title: 'Custom HTML Editor',
          subtitle:
            'Edit custom HTML email markup with live preview and compliance validation',
        };

      case 'campaign-detail':
        return {
          title: 'Campaign Performance & Intelligence',
          subtitle:
            'Placement testing reports, audience delivery telemetry, and machine learning placement forecasts',
        };

      case 'email-accounts':
        return {
          title: 'Email Accounts',
          subtitle:
            'Manage verified sender identities and delivery providers for outreach campaigns',
        };

      case 'review-queue':
        return {
          title: 'Review Queue',
          subtitle:
            'Human-in-the-loop validation for borderline academic qualifications and ambiguous contacts',
        };

      case 'analytics':
        return {
          title: 'Analytics & Reporting',
          subtitle:
            'Academic domain coverage, university distribution, and SerpApi credit consumption history',
        };

      case 'settings':
        return {
          title: 'System Settings',
          subtitle:
            'PostgreSQL connectivity, SerpApi safety policies, and operational configuration',
        };

      default:
        return {
          title: 'Sitech Series',
          subtitle: 'Academic Lead Intelligence Portal',
        };
    }
  };

  // Initial session loading screen.
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

        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#94a3b8',
          }}
        >
          Initializing Sitech Series Workspace...
        </div>
      </div>
    );
  }

  // Protected-route enforcement.
  if (!isAuthenticated) {
    return <LoginPage onNavigate={navigate} />;
  }

  const { title, subtitle } = getPageMeta();

  return (
    <div className="app-container">
      {/* Responsive Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => navigate(tab, null)}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="main-content">
        <Header
          title={title}
          subtitle={subtitle}
          onToggleMobileSidebar={() =>
            setMobileSidebarOpen(!mobileSidebarOpen)
          }
          onRefresh={() => setRefreshKey((key) => key + 1)}
          onNavigate={navigate}
        />

        <div className="content-scroll-container">
          <main className="page-body" key={refreshKey}>
            {currentTab === 'dashboard' && (
              <DashboardPage onNavigate={navigate} />
            )}

            {currentTab === 'jobs' && (
              <SearchJobsPage onNavigate={navigate} />
            )}

            {currentTab === 'new-job' && (
              <CreateJobPage onNavigate={navigate} />
            )}

            {currentTab === 'job-detail' && (
              <JobDetailPage
                jobId={activeParam}
                onNavigate={navigate}
              />
            )}

            {currentTab === 'discovery' && (
              <DiscoveryPage onNavigate={navigate} />
            )}

            {currentTab === 'extraction' && (
              <ExtractionMonitorPage onNavigate={navigate} />
            )}

            {currentTab === 'leads' && (
              <LeadsPage
                initialLeadId={activeParam}
                onNavigate={navigate}
              />
            )}

            {currentTab === 'audience' && (
              <AudiencePage
                onNavigate={navigate}
                activeParam={activeParam}
              />
            )}

            {currentTab === 'create-contact-list' && (
              <CreateListPage
                onNavigate={navigate}
                activeParam={activeParam}
              />
            )}

            {currentTab === 'campaigns' && (
              <CampaignsPage onNavigate={navigate} />
            )}

            {/* Campaign Tracking overview */}
            {currentTab === 'campaign-tracking' && (
              <CampaignTrackingPage onNavigate={navigate} />
            )}

            {/* Campaign Tracking details / opened recipients */}
            {currentTab === 'campaign-tracking-detail' && (
              <CampaignTrackingDetailPage
                campaignId={activeParam}
                onNavigate={navigate}
              />
            )}

            {/* Bounced mails for the selected campaign */}
            {currentTab === 'campaign-bounced-mails' && (
              <BouncedMailsPage
                campaignId={activeParam}
                onNavigate={navigate}
              />
            )}

            {(currentTab === 'campaign-templates' ||
              currentTab === 'template-gallery') && (
              <TemplateGalleryPage onNavigate={navigate} />
            )}

            {(currentTab === 'campaign-template-preview' ||
              currentTab === 'template-preview') && (
              <TemplatePreviewPage
                templateId={activeParam}
                onNavigate={navigate}
              />
            )}

            {(currentTab === 'campaign-html-editor' ||
              currentTab === 'custom-html-editor') && (
              <CustomHtmlEditorPage onNavigate={navigate} />
            )}

            {currentTab === 'create-campaign' && (
              <CreateCampaignPage
                campaignId={activeParam}
                onNavigate={navigate}
                registerNavBlocker={registerNavBlocker}
                previousRoute={previousRoute}
              />
            )}

            {currentTab === 'campaign-detail' && (
              <CampaignDetailPage
                campaignId={activeParam}
                onNavigate={navigate}
              />
            )}

            {currentTab === 'email-accounts' && (
              <EmailAccountsPage onNavigate={navigate} />
            )}

            {currentTab === 'review-queue' && (
              <ReviewQueuePage onNavigate={navigate} />
            )}

            {currentTab === 'analytics' && (
              <AnalyticsPage onNavigate={navigate} />
            )}

            {currentTab === 'settings' && (
              <SettingsPage onNavigate={navigate} />
            )}
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