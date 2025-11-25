/**
 * @file App.tsx
 * @description Componente radice dell'applicazione che imposta il routing, il layout generale e il provider di contesto.
 * Updated to use Next.js routing primitives instead of react-router-dom.
 */

import React, { useState, lazy, Suspense, useEffect } from 'react';
// Removed react-router-dom imports
// import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { AppProvider, useEntitiesContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import BottomNavBar from './components/BottomNavBar';
import { SpinnerIcon } from './components/icons';

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
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));

// Special handling for named exports
const ResourceRequestPage = lazy(() => import('./pages/ResourceRequestPage').then(module => ({ default: module.ResourceRequestPage })));
const ContractsPage = lazy(() => import('./pages/ContractsPage').then(module => ({ default: module.ContractsPage })));

// Custom Navigate component to replace react-router-dom's Navigate
const Navigate: React.FC<{ to: string; replace?: boolean }> = ({ to, replace }) => {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [router, to, replace]);
  return null;
};

interface HeaderProps {
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const pathname = usePathname();
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
  
  const pageTitle = getPageTitle(pathname || '/');

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
              <Link href="/staffing" className="text-on-surface-variant hover:text-on-surface hover:underline">
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
  const pathname = usePathname() || '/';

  // Manual Route Switching for SPA behavior without React Router
  const renderPage = () => {
    if (pathname === '/' || pathname === '') return <Navigate to="/staffing" replace />;
    
    // Main Pages
    if (pathname === '/staffing') return <DynamicRoute path="/staffing"><StaffingPage /></DynamicRoute>;
    if (pathname === '/resources') return <DynamicRoute path="/resources"><ResourcesPage /></DynamicRoute>;
    if (pathname === '/skills') return <DynamicRoute path="/skills"><SkillsPage /></DynamicRoute>;
    if (pathname === '/projects') return <DynamicRoute path="/projects"><ProjectsPage /></DynamicRoute>;
    if (pathname === '/clients') return <DynamicRoute path="/clients"><ClientsPage /></DynamicRoute>;
    if (pathname === '/roles') return <DynamicRoute path="/roles"><RolesPage /></DynamicRoute>;
    if (pathname === '/contracts') return <DynamicRoute path="/contracts"><ContractsPage /></DynamicRoute>;
    if (pathname === '/dashboard') return <DynamicRoute path="/dashboard"><DashboardPage /></DynamicRoute>;
    if (pathname === '/forecasting') return <DynamicRoute path="/forecasting"><ForecastingPage /></DynamicRoute>;
    if (pathname === '/workload') return <DynamicRoute path="/workload"><WorkloadPage /></DynamicRoute>;
    if (pathname === '/gantt') return <DynamicRoute path="/gantt"><GanttPage /></DynamicRoute>;
    if (pathname === '/calendar') return <DynamicRoute path="/calendar"><CalendarPage /></DynamicRoute>;
    if (pathname === '/export') return <DynamicRoute path="/export"><ExportPage /></DynamicRoute>;
    if (pathname === '/import') return <DynamicRoute path="/import"><ImportPage /></DynamicRoute>;
    if (pathname === '/config') return <DynamicRoute path="/config"><ConfigPage /></DynamicRoute>;
    if (pathname === '/reports') return <DynamicRoute path="/reports"><ReportsPage /></DynamicRoute>;
    if (pathname === '/resource-requests') return <DynamicRoute path="/resource-requests"><ResourceRequestPage /></DynamicRoute>;
    if (pathname === '/interviews') return <DynamicRoute path="/interviews"><InterviewsPage /></DynamicRoute>;
    if (pathname === '/skills-map') return <DynamicRoute path="/skills-map"><SkillsMapPage /></DynamicRoute>;
    if (pathname === '/skill-analysis') return <DynamicRoute path="/skill-analysis"><SkillAnalysisPage /></DynamicRoute>;
    if (pathname === '/staffing-visualization') return <DynamicRoute path="/staffing-visualization"><StaffingVisualizationPage /></DynamicRoute>;
    if (pathname === '/manuale-utente') return <DynamicRoute path="/manuale-utente"><UserManualPage /></DynamicRoute>;
    if (pathname === '/simple-user-manual') return <DynamicRoute path="/simple-user-manual"><SimpleUserManualPage /></DynamicRoute>;
    if (pathname === '/test-staffing') return <DynamicRoute path="/test-staffing"><TestStaffingPage /></DynamicRoute>;
    if (pathname === '/leaves') return <DynamicRoute path="/leaves"><LeavePage /></DynamicRoute>;
    if (pathname === '/notifications') return <DynamicRoute path="/notifications"><NotificationsPage /></DynamicRoute>;

    // Admin Routes
    if (pathname === '/admin-settings') return <AdminRoute><AdminSettingsPage /></AdminRoute>;
    if (pathname === '/db-inspector') return <AdminRoute><DbInspectorPage /></AdminRoute>;

    // Fallback / 404
    return <Navigate to="/staffing" replace />;
  };

  if (loading) {
    return loadingSpinner;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
      <Header onToggleSidebar={onToggleSidebar} />

      <main className="flex-1 overflow-y-auto bg-background pb-20 md:pb-0">
        <div className="w-full max-w-none px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <Suspense fallback={loadingSpinner}>
            {renderPage()}
          </Suspense>
        </div>
      </main>
    </div>
  );
};

const ForcePasswordChange: React.FC = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { changePassword, logout } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (newPassword.length < 8) {
            setError('La password deve essere di almeno 8 caratteri.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Le password non coincidono.');
            return;
        }

        setLoading(true);
        try {
            await changePassword(newPassword);
            window.location.reload();
        } catch (e) {
            setError('Errore durante il cambio password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <div className="w-full max-w-md p-8 bg-surface rounded-2xl shadow-lg border border-outline-variant">
                <div className="text-center mb-6">
                    <span className="material-symbols-outlined text-5xl text-primary mb-2">lock_reset</span>
                    <h1 className="text-2xl font-bold text-on-surface">Cambio Password Obbligatorio</h1>
                    <p className="text-sm text-on-surface-variant mt-2">
                        Per motivi di sicurezza, devi cambiare la tua password al primo accesso.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Nuova Password</label>
                        <input 
                            type="password" 
                            required 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="form-input w-full"
                            placeholder="Minimo 8 caratteri"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Conferma Password</label>
                        <input 
                            type="password" 
                            required 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="form-input w-full"
                            placeholder="Ripeti password"
                        />
                    </div>

                    {error && <div className="text-error text-sm text-center font-medium">{error}</div>}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-2 px-4 bg-primary text-on-primary rounded-full font-bold hover:opacity-90 disabled:opacity-50 flex justify-center items-center"
                    >
                        {loading ? <SpinnerIcon className="w-5 h-5" /> : 'Cambia Password e Accedi'}
                    </button>
                </form>
                
                <button onClick={logout} className="mt-4 text-sm text-on-surface-variant hover:text-on-surface w-full text-center">
                    Torna al Login
                </button>
            </div>
        </div>
    );
};

const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();

  // If user must change password, block standard layout
  if (user?.mustChangePassword) {
      return <ForcePasswordChange />;
  }

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

const AppRoutes: React.FC = () => {
  const pathname = usePathname() || '/';
  
  // Manual routing
  if (pathname === '/login') {
    return <Suspense fallback={loadingSpinner}><LoginPage /></Suspense>;
  }

  return (
    <Suspense fallback={loadingSpinner}>
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    </Suspense>
  );
};

// App Component - Simplified to just providers and the route handler
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppProvider>
          <AuthProvider>
             <AppRoutes />
          </AuthProvider>
        </AppProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
