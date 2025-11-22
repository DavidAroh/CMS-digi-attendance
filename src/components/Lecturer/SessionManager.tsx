import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Plus } from 'lucide-react';
import { CreateSessionModal } from './CreateSessionModal';
import { ActiveSessionView } from './ActiveSessionView';
import { SessionHistory } from './SessionHistory';
import type { Database } from '../../lib/database.types';

type Course = Database['public']['Tables']['courses']['Row'];
type AttendanceSession = Database['public']['Tables']['attendance_sessions']['Row'];

interface SessionManagerProps {
  course: Course;
  onBack: () => void;
}

export function SessionManager({ course, onBack }: SessionManagerProps) {
  useAuth();
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchActiveSession = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('course_id', course.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching active session:', error);
    } else {
      setActiveSession(data);
    }
    setLoading(false);
  }, [course.id]);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  const handleSessionCreated = () => {
    fetchActiveSession();
    setShowCreateModal(false);
  };

  const handleSessionEnded = () => {
    setActiveSession(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Courses
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.code}</h1>
            <p className="text-gray-600">{course.title}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : activeSession ? (
          <ActiveSessionView
            session={activeSession}
            course={course}
            onSessionEnded={handleSessionEnded}
          />
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    No Active Session
                  </h2>
                  <p className="text-gray-600">
                    Start a new attendance session to begin tracking attendance
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Start Session
                </button>
              </div>
            </div>

            <SessionHistory courseId={course.id} />
          </>
        )}
      </main>

      {showCreateModal && (
        <CreateSessionModal
          course={course}
          onClose={() => setShowCreateModal(false)}
          onSessionCreated={handleSessionCreated}
        />
      )}
    </div>
  );
}
