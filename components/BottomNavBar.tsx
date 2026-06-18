
/**
 * @file BottomNavBar.tsx
 * @description Componente per la barra di navigazione inferiore su dispositivi mobili.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useRoutesManifest } from '../context/RoutesContext';

interface BottomNavBarProps {
  onMenuClick: () => void;
}

interface NavItemProps {
  to: string;
  icon: string;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className="flex flex-col items-center justify-center w-full h-full pt-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    aria-label={label}
  >
    {({ isActive }) => (
      <>
        {/* Indicatore attivo M3: pillola dietro l'icona */}
        <span
          className={`flex items-center justify-center h-8 w-16 rounded-full transition-colors duration-200 ${
            isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-2xl">{icon}</span>
        </span>
        <span
          className={`mt-1 text-[11px] leading-tight max-w-[72px] truncate transition-colors duration-200 ${
            isActive ? 'text-on-surface font-medium' : 'text-on-surface-variant'
          }`}
        >
          {label}
        </span>
      </>
    )}
  </NavLink>
);

const BottomNavBar: React.FC<BottomNavBarProps> = ({ onMenuClick }) => {
  const { bottomNavigationRoutes } = useRoutesManifest();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 min-h-20 bg-surface-container border-t border-outline-variant shadow-lg flex items-stretch justify-around md:hidden z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigazione principale"
    >
      {bottomNavigationRoutes.map(route => (
        <NavItem key={route.path} to={route.path} icon={route.icon} label={route.label} />
      ))}
      <button
        onClick={onMenuClick}
        className="flex flex-col items-center justify-center w-full h-full pt-2 text-on-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="Apri menu"
      >
        <span className="flex items-center justify-center h-8 w-16 rounded-full">
          <span className="material-symbols-outlined text-2xl">menu</span>
        </span>
        <span className="mt-1 text-[11px] leading-tight max-w-[72px] truncate">Menu</span>
      </button>
    </nav>
  );
};

export default BottomNavBar;
