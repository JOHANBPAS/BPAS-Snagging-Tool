import React from 'react';
import { Navbar } from './Navbar';
import { SidebarNav } from './SidebarNav';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <div className="mx-auto flex max-w-7xl gap-4 px-4 py-4 lg:px-8">
        <SidebarNav />
        <main className="flex-1 space-y-4">{children}</main>
      </div>
    </div>
  );
};
