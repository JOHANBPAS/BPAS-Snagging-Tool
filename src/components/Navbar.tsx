import React from 'react';
import { Link } from 'react-router-dom';
import { brandAssets } from '../lib/brand';
import { useAuth } from '../hooks/useAuth';

export const Navbar: React.FC = () => {
  const { signOut, profile, isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-bpas-grey/30 bg-bpas-black text-white shadow">
      <div className="flex items-center justify-between px-4 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
            <img
              src={brandAssets.logoLight}
              alt="BPAS"
              className="h-10 w-10 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="sr-only">BPAS</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-bpas-light font-syne">BPAS architects</p>
            <p className="text-sm font-raleway text-white/80">Beyond blueprints and boundaries.</p>
            <span className="mt-1 inline-block h-0.5 w-12 bg-bpas-yellow" />
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-raleway text-white">
          {profile && (
            <span className="hidden sm:block text-white/80">
              {profile.full_name} ({profile.role})
            </span>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                window.location.href = '/?admin=true';
              }}
              className="rounded-full border border-bpas-yellow/60 px-3 py-1 text-xs font-syne text-bpas-yellow hover:bg-bpas-yellow/10"
            >
              Admin Panel
            </button>
          )}
          <Link to="/settings" className="font-syne text-bpas-yellow hover:text-yellow-400">
            Settings
          </Link>
          <button onClick={signOut} className="btn-secondary px-4 py-2">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};
