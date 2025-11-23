import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Users } from 'lucide-react';
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
    signature_url: string | null;
  };

  const fetchSessionRecords = async (sessionId: string): Promise<ExportRecord[]> => {
    const { data, error } = await supabase.rpc('get_attendees_for_session', { p_session_id: sessionId });
    if (error) {
      console.error('Error fetching session records:', error);
      return [];
    }
    const rows = (data || []) as unknown as Array<{
      checked_in_at: string;
      check_in_method: ExportRecord['check_in_method'];
      full_name: string | null;
      matric_number: string | null;
      signature_url: string | null;
      signature_name: string | null;
    }>;
    return rows.map((r) => ({
      full_name: r.full_name || 'Unknown',
      matric_number: r.matric_number,
      check_in_method: r.check_in_method,
      checked_in_at: r.checked_in_at,
      signature_url: r.signature_url || (r.signature_name ? supabase.storage.from('signatures').getPublicUrl(r.signature_name).data.publicUrl : null),
    }));
  };

  const toCSV = (records: ExportRecord[]) => {
    const header = ['Full Name', 'Matric Number', 'Method', 'Checked In At', 'Signature'];
    const lines = records.map((r) => [
      r.full_name,
      r.matric_number ?? '',
      r.check_in_method,
      new Date(r.checked_in_at).toLocaleString(),
      r.signature_url ?? '',
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

  const fetchImageDataUrl = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      }).catch(() => null);
    } catch {
      return null;
    }
  };

  const exportExcel = async (session: SessionWithCount) => {
    setExporting(session.id);
    const records = await fetchSessionRecords(session.id);
    const name = `${session.session_name.replace(/\s+/g, '_')}_${new Date(session.started_at).toISOString()}`;
    const rowsHtml = await Promise.all(
      records.map(async (r) => {
        const sig = r.signature_url ? await fetchImageDataUrl(r.signature_url) : null;
        const imgHtml = sig ? `<img src="${sig}" style="height:40px;border:1px solid #ddd;border-radius:4px" />` : '';
        return `<tr>
          <td>${String(r.full_name)}</td>
          <td>${String(r.matric_number ?? '')}</td>
          <td>${String(r.check_in_method)}</td>
          <td>${new Date(r.checked_in_at).toLocaleString()}</td>
          <td>${imgHtml}</td>
        </tr>`;
      })
    );
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name}</title></head><body>
      <table border="1" cellspacing="0" cellpadding="4">
        <thead><tr>
          <th>Full Name</th><th>Matric Number</th><th>Method</th><th>Checked In At</th><th>Signature</th>
        </tr></thead>
        <tbody>
          ${rowsHtml.join('')}
        </tbody>
      </table>
    </body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
    doc.text('Signature', left + 500, top);
    top += 12;
    doc.setLineWidth(0.5);
    doc.line(left, top, 555, top);
    top += 10;
    doc.setFontSize(11);
    const rowHeight = 60;
    for (const r of records) {
      if (top + rowHeight > 770) {
        doc.addPage();
        top = 50;
        doc.setFontSize(12);
        doc.text('Full Name', left, top);
        doc.text('Matric', left + 180, top);
        doc.text('Method', left + 300, top);
        doc.text('Checked In At', left + 380, top);
        doc.text('Signature', left + 500, top);
        top += 12;
        doc.setLineWidth(0.5);
        doc.line(left, top, 555, top);
        top += 10;
        doc.setFontSize(11);
      }
      doc.text(r.full_name, left, top + 20);
      doc.text(r.matric_number ?? '', left + 180, top + 20);
      doc.text(String(r.check_in_method), left + 300, top + 20);
      doc.text(new Date(r.checked_in_at).toLocaleString(), left + 380, top + 20);
      if (r.signature_url) {
        const dataUrl = await fetchImageDataUrl(r.signature_url);
        if (dataUrl) {
          const fmt = /data:image\/png/i.test(dataUrl) ? 'PNG' : 'JPEG';
          doc.addImage(dataUrl, fmt, left + 500, top, 60, 40);
        }
      }
      top += rowHeight;
    }
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
