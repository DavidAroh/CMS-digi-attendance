import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { BookOpen, LogOut } from 'lucide-react';
import { MyCourses } from './MyCourses';
import { AttendanceScanner } from './AttendanceScanner';
import { AttendanceHistory } from './AttendanceHistory';
import type { Database } from '../../lib/database.types';

type Course = Database['public']['Tables']['courses']['Row'];

export function StudentDashboard() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState<'courses' | 'scanner' | 'history'>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCourses = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('course_registrations')
      .select('courses(*)')
      .eq('student_id', profile.id);

    if (error) {
      setError('Failed to load courses');
    } else {
      type RegRow = { courses: Course };
      const rows = data as unknown as RegRow[] | null;
      setCourses(rows?.map((reg) => reg.courses) || []);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Student Portal
                </h1>
                <p className="text-sm text-gray-600">
                  {profile?.full_name} - {profile?.matric_number}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setView('courses')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                view === 'courses'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              My Courses
            </button>
            <button
              onClick={() => setView('scanner')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                view === 'scanner'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Check In
            </button>
            <button
              onClick={() => setView('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                view === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Attendance History
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <>
            {view === 'courses' && <MyCourses courses={courses} />}
            {view === 'scanner' && <AttendanceScanner />}
            {view === 'history' && <AttendanceHistory />}
          </>
        )}
      </main>
    </div>
  );
}
