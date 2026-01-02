
/**
 * @file App.tsx
 * @description Componente radice dell'applicazione che imposta il routing, il layout generale e il provider di contesto.
 */

import React, { useState, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';

import { AppProviders, useEntitiesContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { RoutesProvider, useRoutesManifest } from './context/RoutesContext';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorScreen from './components/ErrorScreen';
import LoadingSkeleton from './components/LoadingSkeleton';
import Sidebar from './components/Sidebar';
import BottomNavBar from './components/BottomNavBar';
import { SpinnerIcon } from './components/icons';
import type { AppRoute } from './src/routes';

interface HeaderProps {
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const { getBreadcrumb } = useRoutesManifest();
  const breadcrumbs = getBreadcrumb(location.pathname);

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
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.path} className="flex items-center">
                {index > 0 && (
                  <span className="material-symbols-outlined text-on-surface-variant text-base mx-1">chevron_right</span>
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-semibold text-on-surface truncate" aria-current="page">{crumb.label}</span>
                ) : (
                  <Link to={crumb.path} className="text-on-surface-variant hover:text-on-surface hover:underline">
                    {crumb.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
        
        <div className="md:hidden w-10" />
      </div>
    </header>
  );
};

// RBAC Protected Route Wrapper
const DynamicRoute: React.FC<{ route: AppRoute; children: React.ReactElement }> = ({ route, children }) => {
  const { isLoginProtectionEnabled } = useAuth();
  const { canAccessRoute } = useRoutesManifest();

  if (!isLoginProtectionEnabled) {
    return children;
  }

  if (!canAccessRoute(route)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Dynamic Home Redirect Component
const HomeRedirect: React.FC = () => {
  const { user, isLoginProtectionEnabled } = useAuth();
  const { loading } = useEntitiesContext();
  const { getHomeForRole } = useRoutesManifest();

  if (loading) return <LoadingSkeleton />;

  if (!isLoginProtectionEnabled) {
    return <Navigate to={getHomeForRole()} replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const target = getHomeForRole(user.role);
  return <Navigate to={target} replace />;
};

interface AppContentProps {
  onToggleSidebar: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ onToggleSidebar }) => {
  const { loading } = useEntitiesContext();
  const { manifest } = useRoutesManifest();
  const protectedRoutes = manifest.filter(route => route.requiresAuth !== false);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
      <Header onToggleSidebar={onToggleSidebar} />

      <main className="flex-1 overflow-y-auto bg-background pb-20 md:pb-0">
        <div className="w-full max-w-none px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <ErrorBoundary fallback={<ErrorScreen />}>
            <Suspense fallback={<LoadingSkeleton />}>
              <Routes>
                <Route path="/" element={<HomeRedirect />} />
                {protectedRoutes.map(route => {
                  const RouteComponent = route.component;
                  return (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={<DynamicRoute route={route}><RouteComponent /></DynamicRoute>}
                    />
                  );
                })}
                <Route path="*" element={<HomeRedirect />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
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
    return <LoadingSkeleton />;
  }

  if (isLoginProtectionEnabled && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AppRoutes: React.FC = () => {
  const { manifest } = useRoutesManifest();
  const publicRoutes = manifest.filter(route => route.requiresAuth === false);

  return (
    <Routes>
      {publicRoutes.map(route => {
        const RouteComponent = route.component;
        return (
          <Route
            key={route.path}
            path={route.path}
            element={
              <Suspense fallback={<LoadingSkeleton />}>
                <RouteComponent />
              </Suspense>
            }
          />
        );
      })}
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
};

// App Component - Simplified to just providers and the router
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AppProviders>
            <AuthProvider>
              <RoutesProvider>
                <AppRoutes />
              </RoutesProvider>
            </AuthProvider>
          </AppProviders>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
