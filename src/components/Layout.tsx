import React from 'react';
import { Navbar } from './Navbar';
import { SidebarNav } from './SidebarNav';
import { BottomNav } from './BottomNav';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-bpas-light text-bpas-black pb-16 lg:pb-0">
      <Navbar />
      <div className="mx-auto flex max-w-full lg:max-w-7xl gap-6 px-4 py-6 lg:px-10 overflow-x-hidden">
        <SidebarNav />
        <main className="flex-1 space-y-4 w-full max-w-full min-w-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
};
