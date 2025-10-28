/**
 * @file App.tsx
 * @description Componente radice dell'applicazione che imposta il routing, il layout generale e il provider di contesto.
 */

import React, { useState, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import { Bars3Icon, SpinnerIcon } from './components/icons';

// Lazy load all page components
const StaffingPage = React.lazy(() => import('./pages/StaffingPage'));
const ResourcesPage = React.lazy(() => import('./pages/ResourcesPage'));
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage'));
const ClientsPage = React.lazy(() => import('./pages/ClientsPage'));
const RolesPage = React.lazy(() => import('./pages/RolesPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ExportPage = React.lazy(() => import('./pages/ExportPage'));
const ConfigPage = React.lazy(() => import('./pages/ConfigPage'));
const ImportPage = React.lazy(() => import('./pages/ImportPage'));
const ForecastingPage = React.lazy(() => import('./pages/ForecastingPage'));
const GanttPage = React.lazy(() => import('./pages/GanttPage'));
const CalendarPage = React.lazy(() => import('./pages/CalendarPage'));
const WorkloadPage = React.lazy(() => import('./pages/WorkloadPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const AdminSettingsPage = React.lazy(() => import('./pages/AdminSettingsPage'));
const ResourceRequestPage = React.lazy(() => import('./pages/ResourceRequestPage'));
const InterviewsPage = React.lazy(() => import('./pages/InterviewsPage'));
const DbInspectorPage = React.lazy(() => import('./pages/DbInspectorPage'));
const ContractsPage = React.lazy(() => import('./pages/ContractsPage'));
const StaffingVisualizationPage = React.lazy(() => import('./pages/StaffingVisualizationPage'));
const UserManualPage = React.lazy(() => import('./pages/UserManualPage'));
const CompetenzePage = React.lazy(() => import('./pages/CompetenzePage'));


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
    
    /**
     * Genera un titolo leggibile a partire dal percorso della URL per l'header.
     * @param {string} pathname - Il percorso corrente della URL.
     * @returns {string} Il titolo della pagina.
     */
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
            case 'competenze': return 'Valutazione Competenze';
            default: return 'Staffing Planner';
        }
    };

    return (
        <header className="flex-shrink-0 bg-card dark:bg-dark-card shadow-md">
            <div className="flex items-center justify-between p-4">
                <button onClick={onToggleSidebar} className="text-muted-foreground focus:outline-none md:hidden">
                    <Bars3Icon className="h-6 w-6" />
                </button>
                <h1 className="text-xl font-semibold text-foreground dark:text-dark-foreground md:text-2xl">{getPageTitle(location.pathname)}</h1>
                 {/* Questo div serve a mantenere il titolo centrato quando il pulsante hamburger è presente */}
                <div className="md:hidden w-6"></div>
            </div>
        </header>
    );
};

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center w-full h-full">
        <SpinnerIcon className="h-10 w-10 text-primary" />
    </div>
);

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
 * Renderizza l'header e le route definite all'interno di un boundary Suspense.
 * @param {AppContentProps} props - Le prop del componente.
 * @returns {React.ReactElement} Il contenuto principale dell'app.
 */
const AppContent: React.FC<AppContentProps> = ({ onToggleSidebar }) => {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
             <Header onToggleSidebar={onToggleSidebar} />
             <main className="flex-1 overflow-x-hidden overflow-y-auto bg-muted dark:bg-dark-background">
                <div className="container mx-auto px-4 sm:px-6 py-8">
                    <Suspense fallback={<LoadingSpinner />}>
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
                            <Route path="/competenze" element={<CompetenzePage />} />
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
                <SpinnerIcon className="h-10 w-10 text-primary" />
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
                <SpinnerIcon className="h-10 w-10 text-primary" />
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
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><SpinnerIcon className="h-10 w-10 text-primary" /></div>}>
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

/**
 * Componente radice dell'applicazione che imposta tutti i provider.
 */
const App: React.FC = () => {
    return (
        <ThemeProvider>
            <ToastProvider>
                <BrowserRouter>
                    <AuthProvider>
                        <AppProvider>
                            <AppRoutes />
                        </AppProvider>
                    </AuthProvider>
                </BrowserRouter>
            </ToastProvider>
        </ThemeProvider>
    );
};

export default App;