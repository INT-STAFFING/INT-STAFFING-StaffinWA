

/**
 * @file App.tsx
 * @description Componente radice dell'applicazione che imposta il routing, il layout generale e il provider di contesto.
 */

import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AppProvider, useEntitiesContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import BottomNavBar from './components/BottomNavBar';

// Lazy load all page components for code splitting
const StaffingPage = lazy(() => import('./pages/StaffingPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ExportPage = lazy(() => import('./pages/ExportPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const ForecastingPage = lazy(() => import('./pages/ForecastingPage'));
const GanttPage = lazy(() => import('./pages/GanttPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const WorkloadPage = lazy(() => import('./pages/WorkloadPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'));
const DbInspectorPage = lazy(() => import('./pages/DbInspectorPage'));
const StaffingVisualizationPage = lazy(() => import('./pages/StaffingVisualizationPage'));
const UserManualPage = lazy(() => import('./pages/UserManualPage'));
const SimpleUserManualPage = lazy(() => import('./pages/SimpleUserManualPage'));
const InterviewsPage = lazy(() => import('./pages/InterviewsPage'));
const SkillsMapPage = lazy(() => import('./pages/SkillsMapPage'));
const SkillsPage = lazy(() => import('./pages/SkillsPage'));
const SkillAnalysisPage = lazy(() => import('./pages/SkillAnalysisPage'));
const TestStaffingPage = lazy(() => import('./pages/TestStaffingPage'));
const LeavePage = lazy(() => import('./pages/LeavePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage')); // Added

// Special handling for named exports
const ResourceRequestPage = lazy(() => import('./pages/ResourceRequestPage').then(module => ({ default: module.ResourceRequestPage })));
const ContractsPage = lazy(() => import('./pages/ContractsPage').then(module => ({ default: module.ContractsPage })));

interface HeaderProps {
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const { sidebarConfig } = useEntitiesContext();

  const getPageTitle = (pathname: string): string => {
    // Cerca il titolo nella configurazione dinamica
    const configItem = sidebarConfig.find(item => item.path === pathname);
    if (configItem) return configItem.label;

    // Fallback per pagine non nel menu o dinamiche
    const path = pathname.split('/').pop() || 'staffing';
    switch (path) {
      case 'staffing': return 'Staffing'; // Fallback
      case 'admin-settings': return 'Impostazioni Admin';
      case 'db-inspector': return 'Database Inspector';
      case 'simple-user-manual': return 'Guida Assenze';
      case 'test-staffing': return 'Test Staffing Mobile';
      case 'notifications': return 'Notifiche';
      default: return 'Staffing Planner';
    }
  };
  
  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="flex-shrink-0 bg-surface border-b border-outline-variant sticky top-0 z-30">
      <div className="flex items-center justify-between p-4 h-20">
        <button
          onClick={onToggleSidebar}
          className="text-on-surface-variant focus:outline-none md:hidden p-2 rounded-full hover:bg-surface-container"
          aria-label="Apri menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        
        <nav aria-label="breadcrumb" className="flex-1 min-w-0">
          <ol className="flex items-center space-x-1 text-sm md:text-base truncate">
            <li>
              <Link to="/staffing" className="text-on-surface-variant hover:text-on-surface hover:underline">
                Home
              </Link>
            </li>
            {pageTitle !== 'Staffing' && pageTitle !== 'Staffing Planner' && (
              <>
                <li>
                  <span className="material-symbols-outlined text-on-surface-variant text-base">chevron_right</span>
                </li>
                <li className="font-semibold text-on-surface truncate" aria-current="page">
                  {pageTitle}
                </li>
              </>
            )}
          </ol>
        </nav>
        
        <div className="md:hidden w-10" />
      </div>
    </header>
  );
};

// Reusable spinner
const loadingSpinner = (
  <div className="flex items-center justify-center w-full h-full bg-background">
    <svg
      className="animate-spin h-10 w-10 text-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  </div>
);

// RBAC Protected Route Wrapper
const DynamicRoute: React.FC<{ path: string, children: React.ReactElement }> = ({ path, children }) => {
  const { hasPermission, isLoginProtectionEnabled } = useAuth();

  if (!isLoginProtectionEnabled) {
      return children;
  }

  if (!hasPermission(path)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

interface AppContentProps {
  onToggleSidebar: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ onToggleSidebar }) => {
  const { loading } = useEntitiesContext();

  if (loading) {
    return loadingSpinner;
  }

  return (
    // Reverted to flex layout without margin-left, as sidebar is now relative on desktop
    <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
      <Header onToggleSidebar={onToggleSidebar} />

      <main className="flex-1 overflow-y-auto bg-background pb-20 md:pb-0">
        <div className="w-full max-w-none px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <Suspense fallback={loadingSpinner}>
            <Routes>
              <Route path="/" element={<Navigate to="/staffing" replace />} />
              <Route path="/staffing" element={<DynamicRoute path="/staffing"><StaffingPage /></DynamicRoute>} />
              <Route path="/resources" element={<DynamicRoute path="/resources"><ResourcesPage /></DynamicRoute>} />
              <Route path="/skills" element={<DynamicRoute path="/skills"><SkillsPage /></DynamicRoute>} />
              <Route path="/projects" element={<DynamicRoute path="/projects"><ProjectsPage /></DynamicRoute>} />
              <Route path="/clients" element={<DynamicRoute path="/clients"><ClientsPage /></DynamicRoute>} />
              <Route path="/roles" element={<DynamicRoute path="/roles"><RolesPage /></DynamicRoute>} />
              <Route path="/contracts" element={<DynamicRoute path="/contracts"><ContractsPage /></DynamicRoute>} />
              <Route path="/dashboard" element={<DynamicRoute path="/dashboard"><DashboardPage /></DynamicRoute>} />
              <Route path="/forecasting" element={<DynamicRoute path="/forecasting"><ForecastingPage /></DynamicRoute>} />
              <Route path="/workload" element={<DynamicRoute path="/workload"><WorkloadPage /></DynamicRoute>} />
              <Route path="/gantt" element={<DynamicRoute path="/gantt"><GanttPage /></DynamicRoute>} />
              <Route path="/calendar" element={<DynamicRoute path="/calendar"><CalendarPage /></DynamicRoute>} />
              <Route path="/export" element={<DynamicRoute path="/export"><ExportPage /></DynamicRoute>} />
              <Route path="/import" element={<DynamicRoute path="/import"><ImportPage /></DynamicRoute>} />
              <Route path="/config" element={<DynamicRoute path="/config"><ConfigPage /></DynamicRoute>} />
              <Route path="/reports" element={<DynamicRoute path="/reports"><ReportsPage /></DynamicRoute>} />
              <Route path="/resource-requests" element={<DynamicRoute path="/resource-requests"><ResourceRequestPage /></DynamicRoute>} />
              <Route path="/interviews" element={<DynamicRoute path="/interviews"><InterviewsPage /></DynamicRoute>} />
              <Route path="/skills-map" element={<DynamicRoute path="/skills-map"><SkillsMapPage /></DynamicRoute>} />
              <Route path="/skill-analysis" element={<DynamicRoute path="/skill-analysis"><SkillAnalysisPage /></DynamicRoute>} />
              <Route path="/staffing-visualization" element={<DynamicRoute path="/staffing-visualization"><StaffingVisualizationPage /></DynamicRoute>} />
              <Route path="/manuale-utente" element={<DynamicRoute path="/manuale-utente"><UserManualPage /></DynamicRoute>} />
              <Route path="/simple-user-manual" element={<DynamicRoute path="/simple-user-manual"><SimpleUserManualPage /></DynamicRoute>} /> 
              <Route path="/test-staffing" element={<DynamicRoute path="/test-staffing"><TestStaffingPage /></DynamicRoute>} />
              <Route path="/leaves" element={<DynamicRoute path="/leaves"><LeavePage /></DynamicRoute>} />
              <Route path="/notifications" element={<DynamicRoute path="/notifications"><NotificationsPage /></DynamicRoute>} />
              <Route
                path="/admin-settings"
                element={
                  <AdminRoute>
                    <AdminSettingsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/db-inspector"
                element={
                  <AdminRoute>
                    <DbInspectorPage />
                  </AdminRoute>
                }
              />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
};

const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-scrim bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <AppContent onToggleSidebar={() => setIsSidebarOpen(true)} />
        <BottomNavBar onMenuClick={() => setIsSidebarOpen(true)} />
      </div>
    </>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthLoading, isLoginProtectionEnabled, isAuthenticated } = useAuth();

  if (isAuthLoading) {
    return loadingSpinner;
  }

  if (isLoginProtectionEnabled && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthLoading, isLoginProtectionEnabled, isAuthenticated, isAdmin } = useAuth();

  if (isAuthLoading) {
    return loadingSpinner;
  }

  if (isLoginProtectionEnabled && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoutes: React.FC = () => (
  <Suspense fallback={loadingSpinner}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  </Suspense>
);

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </AppProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
