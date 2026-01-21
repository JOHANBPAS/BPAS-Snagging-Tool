import React from 'react';
import { useAuth } from '../hooks/useAuth';
// import { CacheDebugger } from '../components/CacheDebugger';

const Settings: React.FC = () => {
  const { signOut, user, profile } = useAuth();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-bpas-grey/20">
        <h2 className="text-xl font-syne font-semibold text-bpas-black mb-4">Account Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Email</label>
            <p className="text-bpas-black font-medium">{user?.email}</p>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Role</label>
            <p className="text-bpas-black font-medium capitalize">{profile?.role || 'User'}</p>
          </div>

          <div className="pt-4">
            <button
              onClick={() => signOut()}
              className="rounded-lg bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Settings;
