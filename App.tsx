/**
 * @file App.tsx
 * @description Componente radice dell'applicazione che imposta il routing, il layout generale e il provider di contesto.
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useEntitiesContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import StaffingPage from './pages/StaffingPage';
import ResourcesPage from './pages/ResourcesPage';
import ProjectsPage from './pages/ProjectsPage';
import ClientsPage from './pages/ClientsPage';
import RolesPage from './pages/RolesPage';
import DashboardPage from './pages/DashboardPage';
import ExportPage from './pages/ExportPage';
import ConfigPage from './pages/ConfigPage';
import ImportPage from './pages/ImportPage';
import ForecastingPage from './pages/ForecastingPage';
import GanttPage from './pages/GanttPage';
import CalendarPage from './pages/CalendarPage';
import WorkloadPage from './pages/WorkloadPage';
import ReportsPage from './pages/ReportsPage';
import LoginPage from './pages/LoginPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import { ResourceRequestPage } from './pages/ResourceRequestPage';
import InterviewsPage from './pages/InterviewsPage';
import DbInspectorPage from './pages/DbInspectorPage';
import ContractsPage from './pages/ContractsPage';
import StaffingVisualizationPage from './pages/StaffingVisualizationPage';
import UserManualPage from './pages/UserManualPage';

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
    <header className="flex-shrink-0 bg-card dark:bg-dark-card shadow-md">
      <div className="flex items-center justify-between p-4">
        <button
          onClick={onToggleSidebar}
          className="text-muted-foreground focus:outline-none md:hidden"
        >
          <span className="text-2xl">☰</span>
        </button>
        <h1 className="text-xl font-semibold text-foreground dark:text-dark-foreground md:text-2xl">
          {getPageTitle(location.pathname)}
        </h1>
        <div className="md:hidden w-6" />
      </div>
    </header>
  );
};

interface AppContentProps {
  onToggleSidebar: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ onToggleSidebar }) => {
  const { loading } = useEntitiesContext();
  const location = useLocation();

  // Se ti serve in futuro sapere quali pagine hanno tabelle “pesanti”
  // puoi tenere questa lista, ma NON la usiamo per l’overflow.
  const pagesWithInternalScroll = ['/staffing', '/workload'];
  const needsInternalScrollLayout = pagesWithInternalScroll.includes(location.pathname);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
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
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header onToggleSidebar={onToggleSidebar} />

      {/* QUI: niente più overflow-y-hidden condizionale */}
      <main className="flex-1 overflow-y-auto bg-muted dark:bg-dark-background">
        {/* wrapper del contenuto, con padding orizzontale controllato */}
        <div className="w-full max-w-none px-3 sm:px-4 md:px-6 py-4 sm:py-6">
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
          className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="flex h-screen w-screen overflow-hidden bg-background dark:bg-dark-background">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <AppContent onToggleSidebar={() => setIsSidebarOpen(true)} />
      </div>
    </>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthLoading, isLoginProtectionEnabled, isAuthenticated } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background dark:bg-dark-background">
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
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    );
  }

  if (isLoginProtectionEnabled && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthLoading, isLoginProtectionEnabled, isAuthenticated, isAdmin } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background dark:bg-dark-background">
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
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    );
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