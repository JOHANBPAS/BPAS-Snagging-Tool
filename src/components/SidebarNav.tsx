import React from 'react';
import { NavLink } from 'react-router-dom';

const linkBase = 'block px-4 py-2 rounded-lg text-sm font-medium font-raleway hover:bg-bpas-yellow/20 hover:text-bpas-black';

export const SidebarNav: React.FC = () => {
  const navItems = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/projects', label: 'Projects' },
    { to: '/reports', label: 'Reports' },
  ];
  return (
    <aside className="hidden w-56 shrink-0 border-r border-bpas-grey/20 bg-white/90 px-3 py-4 shadow-sm lg:block">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${linkBase} ${
                isActive ? 'bg-bpas-yellow/30 text-bpas-black border border-bpas-yellow/60' : 'text-bpas-grey'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
