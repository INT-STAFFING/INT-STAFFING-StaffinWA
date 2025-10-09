/**
 * @file App.tsx
 * @description Componente radice dell'applicazione che imposta il routing, il layout generale e il provider di contesto.
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StaffingProvider, useStaffingContext } from './context/StaffingContext';
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
            case 'resources': return 'Gestione Risorse';
            case 'projects': return 'Gestione Progetti';
            case 'clients': return 'Gestione Clienti';
            case 'roles': return 'Gestione Ruoli';
            case 'config': return 'Configurazioni';
            case 'export': return 'Esporta Dati';
            case 'import': return 'Importa Dati';
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
 * Gestisce il contenuto principale dell'applicazione.
 * Mostra un indicatore di caricamento mentre i dati vengono recuperati,
 * altrimenti renderizza l'header e le route definite.
 * @param {AppContentProps} props - Le prop del componente.
 * @returns {React.ReactElement} Il contenuto principale dell'app.
 */
const AppContent: React.FC<AppContentProps> = ({ onToggleSidebar }) => {
    const { loading } = useStaffingContext();

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
                    <Routes>
                        <Route path="/" element={<Navigate to="/staffing" replace />} />
                        <Route path="/staffing" element={<StaffingPage />} />
                        <Route path="/resources" element={<ResourcesPage />} />
                        <Route path="/projects" element={<ProjectsPage />} />
                        <Route path="/clients" element={<ClientsPage />} />
                        <Route path="/roles" element={<RolesPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/export" element={<ExportPage />} />
                        <Route path="/import" element={<ImportPage />} />
                        <Route path="/config" element={<ConfigPage />} />
                    </Routes>
                </div>
            </main>
        </div>
    )
}

/**
 * Componente radice dell'applicazione.
 * Configura il provider di contesto, il router e la gestione del layout responsive,
 * inclusa la visibilità della sidebar su schermi piccoli.
 * @returns {React.ReactElement} L'applicazione completa.
 */
const App: React.FC = () => {
    // Stato per controllare l'apertura e la chiusura della sidebar su mobile.
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <StaffingProvider>
            <BrowserRouter>
                 {/* Backdrop per la sidebar mobile: un overlay scuro che chiude la sidebar al click. */}
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
            </BrowserRouter>
        </StaffingProvider>
    );
};

export default App;