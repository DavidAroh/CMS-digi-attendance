import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Calendar, CheckCircle } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row'] & {
  attendance_sessions: {
    session_name: string;
    started_at: string;
    courses: {
      code: string;
      title: string;
    };
  };
};

export function AttendanceHistory() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAttendanceHistory = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('attendance_records')
      .select(
        `
        *,
        attendance_sessions!inner (
          session_name,
          started_at,
          courses!inner (
            code,
            title
          )
        )
      `
      )
      .eq('student_id', profile.id)
      .order('checked_in_at', { ascending: false });

    if (error) {
      setError('Failed to load attendance history');
    } else {
      setRecords(data as AttendanceRecord[]);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Attendance History
      </h2>

      {error ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
          <p className="text-gray-600">Try again later</p>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No attendance records
          </h3>
          <p className="text-gray-600">
            Your attendance history will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div
              key={record.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <h3 className="font-medium text-gray-900">
                      {record.attendance_sessions.courses.code} -{' '}
                      {record.attendance_sessions.session_name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    {record.attendance_sessions.courses.title}
                  </p>
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(record.checked_in_at).toLocaleDateString()} at{' '}
                    {new Date(record.checked_in_at).toLocaleTimeString()}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      record.check_in_method === 'qr'
                        ? 'bg-green-100 text-green-800'
                        : record.check_in_method === 'offline_qr'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {record.check_in_method === 'qr'
                      ? 'QR Code'
                      : record.check_in_method === 'offline_qr'
                      ? 'Offline QR'
                      : 'PIN'}
                  </span>
                  {record.synced_from_offline && (
                    <span className="text-xs text-gray-500 mt-1">
                      Synced from offline
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
