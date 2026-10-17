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
import ReviewQueuePage from './features/review-queue/ReviewQueuePage';
import AnalyticsPage from './features/analytics/AnalyticsPage';
import SettingsPage from './features/settings/SettingsPage';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [activeParam, setActiveParam] = useState(null);
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

  const navigate = (tab, param = null) => {
    setCurrentTab(tab);
    setActiveParam(param);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          title: `Search Job Workspace #${activeParam || ''}`,
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
          {currentTab === 'review-queue' && <ReviewQueuePage onNavigate={navigate} />}
          {currentTab === 'analytics' && <AnalyticsPage onNavigate={navigate} />}
          {currentTab === 'settings' && <SettingsPage onNavigate={navigate} />}
        </main>
      </div>
    </div>
  );
}
