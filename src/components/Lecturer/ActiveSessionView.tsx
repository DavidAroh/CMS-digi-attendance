import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { encodeSessionData } from '../../utils/qrCode';
import QRCode from 'qrcode';
import { Clock, Users, Key, StopCircle } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Course = Database['public']['Tables']['courses']['Row'];
type AttendanceSession = Database['public']['Tables']['attendance_sessions']['Row'];
type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row'] & {
  profiles?: {
    full_name: string;
    matric_number: string | null;
    signature_url: string | null;
  };
};

interface ActiveSessionViewProps {
  session: AttendanceSession;
  course: Course;
  onSessionEnded: () => void;
}

export function ActiveSessionView({
  session,
  course,
  onSessionEnded,
}: ActiveSessionViewProps) {
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([]);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateQRCode = useCallback(async () => {
    const data = encodeSessionData(
      session.id,
      session.qr_token,
      session.expires_at
    );

    const canvas = canvasRef.current;
    if (canvas) {
      await QRCode.toCanvas(canvas, data, {
        width: 300,
        margin: 2,
      });
    }

    await QRCode.toDataURL(data, { width: 300 });
  }, [session.id, session.qr_token, session.expires_at]);

  const fetchAttendees = useCallback(async () => {
    setIsFetching(true);
    const { data, error } = await supabase.rpc('get_attendees_for_session', { p_session_id: session.id });
    if (error) {
      console.error('Error fetching attendees:', error);
      setIsFetching(false);
      return;
    }
    let merged = (data || []).map((row: {
      id: string;
      session_id: string;
      student_id: string;
      checked_in_at: string;
      check_in_method: 'QR' | 'PIN';
      synced_from_offline: boolean | null;
      offline_scanned_at: string | null;
      full_name: string | null;
      matric_number: string | null;
      signature_url: string | null;
      signature_name: string | null;
    }) => ({
      id: row.id,
      session_id: row.session_id,
      student_id: row.student_id,
      checked_in_at: row.checked_in_at,
      check_in_method: row.check_in_method,
      synced_from_offline: row.synced_from_offline,
      offline_scanned_at: row.offline_scanned_at,
      profiles: {
        full_name: row.full_name || 'Unknown',
        matric_number: row.matric_number || null,
        signature_url: row.signature_url || (row.signature_name ? supabase.storage.from('signatures').getPublicUrl(row.signature_name).data.publicUrl : null),
      },
    })) as AttendanceRecord[];

    const missingSigIds = merged.filter(m => !m.profiles?.signature_url).map(m => m.student_id);
    if (missingSigIds.length > 0) {
      const { data: sigObjs } = await supabase
        .from('storage.objects')
        .select('name, owner, created_at')
        .eq('bucket_id', 'signatures')
        .in('owner', missingSigIds);
      if (sigObjs && Array.isArray(sigObjs)) {
        const latestByOwner: Record<string, { name: string; created_at: string }> = {};
        for (const o of sigObjs as { name: string; owner: string; created_at: string }[]) {
          if (!latestByOwner[o.owner] || new Date(o.created_at) > new Date(latestByOwner[o.owner].created_at)) {
            latestByOwner[o.owner] = { name: o.name, created_at: o.created_at };
          }
        }
        merged = await Promise.all(
          merged.map(async (m) => {
            if (!m.profiles?.signature_url) {
              const obj = latestByOwner[m.student_id];
              if (obj) {
                const url = supabase.storage.from('signatures').getPublicUrl(obj.name).data.publicUrl;
                return { ...m, profiles: { ...m.profiles!, signature_url: url } };
              }
            }
            return m;
          })
        );
      }

      const stillMissing = merged.filter(m => !m.profiles?.signature_url);
      if (stillMissing.length > 0) {
        merged = await Promise.all(
          merged.map(async (m) => {
            if (!m.profiles?.signature_url) {
              const list = await supabase.storage.from('signatures').list('', { search: m.student_id, limit: 10 });
              const entry = (list.data || []).sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime())[0];
              if (entry) {
                const url = supabase.storage.from('signatures').getPublicUrl(entry.name).data.publicUrl;
                return { ...m, profiles: { ...m.profiles!, signature_url: url } };
              }
            }
            return m;
          })
        );
      }
    }
    setAttendees(merged);
    setLastUpdated(new Date().toLocaleTimeString());
    setIsFetching(false);
  }, [session.id]);

  const subscribeToAttendance = useCallback(() => {
    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_records',
          filter: `session_id=eq.${session.id}`,
        },
        () => {
          fetchAttendees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id, fetchAttendees]);

  const updateTimeRemaining = useCallback(() => {
    const now = new Date();
    const expires = new Date(session.expires_at);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeRemaining('Expired');
      return;
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
  }, [session.expires_at]);

  useEffect(() => {
    generateQRCode();
    fetchAttendees();
    const unsubscribe = subscribeToAttendance();
    const interval = setInterval(updateTimeRemaining, 1000);
    const pollInterval = setInterval(fetchAttendees, 5000);
    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
      unsubscribe();
    };
  }, [generateQRCode, fetchAttendees, subscribeToAttendance, updateTimeRemaining]);


  const handleEndSession = async () => {
    const { error } = await supabase
      .from('attendance_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (error) {
      console.error('Error ending session:', error);
    } else {
      onSessionEnded();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {session.session_name}
            </h2>
            <p className="text-gray-600 mt-1">{course.code}</p>
          </div>
          <button
            onClick={handleEndSession}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            <StopCircle className="w-4 h-4 mr-2" />
            End Session
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center p-4 bg-blue-50 rounded-lg">
            <Clock className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Time Remaining</p>
              <p className="text-xl font-bold text-gray-900">{timeRemaining}</p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-green-50 rounded-lg">
            <Users className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Attendees</p>
              <p className="text-xl font-bold text-gray-900">
                {attendees.length}
              </p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-yellow-50 rounded-lg">
            <Key className="w-8 h-8 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">PIN Code</p>
              <p className="text-xl font-bold text-gray-900">
                {session.pin_code}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="text-center">
            <canvas ref={canvasRef} className="mx-auto mb-2"></canvas>
            <p className="text-sm text-gray-600">
              Students can scan this QR code to check in
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Attendance List ({attendees.length})
          </h3>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-500">Last updated: {lastUpdated || '—'}</span>
            <button
              onClick={fetchAttendees}
              disabled={isFetching}
              className="px-3 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm disabled:opacity-60"
            >
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matric</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signature
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendees.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {record.profiles?.full_name || (record.student_id ? record.student_id.slice(0, 8) : '')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-600">{record.profiles?.matric_number ?? '—'}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.profiles?.signature_url ? (
                      <div className="flex items-center space-x-3">
                        <img
                          src={record.profiles.signature_url}
                          alt="Signature"
                          className="h-12 w-auto border border-gray-200 rounded"
                        />
                       </div>
                    ) : (
                      <span className="text-gray-400 text-sm">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        record.check_in_method === 'qr'
                          ? 'bg-green-100 text-green-800'
                          : record.check_in_method === 'offline_qr'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {record.check_in_method === 'qr'
                        ? 'QR'
                        : record.check_in_method === 'offline_qr'
                        ? 'Offline QR'
                        : 'PIN'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(record.checked_in_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {attendees.length === 0 && (
            <p className="text-center py-8 text-gray-500">
              No students have checked in yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
