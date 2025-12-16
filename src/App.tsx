import { useState } from 'react';
import { AuthProvider } from './contexts/AuthProvider';
import { useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/Auth/LoginForm';
import { SignUpForm } from './components/Auth/SignUpForm';
import { ResetPasswordForm } from './components/Auth/ResetPasswordForm';
import { StudentDashboard } from './components/Student/StudentDashboard';
import { LecturerDashboard } from './components/Lecturer/LecturerDashboard';
import { AdminDashboard } from './components/Admin/AdminDashboard';

function AuthenticatedApp() {
  const { profile, loading, passwordRecovery } = useAuth();
  const isResetRoute = typeof window !== 'undefined' && window.location.pathname === '/reset';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (passwordRecovery || isResetRoute) {
    return <ResetPasswordForm />;
  }

  if (!profile) {
    return <AuthScreen />;
  }

  switch (profile.role) {
    case 'student':
      return <StudentDashboard />;
    case 'lecturer':
      return <LecturerDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <AuthScreen />;
  }
}

function AuthScreen() {
  const [showSignUp, setShowSignUp] = useState(false);
  const { passwordRecovery } = useAuth();
  const isResetRoute = typeof window !== 'undefined' && window.location.pathname === '/reset';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Digital Attendance System
          </h1>
          <p className="text-blue-100">
            Modern attendance tracking for universities
          </p>
        </div>

        {(passwordRecovery || isResetRoute)
          ? <ResetPasswordForm />
          : showSignUp
            ? <SignUpForm onToggle={() => setShowSignUp(false)} />
            : <LoginForm onToggle={() => setShowSignUp(true)} />
        }
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
