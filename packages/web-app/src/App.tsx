import React, { useState } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { useApprovals } from './hooks/useApprovals';
import './App.css';

export function App() {
  const [userRef, setUserRef] = useState('demo-user');
  const { requests, loading, error, connected, approve, deny, refresh } = useApprovals(userRef);

  return (
    <div className="app">
      <Header
        userRef={userRef}
        connected={connected}
        onUserRefChange={setUserRef}
      />
      <Dashboard
        requests={requests}
        loading={loading}
        error={error}
        onApprove={approve}
        onDeny={deny}
        onRefresh={refresh}
      />
      <footer className="app-footer">
        <span>Make It So!</span>
        <span className="footer-separator">·</span>
        <span>Human-in-the-Loop for AI Agents</span>
      </footer>
    </div>
  );
}
