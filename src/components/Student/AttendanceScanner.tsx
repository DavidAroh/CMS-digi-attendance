import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { decodeSessionData, isSessionExpired } from '../../utils/qrCode';
import { saveOfflineCheckIn, getPendingCheckIns, removeCheckIn } from '../../utils/offlineSync';
import { QrCode, Hash, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';
import { QRScanner } from './QRScanner';

export function AttendanceScanner() {
  const { profile } = useAuth();
  const [mode, setMode] = useState<'qr' | 'pin'>('qr');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const checkPendingCheckIns = useCallback(async () => {
    const pending = await getPendingCheckIns();
    setPendingCount(pending.length);
  }, []);

  const syncPendingCheckIns = useCallback(async () => {
    if (!isOnline) return;

    const pending = await getPendingCheckIns();
    if (pending.length === 0) return;

    for (const checkIn of pending) {
      try {
        const session = await supabase
          .from('attendance_sessions')
          .select('*')
          .eq('id', checkIn.sessionId)
          .eq('qr_token', checkIn.qrToken)
          .maybeSingle();

        if (!session.data) {
          await removeCheckIn(checkIn.id);
          continue;
        }

        await supabase.from('attendance_records').insert({
          session_id: checkIn.sessionId,
          student_id: profile?.id,
          check_in_method: 'offline_qr',
          synced_from_offline: true,
          offline_scanned_at: checkIn.scannedAt,
        });

        await removeCheckIn(checkIn.id);
      } catch (error) {
        console.error('Error syncing check-in:', error);
      }
    }

    checkPendingCheckIns();
    if (pending.length > 0) {
      setMessage({
        type: 'success',
        text: `Successfully synced ${pending.length} offline check-in(s)`,
      });
    }
  }, [isOnline, profile?.id, checkPendingCheckIns]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkPendingCheckIns();
    syncPendingCheckIns();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkPendingCheckIns, syncPendingCheckIns]);

  useEffect(() => {
    if (isOnline) {
      syncPendingCheckIns();
    }
  }, [isOnline, syncPendingCheckIns]);


  const handleQRScan = async (data: string) => {
    if (loading) return;
    setLoading(true);
    setMessage(null);

    try {
      const sessionData = decodeSessionData(data);
      if (!sessionData) {
        setMessage({ type: 'error', text: 'Invalid QR code' });
        setLoading(false);
        return;
      }

      if (isSessionExpired(sessionData.expiresAt)) {
        setMessage({ type: 'error', text: 'This session has expired' });
        setLoading(false);
        return;
      }

      if (!isOnline) {
        await saveOfflineCheckIn({
          sessionId: sessionData.sessionId,
          qrToken: sessionData.qrToken,
          scannedAt: new Date().toISOString(),
          expiresAt: sessionData.expiresAt,
        });
        setMessage({
          type: 'success',
          text: 'Attendance saved offline. Will sync when online.',
        });
        checkPendingCheckIns();
        setLoading(false);
        return;
      }

      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('id', sessionData.sessionId)
        .eq('qr_token', sessionData.qrToken)
        .eq('is_active', true)
        .maybeSingle();

      if (sessionError || !session) {
        setMessage({ type: 'error', text: 'Invalid or expired session' });
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          session_id: session.id,
          student_id: profile?.id,
          check_in_method: 'qr',
        });

      if (insertError) {
        if (insertError.code === '23505') {
          setMessage({ type: 'error', text: 'You have already checked in' });
        } else {
          setMessage({ type: 'error', text: 'Failed to check in' });
        }
      } else {
        setMessage({ type: 'success', text: 'Successfully checked in!' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handlePINSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.rpc('pin_checkin', { p_pin_code: pin });
      const resp: { ok?: boolean; error?: string } | null = data as unknown as { ok?: boolean; error?: string } | null;

      if (error || (resp && resp.error)) {
        const err = resp?.error ?? (typeof error === 'object' && error && 'message' in (error as unknown as { message?: string })
          ? String((error as unknown as { message?: string }).message)
          : 'Failed to check in');
        const text = err === 'duplicate'
          ? 'You have already checked in'
          : err === 'expired'
          ? 'This session has expired'
          : err === 'invalid_pin'
          ? 'Invalid PIN or session expired'
          : String(err);
        setMessage({ type: 'error', text });
      } else {
        setMessage({ type: 'success', text: 'Successfully checked in!' });
        setPin('');
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Check In to Class
          </h2>
          <div className="flex items-center">
            {isOnline ? (
              <div className="flex items-center text-green-600">
                <Wifi className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">Online</span>
              </div>
            ) : (
              <div className="flex items-center text-yellow-600">
                <WifiOff className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">Offline</span>
              </div>
            )}
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              You have {pendingCount} pending check-in(s) waiting to sync.
              {isOnline ? ' Syncing now...' : ' Will sync when online.'}
            </p>
          </div>
        )}

        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setMode('qr')}
            className={`flex-1 flex items-center justify-center py-3 px-4 ${
              mode === 'qr'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500'
            }`}
          >
            <QrCode className="w-5 h-5 mr-2" />
            Scan QR Code
          </button>
          <button
            onClick={() => setMode('pin')}
            className={`flex-1 flex items-center justify-center py-3 px-4 ${
              mode === 'pin'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500'
            }`}
          >
            <Hash className="w-5 h-5 mr-2" />
            Enter PIN
          </button>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-start ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        {mode === 'qr' ? (
          <QRScanner onScan={handleQRScan} />
        ) : (
          <form onSubmit={handlePINSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter 6-digit PIN
              </label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 text-center text-2xl tracking-wider border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || pin.length !== 6 || !isOnline}
              className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {loading ? 'Checking in...' : 'Check In'}
            </button>
            {!isOnline && (
              <p className="text-sm text-yellow-600 text-center">
                PIN check-in requires internet connection
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
