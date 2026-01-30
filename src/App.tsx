import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AdminPanel from './components/AdminPanel';
import AuthGate from './components/AuthGate';
import Dashboard from './pages/Dashboard';
import ResetPassword from './pages/auth/ResetPassword';
import ProjectDetail from './pages/ProjectDetail';
import SiteMode from './pages/SiteMode';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import Reports from './pages/Reports';

const Protected: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-center text-slate-700">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

import { OfflineBanner } from './components/OfflineBanner';
import { syncMutations } from './services/syncService';

const AppRoutes = () => {
  const { isAdmin } = useAuth();
  const showAdminPanel =
    isAdmin && new URLSearchParams(window.location.search).get('admin') === 'true';

  if (showAdminPanel) {
    return <AdminPanel />;
  }

  return (
    <Routes>
      <Route path="/login" element={<AuthGate />} />
      <Route path="/register" element={<AuthGate />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Layout>
              <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/:projectId" element={<ProjectDetail />} />
                <Route path="projects/:projectId/site" element={<SiteMode />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </Protected>
        }
      />
    </Routes>
  );
};

const App = () => {
  React.useEffect(() => {
    const handleOnline = () => {
      // eslint-disable-next-line no-console
      console.log('Back online, syncing mutations...');
      syncMutations();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <AuthProvider>
      <OfflineBanner />
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;
