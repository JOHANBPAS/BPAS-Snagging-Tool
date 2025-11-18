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
    <div className="flex min-h-screen items-center justify-center bg-bpas-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-6 shadow-2xl">
        <div className="mb-4 text-center space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-bpas-grey font-syne">bpas architects</p>
          <h1 className="text-2xl font-syne font-semibold text-bpas-black">Welcome back</h1>
          <div className="mx-auto h-0.5 w-12 bg-bpas-yellow" />
          <p className="text-sm font-raleway text-bpas-grey">Sign in to manage your projects and snags.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <label className="space-y-1 text-sm font-raleway">
            <span className="text-bpas-grey">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 focus:border-bpas-yellow focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm font-raleway">
            <span className="text-bpas-grey">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 focus:border-bpas-yellow focus:outline-none"
            />
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div className="flex justify-between text-sm font-raleway text-bpas-grey">
            <Link className="text-bpas-yellow hover:text-yellow-500" to="/reset-password">
              Forgot password?
            </Link>
            <Link className="text-bpas-yellow hover:text-yellow-500" to="/register">
              Create account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
