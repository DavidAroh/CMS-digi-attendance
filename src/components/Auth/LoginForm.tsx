import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { LogIn } from "lucide-react";

export function LoginForm({ onToggle }: { onToggle: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, requestForgotPassword } = useAuth();
  const [showForgot, setShowForgot] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
      <div className="flex items-center justify-center mb-6">
        <LogIn className="w-8 h-8 text-blue-600 mr-2" />
        <h2 className="text-2xl font-bold text-gray-800">Sign In</h2>
      </div>

      {showForgot ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setSuccess("");
            setLoading(true);
            try {
              await requestForgotPassword(email);
              setSuccess("Check your email for a link to reset your password.");
              try { localStorage.setItem('last_reset_email', email.trim()); } catch { void 0; }
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Failed to send reset email"
              );
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {loading ? "Sending..." : "Send Sign-In Link"}
          </button>
          <p className="mt-2 text-center text-sm text-gray-600">
            Remembered your password?{" "}
            <button
              type="button"
              onClick={() => {
                setShowForgot(false);
                setError("");
                setSuccess("");
              }}
              className="text-blue-600 hover:underline font-medium"
            >
              Back to Sign in
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-gray-600">
        Don't have an account?{" "}
        <button
          onClick={onToggle}
          className="text-blue-600 hover:underline font-medium"
        >
          Sign up
        </button>
      </p>
      <p className="mt-2 text-center text-sm text-gray-600">
        <button
          type="button"
          onClick={() => {
            setShowForgot(true);
            setError("");
            setSuccess("");
          }}
          className="text-blue-600 hover:underline font-medium"
        >
          Forgot password?
        </button>
      </p>
    </div>
  );
}
