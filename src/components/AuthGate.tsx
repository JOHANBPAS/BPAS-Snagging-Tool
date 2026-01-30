import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getInviteByCode, isInviteCodeValid } from '../services/inviteService';

const AuthGate: React.FC = () => {
  const { signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [shuffledText, setShuffledText] = useState('Welcome back');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'login') return;
    const text = 'Welcome back';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let iteration = 0;
    const interval = setInterval(() => {
      setShuffledText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < iteration) return text[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );
      if (iteration >= text.length) clearInterval(interval);
      iteration += 1 / 3;
    }, 30);
    return () => clearInterval(interval);
  }, [mode]);

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
    <div className="flex min-h-screen items-center justify-center bg-bpas-black px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-50">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-bpas-yellow rounded-full mix-blend-multiply filter blur-xl animate-blob" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000" />
        </div>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-6 shadow-2xl relative z-10">
        <div className="mb-4 text-center space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-bpas-grey font-syne">bpas architects</p>
          <h1 className="text-2xl font-syne font-semibold text-bpas-black">
            {mode === 'login' ? shuffledText : 'Create your account'}
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
            <div className="text-center text-sm font-raleway text-bpas-grey">
              <Link className="text-bpas-yellow hover:text-yellow-500" to="/reset-password">
                Forgot password?
              </Link>
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
