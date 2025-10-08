import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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

const AppContent: React.FC = () => {
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
         <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="container mx-auto px-6 py-8">
                <Routes>
                    <Route path="/" element={<Navigate to="/staffing" replace />} />
                    <Route path="/staffing" element={<StaffingPage />} />
                    <Route path="/resources" element={<ResourcesPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/clients" element={<ClientsPage />} />
                    <Route path="/roles" element={<RolesPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/export" element={<ExportPage />} />
                    <Route path="/config" element={<ConfigPage />} />
                </Routes>
            </div>
        </main>
    )
}

const App: React.FC = () => {
    return (
        <StaffingProvider>
            <HashRouter>
                <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
                    <Sidebar />
                    <AppContent />
                </div>
            </HashRouter>
        </StaffingProvider>
    );
};

export default App;
