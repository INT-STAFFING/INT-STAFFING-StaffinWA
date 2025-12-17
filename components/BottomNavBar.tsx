/**
 * @file BottomNavBar.tsx
 * @description Componente per la barra di navigazione inferiore su dispositivi mobili.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';

interface BottomNavBarProps {
  onMenuClick: () => void;
}

const NavItem = ({ to, icon, label }: { to: string; icon: string; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex flex-col items-center justify-center w-full h-full text-xs transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        isActive ? 'text-primary' : 'text-on-surface-variant'
      }`
    }
    aria-label={label}
  >
    <span className="material-symbols-outlined text-2xl">{icon}</span>
    <span className="mt-1">{label}</span>
  </NavLink>
);

const BottomNavBar: React.FC<BottomNavBarProps> = ({ onMenuClick }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-surface-container border-t border-outline-variant shadow-lg flex items-stretch justify-around md:hidden z-30">
      <NavItem to="/dashboard" icon="dashboard" label="Dashboard" />
      <NavItem to="/gantt" icon="align_horizontal_left" label="Gantt" />
      <NavItem to="/skills-map" icon="school" label="Skills" />
      <NavItem to="/workload" icon="groups" label="Carico" />
      <button
        onClick={onMenuClick}
        className="flex flex-col items-center justify-center w-full h-full text-xs text-on-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="Apri menu"
      >
        <span className="material-symbols-outlined text-2xl">menu</span>
        <span className="mt-1">Menu</span>
      </button>
    </nav>
  );
};

export default BottomNavBar;