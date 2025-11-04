/**
 * @file App.tsx
 * @description Componente radice dell'applicazione che imposta il routing, il layout generale e il provider di contesto.
 */

import React, { useState, useContext, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
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
import AdminSettingsPage from './pages/AdminSettingsPage'; // Importa la nuova pagina Admin
import ResourceRequestPage from './pages/ResourceRequestPage'; // Importa la nuova pagina
import InterviewsPage from './pages/InterviewsPage'; // Importa la nuova pagina
import DbInspectorPage from './pages/DbInspectorPage'; // Importa la nuova pagina
import ContractsPage from './pages/ContractsPage'; // Importa la nuova pagina dei contratti
import StaffingVisualizationPage from './pages/StaffingVisualizationPage'; // Importa la nuova pagina di visualizzazione
import UserManualPage from './pages/UserManualPage'; // Importa la pagina del manuale
import { CalendarIcon, MagnifierIcon, PlayIcon, ArrowRightIcon, BellIcon } from './components/icons';
import { PageSkeleton } from './components/FeedbackState';

/**
 * @interface HeaderProps
 * @description Prop per il componente Header.
 */
interface HeaderProps {
    /**
     * @property onToggleSidebar - Funzione callback per aprire/chiudere la sidebar su mobile.
     */
    onToggleSidebar: () => void;
}

/**
 * Componente Header dell'applicazione.
 * Mostra il titolo della pagina corrente e il pulsante "hamburger" per la navigazione su mobile.
 * @param {HeaderProps} props - Le prop del componente.
 * @returns {React.ReactElement} L'elemento header.
 */
const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
    const location = useLocation();

    const breadcrumbs = useMemo(() => {
        const segments = location.pathname.split('/').filter(Boolean);
        if (segments.length === 0) return [{ label: 'Staffing', path: '/staffing' }];
        const mappings: Record<string, string> = {
            staffing: 'Staffing',
            dashboard: 'Dashboard',
            forecasting: 'Forecasting & Capacity',
            workload: 'Carico Risorse',
            gantt: 'Gantt Progetti',
            resources: 'Gestione Risorse',
            projects: 'Gestione Progetti',
            clients: 'Gestione Clienti',
            roles: 'Gestione Ruoli',
            contracts: 'Gestione Contratti',
            calendar: 'Calendario Aziendale',
            config: 'Configurazioni',
            export: 'Esportazione Dati',
            import: 'Importazione Massiva',
            reports: 'Report',
            'admin-settings': 'Impostazioni Admin',
            'resource-requests': 'Richiesta Risorse',
            interviews: 'Gestione Colloqui',
            'db-inspector': 'Database Inspector',
            'staffing-visualization': 'Visualizzazione Staffing',
            'manuale-utente': 'Manuale Utente',
        };

        return segments.map((segment, index) => ({
            label: mappings[segment] ?? segment,
            path: `/${segments.slice(0, index + 1).join('/')}`,
        }));
    }, [location.pathname]);

    const pageTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? 'Staffing Planner';
    const today = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <header className="flex-shrink-0 border-b border-border/60 dark:border-dark-border/60 bg-gradient-to-r from-card via-card to-muted/60 dark:from-dark-card dark:via-dark-card dark:to-dark-muted">
            <div className="flex flex-col gap-4 px-4 py-5 sm:px-8">
                <div className="flex items-center justify-between">
                    <button
                        onClick={onToggleSidebar}
                        className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary"
                        aria-label="Apri menu"
                    >
                        <span className="text-lg font-semibold">≡</span>
                    </button>

                    <div className="hidden md:flex items-center gap-3 text-xs uppercase tracking-[0.32em] text-muted-foreground">
                        <MagnifierIcon className="w-4 h-4" aria-hidden />
                        Panoramica piattaforma
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="hidden md:inline-flex items-center gap-2 rounded-xl border border-border/80 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary">
                            <CalendarIcon className="w-4 h-4" aria-hidden />
                            {today}
                        </button>
                        <Link
                            to="/manuale-utente"
                            className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-4 py-2 text-sm font-semibold shadow-soft hover:bg-primary-darker"
                        >
                            <PlayIcon className="w-4 h-4" aria-hidden />
                            Avvia guida rapida
                        </Link>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <nav className="flex items-center gap-2 text-xs font-medium text-muted-foreground" aria-label="Breadcrumb">
                        <Link to="/staffing" className="hover:text-foreground">Home</Link>
                        {breadcrumbs.map(crumb => (
                            <React.Fragment key={crumb.path}>
                                <ArrowRightIcon className="w-3 h-3 text-muted-foreground" aria-hidden />
                                <Link
                                    to={crumb.path}
                                    className={`hover:text-foreground ${location.pathname === crumb.path ? 'text-foreground dark:text-dark-foreground font-semibold' : ''}`}
                                >
                                    {crumb.label}
                                </Link>
                            </React.Fragment>
                        ))}
                    </nav>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <h1 className="text-2xl font-semibold text-foreground dark:text-dark-foreground sm:text-3xl">{pageTitle}</h1>
                        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-xs font-semibold text-muted-foreground dark:bg-dark-muted dark:text-dark-muted-foreground">
                            <BellIcon className="w-4 h-4" aria-hidden />
                            Aggiornato a {today}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

/**
 * @interface AppContentProps
 * @description Prop per il componente AppContent.
 */
interface AppContentProps {
     /**
     * @property onToggleSidebar - Funzione callback per aprire la sidebar su mobile.
     */
    onToggleSidebar: () => void;
}

/**
 * Gestisce il contenuto principale dell'applicazione (le pagine).
 * Mostra un indicatore di caricamento mentre i dati vengono recuperati,
 * altrimenti renderizza l'header e le route definite.
 * @param {AppContentProps} props - Le prop del componente.
 * @returns {React.ReactElement} Il contenuto principale dell'app.
 */
const AppContent: React.FC<AppContentProps> = ({ onToggleSidebar }) => {
    const { loading } = useEntitiesContext();
    const location = useLocation();

    // Identifica le pagine che gestiscono il proprio scroll interno e richiedono un layout a piena altezza.
    const pagesWithInternalScroll = ['/staffing', '/workload', '/gantt', '/interviews'];
    const needsInternalScrollLayout = pagesWithInternalScroll.includes(location.pathname);


    if (loading) {
        return (
            <div className="flex-1 overflow-y-auto bg-muted dark:bg-dark-background p-6">
                <PageSkeleton />
            </div>
        );
    }
    
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
             <Header onToggleSidebar={onToggleSidebar} />
             <main className={`flex-1 ${needsInternalScrollLayout ? 'flex flex-col overflow-y-hidden' : 'overflow-y-auto'} bg-muted dark:bg-dark-background`}>
                <div className={`container mx-auto px-4 sm:px-6 py-8 ${needsInternalScrollLayout ? 'flex-1 flex flex-col min-h-0' : ''}`}>
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
    )
}

/**
 * Componente che gestisce il layout principale dell'applicazione (sidebar + contenuto).
 * @returns {React.ReactElement} Il layout principale.
 */
const MainLayout: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <>
            {/* Backdrop per la sidebar mobile */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}
            <div className="flex h-screen bg-background dark:bg-dark-background">
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
                <AppContent onToggleSidebar={() => setIsSidebarOpen(true)} />
            </div>
        </>
    );
};

/**
 * Componente "Wrapper" che protegge le route.
 * Se la protezione è attiva e l'utente non è autenticato, reindirizza alla pagina di login.
 * @param {{ children: React.ReactElement }} props - I componenti figli da proteggere.
 * @returns {React.ReactElement} I figli o un reindirizzamento.
 */
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthLoading, isLoginProtectionEnabled, isAuthenticated } = useAuth();
    
    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background dark:bg-dark-background">
                <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }
    
    if (isLoginProtectionEnabled && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

/**
 * Componente "Wrapper" che protegge le route di amministrazione.
 * @param {{ children: React.ReactElement }} props - I componenti figli da proteggere.
 * @returns {React.ReactElement} I figli o un reindirizzamento.
 */
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isAuthLoading, isLoginProtectionEnabled, isAuthenticated, isAdmin } = useAuth();
    
    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background dark:bg-dark-background">
                <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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

/**
 * Componente radice dell'applicazione che gestisce il routing principale.
 * @returns {React.ReactElement} L'applicazione completa.
 */
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

/**
 * Componente radice dell'applicazione che imposta tutti i provider.
 */
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