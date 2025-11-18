import React from 'react';
import { NavLink } from 'react-router-dom';

const linkBase = 'block px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/10 hover:text-brand';

export const SidebarNav: React.FC = () => {
  const navItems = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/projects', label: 'Projects' },
    { to: '/reports', label: 'Reports' },
  ];
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white/80 px-3 py-4 lg:block">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${linkBase} ${isActive ? 'bg-brand/10 text-brand border border-brand/30' : 'text-slate-700'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
