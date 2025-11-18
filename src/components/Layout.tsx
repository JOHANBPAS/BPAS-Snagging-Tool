import React from 'react';
import { Navbar } from './Navbar';
import { SidebarNav } from './SidebarNav';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-bpas-light text-bpas-black">
      <Navbar />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-10">
        <SidebarNav />
        <main className="flex-1 space-y-4">{children}</main>
      </div>
    </div>
  );
};
