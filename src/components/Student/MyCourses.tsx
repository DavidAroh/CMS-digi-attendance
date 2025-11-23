import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { BookOpen, TrendingUp } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Course = Database['public']['Tables']['courses']['Row'];

interface MyCoursesProps {
  courses: Course[];
}

interface CourseWithStats extends Course {
  totalSessions: number;
  attendedSessions: number;
  percentage: number;
}

export function MyCourses({ courses }: MyCoursesProps) {
  const { profile } = useAuth();
  const [coursesWithStats, setCoursesWithStats] = useState<CourseWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCourseStats = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    setError('');
    const stats = await Promise.all(
      courses.map(async (course) => {
        const { count: totalSessions } = await supabase
          .from('attendance_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id)
          .eq('is_active', false);

        const { count: attendedSessions } = await supabase
          .from('attendance_records')
          .select('session_id', { count: 'exact', head: true })
          .eq('student_id', profile.id)
          .in(
            'session_id',
            (
              await supabase
                .from('attendance_sessions')
                .select('id')
                .eq('course_id', course.id)
            ).data?.map((s) => s.id) || []
          );

        const total = totalSessions || 0;
        const attended = attendedSessions || 0;
        const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

        return {
          ...course,
          totalSessions: total,
          attendedSessions: attended,
          percentage,
        };
      })
    );

    setCoursesWithStats(stats);
    setLoading(false);
  }, [courses, profile]);

  useEffect(() => {
    fetchCourseStats();
  }, [fetchCourseStats]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <BookOpen className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
        <p className="text-gray-600">Try again later</p>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No courses registered
        </h3>
        <p className="text-gray-600">
          Contact your administrator to register for courses
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">
        My Courses ({courses.length})
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coursesWithStats.map((course) => (
          <div
            key={course.id}
            className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {course.code}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{course.title}</p>
              </div>
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Department:</span>
                <span className="font-medium text-gray-900">
                  {course.department}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Level:</span>
                <span className="font-medium text-gray-900">{course.level}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Attendance:</span>
                <span className="font-medium text-gray-900">
                  {course.attendedSessions} / {course.totalSessions}
                </span>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Percentage</span>
                  <div className="flex items-center">
                    <TrendingUp className={`w-4 h-4 mr-1 ${
                      course.percentage >= 75 ? 'text-green-600' : 'text-red-600'
                    }`} />
                    <span className={`text-lg font-bold ${
                      course.percentage >= 75 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {course.percentage}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      course.percentage >= 75 ? 'bg-green-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${course.percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
