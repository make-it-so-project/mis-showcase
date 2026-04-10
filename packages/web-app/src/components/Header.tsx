import React from 'react';
import './Header.css';

interface HeaderProps {
  userRef: string;
  connected: boolean;
  onUserRefChange: (value: string) => void;
}

export function Header({ userRef, connected, onUserRefChange }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">
          <span className="logo-icon">◈</span>
        </div>
        <div className="header-title">
          <h1>Make It So!</h1>
          <span className="header-subtitle">Human-in-the-Loop for AI Agents</span>
        </div>
      </div>

      <div className="header-controls">
        <div className="user-ref-input">
          <label htmlFor="user-ref">User Ref:</label>
          <input
            id="user-ref"
            type="text"
            value={userRef}
            onChange={(e) => onUserRefChange(e.target.value)}
            placeholder="e.g. user-123"
          />
        </div>

        <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot" />
          <span className="status-text">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </header>
  );
}
