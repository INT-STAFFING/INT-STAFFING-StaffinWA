/**
 * @file App.tsx
 * @description Componente radice dell'applicazione che imposta il routing, il layout generale e il provider di contesto.
 */

import React, { useState, useContext } from 'react';
// Fix: Updated react-router-dom imports for v5 compatibility. Replaced Routes with Switch and Navigate with Redirect.
import { BrowserRouter, Switch, Route, Redirect, useLocation } from 'react-router-dom';
import { AppProvider, useEntitiesContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
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
import { Bars3Icon } from './components/icons';

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
        <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-md">
            <div className="flex items-center justify-between p-4">
                <button onClick={onToggleSidebar} className="text-gray-500 dark:text-gray-300 focus:outline-none md:hidden">
                    <Bars3Icon className="h-6 w-6" />
                </button>
                <h1 className="text-xl font-semibold text-gray-800 dark:text-white md:text-2xl">{getPageTitle(location.pathname)}</h1>
                 {/* Questo div serve a mantenere il titolo centrato quando il pulsante hamburger è presente */}
                <div className="md:hidden w-6"></div>
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

    if (loading) {
        return (
            <div className="flex items-center justify-center w-full h-full">
                <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }
    
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
             <Header onToggleSidebar={onToggleSidebar} />
             <main className="flex-1 overflow-x-hidden overflow-y-auto">
                <div className="container mx-auto px-4 sm:px-6 py-8">
                    {/* Fix: Replaced Routes with Switch and Route element prop with child components for v5 compatibility. */}
                    <Switch>
                        <Route exact path="/"><Redirect to="/staffing" /></Route>
                        <Route path="/staffing"><StaffingPage /></Route>
                        <Route path="/resources"><ResourcesPage /></Route>
                        <Route path="/projects"><ProjectsPage /></Route>
                        <Route path="/clients"><ClientsPage /></Route>
                        <Route path="/roles"><RolesPage /></Route>
                        <Route path="/contracts"><ContractsPage /></Route>
                        <Route path="/dashboard"><DashboardPage /></Route>
                        <Route path="/forecasting"><ForecastingPage /></Route>
                        <Route path="/workload"><WorkloadPage /></Route>
                        <Route path="/gantt"><GanttPage /></Route>
                        <Route path="/calendar"><CalendarPage /></Route>
                        <Route path="/export"><ExportPage /></Route>
                        <Route path="/import"><ImportPage /></Route>
                        <Route path="/config"><ConfigPage /></Route>
                        <Route path="/reports"><ReportsPage /></Route>
                        <Route path="/resource-requests"><ResourceRequestPage /></Route>
                        <Route path="/interviews"><InterviewsPage /></Route>
                        <Route path="/staffing-visualization"><StaffingVisualizationPage /></Route>
                        <Route path="/manuale-utente"><UserManualPage /></Route>
                        <Route path="/admin-settings">
                            <AdminRoute>
                                <AdminSettingsPage />
                            </AdminRoute>
                        </Route>
                        <Route path="/db-inspector">
                            <AdminRoute>
                                <DbInspectorPage />
                            </AdminRoute>
                        </Route>
                    </Switch>
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
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
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
                <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }
    
    if (isLoginProtectionEnabled && !isAuthenticated) {
        // Fix: Replaced Navigate with Redirect for v5 compatibility.
        return <Redirect to="/login" />;
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
                <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    if (isLoginProtectionEnabled && !isAuthenticated) {
        // Fix: Replaced Navigate with Redirect for v5 compatibility.
        return <Redirect to="/login" />;
    }
    
    if (!isAdmin) {
        // Fix: Replaced Navigate with Redirect for v5 compatibility.
        return <Redirect to="/" />;
    }

    return children;
};

/**
 * Componente radice dell'applicazione che gestisce il routing principale.
 * @returns {React.ReactElement} L'applicazione completa.
 */
const AppRoutes: React.FC = () => (
    // Fix: Replaced Routes with Switch and Route element prop with child components for v5 compatibility.
    <Switch>
        <Route path="/login">
            <LoginPage />
        </Route>
        <Route path="/">
            <ProtectedRoute>
                <MainLayout />
            </ProtectedRoute>
        </Route>
    </Switch>
);

/**
 * Componente radice dell'applicazione che imposta tutti i provider.
 */
const App: React.FC = () => {
    return (
        <ToastProvider>
            <AppProvider>
                <AuthProvider>
                    <BrowserRouter>
                        <AppRoutes />
                    </BrowserRouter>
                </AuthProvider>
            </AppProvider>
        </ToastProvider>
    );
};

export default App;
