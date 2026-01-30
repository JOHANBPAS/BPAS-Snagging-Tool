import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  createInvite,
  deleteInvite,
  listAllInvites,
  listPendingInvites,
  Invite
} from '../services/inviteService';
import {
  deleteUser,
  demoteUserFromAdmin,
  listAllProfiles,
  promoteUserToAdmin
} from '../services/adminUserService';
import { Profile } from '../types';

const AdminPanel: React.FC = () => {
  const { isAdmin } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allInvites, pending, allProfiles] = await Promise.all([
        listAllInvites(),
        listPendingInvites(),
        listAllProfiles()
      ]);
      setInvites(allInvites);
      setPendingInvites(pending);
      setProfiles(allProfiles);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const handleCreateInvite = async () => {
    setError(null);
    setMessage(null);
    if (!emailInput.trim()) {
      setError('Email is required to create an invite.');
      return;
    }

    try {
      const invite = await createInvite(emailInput);
      setMessage(`Invite created for ${invite.email}`);
      setEmailInput('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create invite.');
    }
  };

  const handleCopyCode = async (code: string) => {
    setMessage(null);
    setError(null);
    try {
      await navigator.clipboard.writeText(code);
      setMessage('Invite code copied to clipboard.');
    } catch (err: any) {
      setError('Unable to copy invite code.');
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    setError(null);
    setMessage(null);
    if (!window.confirm('Delete this invite?')) return;

    try {
      await deleteInvite(inviteId);
      setMessage('Invite deleted.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete invite.');
    }
  };

  const handlePromote = async (userId: string) => {
    setError(null);
    setMessage(null);
    try {
      await promoteUserToAdmin(userId);
      setMessage('User promoted to admin. They must re-login to refresh access.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to promote user.');
    }
  };

  const handleDemote = async (userId: string) => {
    setError(null);
    setMessage(null);
    try {
      await demoteUserFromAdmin(userId);
      setMessage('User demoted to standard. They must re-login to refresh access.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to demote user.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setError(null);
    setMessage(null);
    if (!window.confirm('Delete this user and all associated data?')) return;

    try {
      await deleteUser(userId);
      setMessage('User deleted.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-bpas-black text-white flex items-center justify-center">
        <p className="text-sm font-raleway">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bpas-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-bpas-grey font-syne">Admin Panel</p>
            <h1 className="text-3xl font-syne font-semibold">Manage invites and users</h1>
          </div>
          <button
            onClick={() => {
              window.location.href = '/dashboard';
            }}
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-syne text-white hover:bg-white/20"
          >
            ← Back to App
          </button>
        </div>

        {(message || error) && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              error ? 'bg-rose-900/60 text-rose-100' : 'bg-emerald-900/60 text-emerald-100'
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white/95 p-5 text-bpas-black shadow">
            <h2 className="text-lg font-syne font-semibold">Invites</h2>
            <p className="text-sm text-bpas-grey">Create and manage invite codes.</p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                type="email"
                placeholder="email@example.com"
                className="flex-1 rounded-lg border border-bpas-grey/30 px-3 py-2"
              />
              <button onClick={handleCreateInvite} className="btn-primary px-4 py-2">
                Create invite
              </button>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold">Pending Invites</h3>
              <div className="mt-2 space-y-2">
                {pendingInvites.length === 0 && (
                  <p className="text-sm text-bpas-grey">No pending invites.</p>
                )}
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col gap-2 rounded-lg border border-bpas-grey/20 bg-bpas-light px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <p className="font-mono text-bpas-grey">{invite.code}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyCode(invite.code)}
                        className="rounded-md border border-bpas-grey/40 px-3 py-1 text-xs"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => handleDeleteInvite(invite.id)}
                        className="rounded-md border border-rose-500/60 px-3 py-1 text-xs text-rose-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold">All Invites</h3>
              <div className="mt-2 max-h-64 space-y-2 overflow-auto">
                {invites.length === 0 && <p className="text-sm text-bpas-grey">No invites yet.</p>}
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between rounded-lg border border-bpas-grey/20 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-bpas-grey">{invite.code}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                        invite.status === 'pending'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-emerald-200 text-emerald-900'
                      }`}
                    >
                      {invite.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white/95 p-5 text-bpas-black shadow">
            <h2 className="text-lg font-syne font-semibold">Users</h2>
            <p className="text-sm text-bpas-grey">Manage admin access and accounts.</p>

            <div className="mt-4 space-y-3">
              {profiles.length === 0 && <p className="text-sm text-bpas-grey">No users found.</p>}
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex flex-col gap-2 rounded-lg border border-bpas-grey/20 bg-bpas-light px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{profile.full_name || profile.email || profile.id}</p>
                      <p className="text-xs text-bpas-grey">{profile.email || 'No email'}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] uppercase ${
                        profile.role === 'admin'
                          ? 'bg-bpas-yellow text-bpas-black'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {profile.role}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.role !== 'admin' && (
                      <button
                        onClick={() => handlePromote(profile.id)}
                        className="rounded-md border border-bpas-grey/40 px-3 py-1 text-xs"
                      >
                        Promote
                      </button>
                    )}
                    {profile.role === 'admin' && (
                      <button
                        onClick={() => handleDemote(profile.id)}
                        className="rounded-md border border-bpas-grey/40 px-3 py-1 text-xs"
                      >
                        Demote
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteUser(profile.id)}
                      className="rounded-md border border-rose-500/60 px-3 py-1 text-xs text-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 text-white">
          <div className="rounded-full border-2 border-white px-4 py-2 text-sm">Loading...</div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
