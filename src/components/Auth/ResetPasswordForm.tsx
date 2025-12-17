import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { KeyRound } from 'lucide-react';

export function ResetPasswordForm() {
  const { completePasswordReset, ensureRecoverySession, requestForgotPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const attemptedRecovery = useRef(false);

  useEffect(() => {
    try {
      const last = localStorage.getItem('last_reset_email') || '';
      if (last) setEmail(last);
    } catch {
      void 0;
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await ensureRecoverySession();
      await completePasswordReset(password);
      setSuccess('Password updated. You can now sign in with your new password.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      if (/Recovery session missing/i.test(msg) && !attemptedRecovery.current) {
        attemptedRecovery.current = true;
        try {
          await ensureRecoverySession();
          await completePasswordReset(password);
          setSuccess('Password updated. You can now sign in with your new password.');
          setError('');
        } catch (e2) {
          setError(e2 instanceof Error ? e2.message : 'Failed to update password');
        }
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-8 mt-20">
      <div className="flex items-center justify-center mb-6">
        <KeyRound className="w-8 h-8 text-blue-600 mr-2" />
        <h2 className="text-2xl font-bold text-gray-800">Reset Password</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm">
            {success}
          </div>
        )}
        {error && /Recovery session missing/i.test(error) && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your account email"
            />
            <button
              type="button"
              disabled={resending || !email}
              onClick={async () => {
                setResending(true);
                try {
                  await requestForgotPassword(email.trim());
                  setSuccess('A new reset link has been sent. Open it from your email.');
                  setError('');
                  try { localStorage.setItem('last_reset_email', email.trim()); } catch { void 0; }
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to send reset link');
                } finally {
                  setResending(false);
                }
              }}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {resending ? 'Sending...' : 'Send New Reset Link'}
            </button>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
