import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';

const Register: React.FC = () => {
  const { signUp, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('architect');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signUp(email, password, fullName, role);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">BPAS Snagging App</p>
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand focus:outline-none"
            >
              <option value="admin">Admin</option>
              <option value="architect">Architect / Site Manager</option>
              <option value="contractor">Contractor</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-bpas-yellow px-4 py-2 text-sm font-semibold text-bpas-black shadow hover:bg-yellow-500 disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
          <div className="text-center text-sm text-slate-600">
            <Link className="font-semibold text-slate-900 hover:text-bpas-yellow transition" to="/login">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
