import React, { useEffect, useState } from 'react';
import { Users, ListFilter, CheckCircle, X } from 'lucide-react';
import ContactsTab from './components/ContactsTab';
import ListsTab from './components/ListsTab';
import ListDetailView from './components/ListDetailView';

export default function AudiencePage({ onNavigate, activeParam }) {
  const [activeTab, setActiveTab] = useState(() => {
    if (activeParam && typeof activeParam === 'object' && activeParam.tab) {
      return activeParam.tab;
    }
    return 'contacts';
  });

  const [selectedListId, setSelectedListId] = useState(() => {
    if (typeof activeParam === 'number' || typeof activeParam === 'string') {
      return activeParam;
    }
    if (activeParam && typeof activeParam === 'object' && activeParam.listId) {
      return activeParam.listId;
    }
    return null;
  });

  const [notification, setNotification] = useState(() => {
    if (activeParam && typeof activeParam === 'object' && activeParam.notification) {
      return activeParam.notification;
    }
    return null;
  });

  useEffect(() => {
    if (!activeParam) return;
    if (typeof activeParam === 'number' || typeof activeParam === 'string') {
      setSelectedListId(activeParam);
    } else if (typeof activeParam === 'object') {
      if (activeParam.tab) setActiveTab(activeParam.tab);
      if (activeParam.listId !== undefined) setSelectedListId(activeParam.listId);
      if (activeParam.notification) setNotification(activeParam.notification);
    }
  }, [activeParam]);

  const handleSelectList = (listId) => {
    setSelectedListId(listId);
    if (onNavigate) {
      onNavigate('audience', { listId, tab: 'lists' });
    }
  };

  const handleBackToLists = () => {
    setSelectedListId(null);
    setActiveTab('lists');
    if (onNavigate) {
      onNavigate('audience', { tab: 'lists' });
    }
  };

  const handleListDeleted = () => {
    setSelectedListId(null);
    setActiveTab('lists');
    setNotification('Contact list deleted successfully.');
    if (onNavigate) {
      onNavigate('audience', { tab: 'lists' });
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Banner Notification */}
      {notification && (
        <div
          className="alert-banner alert-success"
          style={{
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={15} style={{ flexShrink: 0 }} />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              color: 'inherit',
            }}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Segmented Controls - hidden when inside list detail */}
      {!selectedListId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('contacts');
              setSelectedListId(null);
              if (onNavigate) {
                onNavigate('audience', { tab: 'contacts' });
              }
            }}
            className={`btn btn-sm ${activeTab === 'contacts' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Users size={14} />
            <span>Contacts</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('lists');
              setSelectedListId(null);
              if (onNavigate) {
                onNavigate('audience', { tab: 'lists' });
              }
            }}
            className={`btn btn-sm ${activeTab === 'lists' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ListFilter size={14} />
            <span>Lists</span>
          </button>
        </div>
      )}

      {/* Main Feature View */}
      {selectedListId ? (
        <ListDetailView
          listId={selectedListId}
          onBack={handleBackToLists}
          onListDeleted={handleListDeleted}
        />
      ) : activeTab === 'contacts' ? (
        <ContactsTab onSelectLead={() => {}} />
      ) : (
        <ListsTab
          onSelectList={handleSelectList}
          onCreateList={(mode = 'existing') => (onNavigate ? onNavigate('create-contact-list', { mode }) : null)}
        />
      )}
    </div>
  );
}
