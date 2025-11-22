import { BookOpen } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Course = Database['public']['Tables']['courses']['Row'];

interface CourseListProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
}

export function CourseList({ courses, onSelectCourse }: CourseListProps) {
  if (courses.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No courses yet
        </h3>
        <p className="text-gray-600">
          Create your first course to start managing attendance
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map((course) => (
        <div
          key={course.id}
          onClick={() => onSelectCourse(course)}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-blue-600"
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

          <div className="space-y-2">
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
              <span className="text-gray-600">Semester:</span>
              <span className="font-medium text-gray-900">
                {course.semester}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
