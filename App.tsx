/**
 * @file App.tsx
 * @description Componente radice dell'applicazione che imposta il routing, il layout generale e il provider di contesto.
 */

import React, { useState, lazy, Suspense } from 'react';
// FIX: Using namespace import for react-router-dom to address potential module resolution errors.
import * as ReactRouterDOM from 'react-router-dom';
const { BrowserRouter, Routes, Route, Navigate, useLocation } = ReactRouterDOM;
import { AppProvider, useEntitiesContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';

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
// FIX: The lazy import for InterviewsPage was expecting a default export, which caused a type error.
// It has been updated to handle a named export and moved to the dedicated section below for consistency.
const DbInspectorPage = lazy(() => import('./pages/DbInspectorPage'));
const StaffingVisualizationPage = lazy(() => import('./pages/StaffingVisualizationPage'));
const UserManualPage = lazy(() => import('./pages/UserManualPage'));

// Special handling for named exports
const ResourceRequestPage = lazy(() => import('./pages/ResourceRequestPage').then(module => ({ default: module.ResourceRequestPage })));
const ContractsPage = lazy(() => import('./pages/ContractsPage').then(module => ({ default: module.ContractsPage })));
const InterviewsPage = lazy(() => import('./pages/InterviewsPage').then(module => ({ default: module.InterviewsPage })));

interface HeaderProps {
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const location = useLocation();

  const getPageTitle = (pathname: string): string => {
    const path = pathname.split('/').pop() || 'staffing';
    switch (path) {
      case 'staffing': return 'Staffing';
      case 'dashboard': return 'Dashboard';
      case 'forecasting': return 'Forecasting & Capacity';
      case 'workload': return 'Carico Risorse';
      case 'gantt': return 'Gantt Progetti';
      case 'resources': return 'Gestione Risorse';
      case 'projects': return 'Gestione Progetti';
      case 'clients': return 'Gestione Clienti';
      case 'roles': return 'Gestione Ruoli';
      case 'contracts': return 'Gestione Contratti';
      case 'calendar': return 'Calendario Aziendale';
      case 'config': return 'Configurazioni';
      case 'export': return 'Esportazione Dati';
      case 'import': return 'Importazione Massiva';
      case 'wbs': return 'Incarichi WBS';
      case 'reports': return 'Report';
      case 'admin-settings': return 'Impostazioni Admin';
      case 'resource-requests': return 'Richiesta Risorse';
      case 'interviews': return 'Gestione Colloqui';
      case 'db-inspector': return 'Database Inspector';
      case 'staffing-visualization': return 'Visualizzazione Staffing';
      case 'manuale-utente': return 'Manuale Utente';
      default: return 'Staffing Planner';
    }
  };

  return (
    <header className="flex-shrink-0 bg-surface border-b border-outline-variant">
      <div className="flex items-center justify-between p-4 h-20">
        <button
          onClick={onToggleSidebar}
          className="text-on-surface-variant focus:outline-none md:hidden p-2 rounded-full hover:bg-surface-container"
          aria-label="Apri menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="text-xl font-semibold text-on-surface md:text-2xl">
          {getPageTitle(location.pathname)}
        </h1>
        <div className="md:hidden w-10" />
      </div>
    </header>
  );
};

// Reusable spinner for loading states (initial data load and route-based code splitting)
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

interface AppContentProps {
  onToggleSidebar: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ onToggleSidebar }) => {
  const { loading } = useEntitiesContext();

  if (loading) {
    return loadingSpinner;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header onToggleSidebar={onToggleSidebar} />

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="w-full max-w-none px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <Suspense fallback={loadingSpinner}>
            <Routes>
              <Route path="/" element={<Navigate to="/staffing" replace />} />
              <Route path="/staffing" element={<StaffingPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/forecasting" element={<ForecastingPage />} />
              <Route path="/workload" element={<WorkloadPage />} />
              <Route path="/gantt" element={<GanttPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/config" element={<ConfigPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/resource-requests" element={<ResourceRequestPage />} />
              <Route path="/interviews" element={<InterviewsPage />} />
              <Route path="/staffing-visualization" element={<StaffingVisualizationPage />} />
              <Route path="/manuale-utente" element={<UserManualPage />} />
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
          className="fixed inset-0 bg-scrim bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <AppContent onToggleSidebar={() => setIsSidebarOpen(true)} />
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