/**
 * @file App.tsx
 * @description Componente radice dell'applicazione che imposta il routing, il layout generale e il provider di contesto.
 */

import React, { useState, useContext } from 'react';
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
import AdminSettingsPage from './pages/AdminSettingsPage'; // Importa la nuova pagina Admin
import ResourceRequestPage from './pages/ResourceRequestPage'; // Importa la nuova pagina
import InterviewsPage from './pages/InterviewsPage'; // Importa la nuova pagina
import DbInspectorPage from './pages/DbInspectorPage'; // Importa la nuova pagina
import ContractsPage from './pages/ContractsPage'; // Importa la nuova pagina dei contratti
import StaffingVisualizationPage from './pages/StaffingVisualizationPage'; // Importa la nuova pagina di visualizzazione
import UserManualPage from './pages/UserManualPage'; // Importa la pagina del manuale
import Icon from './components/Icon';

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
            default: return 'Staffing Planner';
        }
    };

    return (
        <header className="flex-shrink-0 bg-card dark:bg-dark-card shadow-md">
            {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
            <div className="flex items-center justify-between p-[var(--space-4)]">
                <button onClick={onToggleSidebar} className="text-muted-foreground focus:outline-none md:hidden">
                    {/* MODIFICA: Sostituita emoji con icona vettoriale per coerenza. */}
                    <Icon name="Menu" size={24} />
                </button>
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <h1 className="text-[var(--font-size-xl)] font-semibold text-foreground dark:text-dark-foreground md:text-[var(--font-size-2xl)]">{getPageTitle(location.pathname)}</h1>
                 {/* Questo div serve a mantenere il titolo centrato quando il pulsante hamburger è presente */}
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <div className="md:hidden w-[var(--space-6)]"></div>
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
            <div className="flex items-center justify-center w-full h-full">
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <svg className="animate-spin h-[var(--space-10)] w-[var(--space-10)] text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }
    
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
             <Header onToggleSidebar={onToggleSidebar} />
             <main className={`flex-1 ${needsInternalScrollLayout ? 'flex flex-col overflow-y-hidden' : 'overflow-y-auto'} bg-muted dark:bg-dark-background`}>
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <div className={`container mx-auto px-[var(--space-4)] sm:px-[var(--space-6)] py-[var(--space-8)] ${needsInternalScrollLayout ? 'flex-1 flex flex-col min-h-0' : ''}`}>
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
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <svg className="animate-spin h-[var(--space-10)] w-[var(--space-10)] text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <svg className="animate-spin h-[var(--space-10)] w-[var(--space-10)] text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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