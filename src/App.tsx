/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AuthProvider } from './hooks/useAuth';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { IssueList } from './components/IssueList';
import { IssueForm } from './components/IssueForm';
import { IssueDetail } from './components/IssueDetail';
import { UserManagement } from './components/UserManagement';
import { Toaster } from './components/ui/sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Issue } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient();

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGuard>
            <AppContent />
            <Toaster position="top-right" />
          </AuthGuard>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssueId(issue.id || null);
    setActiveTab('issue-detail');
  };

  const renderContent = () => {
    if (activeTab === 'issue-detail' && selectedIssueId) {
      return <IssueDetail issueId={selectedIssueId} onBack={() => setActiveTab('issues')} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onIssueClick={handleIssueClick} />;
      case 'issues':
        return <IssueList onIssueClick={handleIssueClick} />;
      case 'create':
        return <IssueForm onSuccess={() => setActiveTab('issues')} />;
      case 'users':
        return <UserManagement />;
      case 'settings':
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <h2 className="text-2xl font-bold">Settings</h2>
            <p>Profile and application settings coming soon.</p>
          </div>
        );
      default:
        return <Dashboard onIssueClick={handleIssueClick} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={(tab) => {
      setActiveTab(tab);
      setSelectedIssueId(null);
    }}>
      {renderContent()}
    </Layout>
  );
}

