import React, { useState } from 'react';
import Settings from '../../../components/SettingsNew';

type Page = 'dashboard' | 'settings';

const CafeModuleHome: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  if (currentPage === 'settings') {
    return (
      <div style={{ padding: '20px' }}>
        <Settings initialTab="general" />
      </div>
    );
  }

  return (
    <div className="bc-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>Cafe Module</h2>
        <button 
          className="bc-btn bc-btn-outline" 
          onClick={() => setCurrentPage('settings')}
          style={{ fontSize: '14px' }}
        >
          ⚙️ Settings
        </button>
      </div>
      <p style={{ marginBottom: 0 }}>
        Baseline schema and API scaffolding are ready. Feature screens will be added next.
      </p>
    </div>
  );
};

export default CafeModuleHome;
