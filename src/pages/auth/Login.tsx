import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const Login: React.FC = () => {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signIn(email, password);
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
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-600">Sign in to manage your projects and snags.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
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
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div className="flex justify-between text-sm text-slate-600">
            <Link className="text-brand" to="/reset-password">
              Forgot password?
            </Link>
            <Link className="text-brand" to="/register">
              Create account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
