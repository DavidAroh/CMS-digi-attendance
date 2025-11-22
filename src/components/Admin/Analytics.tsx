import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, BookOpen, Calendar, TrendingUp } from 'lucide-react';

interface Stats {
  totalStudents: number;
  totalLecturers: number;
  totalCourses: number;
  totalSessions: number;
  todaySessions: number;
  totalAttendance: number;
}

export function Analytics() {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalLecturers: 0,
    totalCourses: 0,
    totalSessions: 0,
    todaySessions: 0,
    totalAttendance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    const [
      studentsResult,
      lecturersResult,
      coursesResult,
      sessionsResult,
      todaySessionsResult,
      attendanceResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student'),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'lecturer'),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('attendance_sessions').select('*', { count: 'exact', head: true }),
      supabase
        .from('attendance_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', new Date().toISOString().split('T')[0]),
      supabase.from('attendance_records').select('*', { count: 'exact', head: true }),
    ]);

    setStats({
      totalStudents: studentsResult.count || 0,
      totalLecturers: lecturersResult.count || 0,
      totalCourses: coursesResult.count || 0,
      totalSessions: sessionsResult.count || 0,
      todaySessions: todaySessionsResult.count || 0,
      totalAttendance: attendanceResult.count || 0,
    });

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">System Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalStudents}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Lecturers</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalLecturers}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Courses</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalCourses}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sessions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalSessions}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Sessions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.todaySessions}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Attendance</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.totalAttendance}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-teal-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          System Overview
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Student Enrollment</span>
              <span>{stats.totalStudents} users</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{
                  width: `${Math.min((stats.totalStudents / (stats.totalStudents + stats.totalLecturers)) * 100, 100)}%`,
                }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Lecturer Staff</span>
              <span>{stats.totalLecturers} users</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{
                  width: `${Math.min((stats.totalLecturers / (stats.totalStudents + stats.totalLecturers)) * 100, 100)}%`,
                }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Average Attendance per Session</span>
              <span>
                {stats.totalSessions > 0
                  ? Math.round(stats.totalAttendance / stats.totalSessions)
                  : 0}{' '}
                students
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-teal-600 h-2 rounded-full"
                style={{
                  width: `${Math.min((stats.totalAttendance / (stats.totalSessions * stats.totalStudents || 1)) * 100, 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
