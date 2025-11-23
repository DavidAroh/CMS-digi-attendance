import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import type { Database } from '../../lib/database.types';

type AttendanceSession = Database['public']['Tables']['attendance_sessions']['Row'];

interface SessionWithCount extends AttendanceSession {
  attendance_count: number;
}

interface SessionHistoryProps {
  courseId: string;
}

export function SessionHistory({ courseId }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const { data: sessionsData, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_active', false)
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching sessions:', error);
      setLoading(false);
      return;
    }

    const sessionsWithCounts = await Promise.all(
      (sessionsData || []).map(async (session) => {
        const { count } = await supabase
          .from('attendance_records')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id);

        return {
          ...session,
          attendance_count: count || 0,
        };
      })
    );

    setSessions(sessionsWithCounts);
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  type ExportRecord = {
    full_name: string;
    matric_number: string | null;
    check_in_method: Database['public']['Tables']['attendance_records']['Row']['check_in_method'];
    checked_in_at: string;
  };

  const fetchSessionRecords = async (sessionId: string): Promise<ExportRecord[]> => {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(
        `
        checked_in_at,
        check_in_method,
        profiles:student_id (full_name, matric_number)
      `
      )
      .eq('session_id', sessionId)
      .order('checked_in_at', { ascending: true });

    if (error) {
      console.error('Error fetching session records:', error);
      return [];
    }

    const rows = (data || []) as unknown as Array<{
      checked_in_at: string;
      check_in_method: ExportRecord['check_in_method'];
      profiles: { full_name: string; matric_number: string | null };
    }>;

    return rows.map((r) => ({
      full_name: r.profiles.full_name,
      matric_number: r.profiles.matric_number,
      check_in_method: r.check_in_method,
      checked_in_at: r.checked_in_at,
    }));
  };

  const toCSV = (records: ExportRecord[]) => {
    const header = ['Full Name', 'Matric Number', 'Method', 'Checked In At'];
    const lines = records.map((r) => [
      r.full_name,
      r.matric_number ?? '',
      r.check_in_method,
      new Date(r.checked_in_at).toLocaleString(),
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    return csv;
  };

  const downloadBlob = (content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCSV = async (session: SessionWithCount) => {
    setExporting(session.id);
    const records = await fetchSessionRecords(session.id);
    const csv = toCSV(records);
    const name = `${session.session_name.replace(/\s+/g, '_')}_${new Date(session.started_at).toISOString()}`;
    downloadBlob(csv, 'text/csv;charset=utf-8;', `${name}.csv`);
    setExporting(null);
  };

  const exportExcel = async (session: SessionWithCount) => {
    setExporting(session.id);
    const records = await fetchSessionRecords(session.id);
    const data = records.map((r) => ({
      'Full Name': r.full_name,
      'Matric Number': r.matric_number ?? '',
      Method: r.check_in_method,
      'Checked In At': new Date(r.checked_in_at).toLocaleString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const name = `${session.session_name.replace(/\s+/g, '_')}_${new Date(session.started_at).toISOString()}`;
    XLSX.writeFile(wb, `${name}.xlsx`);
    setExporting(null);
  };

  const exportPDF = async (session: SessionWithCount) => {
    setExporting(session.id);
    const records = await fetchSessionRecords(session.id);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const left = 40;
    let top = 50;
    doc.setFontSize(14);
    doc.text(`${session.session_name} (${new Date(session.started_at).toLocaleString()})`, left, top);
    top += 20;
    doc.setFontSize(12);
    doc.text('Full Name', left, top);
    doc.text('Matric', left + 180, top);
    doc.text('Method', left + 300, top);
    doc.text('Checked In At', left + 380, top);
    top += 12;
    doc.setLineWidth(0.5);
    doc.line(left, top, 555, top);
    top += 10;
    doc.setFontSize(11);
    const lineHeight = 16;
    records.forEach((r) => {
      if (top > 770) {
        doc.addPage();
        top = 50;
      }
      doc.text(r.full_name, left, top);
      doc.text(r.matric_number ?? '', left + 180, top);
      doc.text(String(r.check_in_method), left + 300, top);
      doc.text(new Date(r.checked_in_at).toLocaleString(), left + 380, top);
      top += lineHeight;
    });
    const name = `${session.session_name.replace(/\s+/g, '_')}_${new Date(session.started_at).toISOString()}`;
    doc.save(`${name}.pdf`);
    setExporting(null);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Recent Sessions
      </h3>

      {sessions.length === 0 ? (
        <p className="text-center py-8 text-gray-500">No past sessions</p>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {session.session_name}
                  </h4>
                  <div className="flex items-center text-sm text-gray-600 mt-2">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(session.started_at).toLocaleDateString()} at{' '}
                    {new Date(session.started_at).toLocaleTimeString()}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-blue-50 px-3 py-2 rounded-lg">
                    <Users className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-900">
                      {session.attendance_count} students
                    </span>
                  </div>
                  <button
                    onClick={() => exportCSV(session)}
                    disabled={exporting === session.id}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100"
                    title="Download CSV"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => exportExcel(session)}
                    disabled={exporting === session.id}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100"
                    title="Download Excel"
                  >
                    Excel
                  </button>
                  <button
                    onClick={() => exportPDF(session)}
                    disabled={exporting === session.id}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100"
                    title="Download PDF"
                  >
                    PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
