import React from 'react';
import { useAuth } from '../hooks/useAuth';

const Settings: React.FC = () => {
  const { profile, user } = useAuth();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Profile</p>
        <h3 className="text-xl font-semibold text-slate-900">User settings</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Name</p>
            <p className="text-sm font-semibold text-slate-900">{profile?.full_name}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Email</p>
            <p className="text-sm font-semibold text-slate-900">{user?.email}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Role</p>
            <p className="text-sm font-semibold text-slate-900">{profile?.role}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">User ID</p>
            <p className="text-xs font-mono text-slate-900">{user?.id}</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Support</p>
        <p className="text-sm text-slate-700">Need help? Add FAQs, help links, or support contact here.</p>
      </div>
    </div>
  );
};

export default Settings;
