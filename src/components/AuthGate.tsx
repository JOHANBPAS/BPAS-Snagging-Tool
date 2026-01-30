import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getInviteByCode, isInviteCodeValid } from '../services/inviteService';

const AuthGate: React.FC = () => {
  const { signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Unable to sign in.');
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!inviteCode.trim()) {
      setError('Invite code is required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const valid = await isInviteCodeValid(inviteCode);
    if (!valid) {
      setError('Invite code is invalid or already used.');
      return;
    }

    const invite = await getInviteByCode(inviteCode);
    if (invite && invite.email !== email.trim().toLowerCase()) {
      setError('Invite code does not match this email address.');
      return;
    }

    try {
      await signUp(email, password, inviteCode);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Unable to sign up.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bpas-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-6 shadow-2xl">
        <div className="mb-4 text-center space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-bpas-grey font-syne">bpas architects</p>
          <h1 className="text-2xl font-syne font-semibold text-bpas-black">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <div className="mx-auto h-0.5 w-12 bg-bpas-yellow" />
          <p className="text-sm font-raleway text-bpas-grey">
            {mode === 'login'
              ? 'Sign in to manage your projects and snags.'
              : 'Signup is invite-only. Use your code to continue.'}
          </p>
        </div>

        <div className="mb-4 flex items-center justify-center gap-2 text-xs font-raleway">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-full px-3 py-1 ${
              mode === 'login' ? 'bg-bpas-yellow text-bpas-black' : 'bg-bpas-light text-bpas-grey'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-full px-3 py-1 ${
              mode === 'signup' ? 'bg-bpas-yellow text-bpas-black' : 'bg-bpas-light text-bpas-grey'
            }`}
          >
            Sign up
          </button>
        </div>

        {(error || success) && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || success}
          </p>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <label className="space-y-1 text-sm font-raleway">
              <span className="text-bpas-grey">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 focus:border-bpas-yellow focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-sm font-raleway">
              <span className="text-bpas-grey">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-bpas-yellow hover:text-yellow-500"
              >
                Create account
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-3">
            <label className="space-y-1 text-sm font-raleway">
              <span className="text-bpas-grey">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 focus:border-bpas-yellow focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-sm font-raleway">
              <span className="text-bpas-grey">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 focus:border-bpas-yellow focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-sm font-raleway">
              <span className="text-bpas-grey">Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 focus:border-bpas-yellow focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-sm font-raleway">
              <span className="text-bpas-grey">Invite code</span>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 uppercase tracking-widest focus:border-bpas-yellow focus:outline-none"
              />
            </label>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
            <p className="text-center text-sm font-raleway text-bpas-grey">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-bpas-yellow hover:text-yellow-500"
              >
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthGate;
