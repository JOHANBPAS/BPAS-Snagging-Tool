import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const Navbar: React.FC = () => {
  const { signOut, profile } = useAuth();

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold">BP</div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">BPAS Snagging App</p>
            <p className="text-sm text-slate-700">Digital snagging & handover</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-700">
          {profile && <span className="hidden sm:block">{profile.full_name} ({profile.role})</span>}
          <Link to="/settings" className="hover:text-brand">Settings</Link>
          <button
            onClick={signOut}
            className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};
