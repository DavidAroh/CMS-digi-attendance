import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
}

export function QRScanner({ onScan }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setError('');
      hasScanned.current = false;
      if (!window.isSecureContext) {
        setError('Camera requires HTTPS or localhost. Use a secure connection or upload a photo of the QR code.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device. Upload a photo of the QR code instead.');
        return;
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }

      let cameraId: string | undefined;
      try {
        const cameras = await Html5Qrcode.getCameras();
        const preferred = cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[0];
        cameraId = preferred?.id;
      } catch {
        cameraId = undefined;
      }

      // Ensure container is visible before starting to avoid blank view
      setIsScanning(true);

      if (cameraId) {
        await scannerRef.current.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (!hasScanned.current) {
              hasScanned.current = true;
              onScan(decodedText);
              stopScanning();
            }
          },
          () => {}
        );
      } else {
        await scannerRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (!hasScanned.current) {
              hasScanned.current = true;
              onScan(decodedText);
              stopScanning();
            }
          },
          () => {}
        );
      }
    } catch (err) {
      console.error('Error starting scanner:', err);
      const msg = String((err as { message?: string })?.message || err);
      if (/NotAllowedError/i.test(msg)) {
        setError('Camera permission denied. Allow camera access in browser settings or upload a photo of the QR code.');
      } else if (/secure context|https/i.test(msg)) {
        setError('Camera requires HTTPS or localhost. Use a secure connection or upload a photo of the QR code.');
      } else {
        setError('Failed to start camera. Upload a photo of the QR code instead.');
      }
      setIsScanning(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError('');
      hasScanned.current = false;
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }
      const decodedText = await scannerRef.current.scanFile(file, true);
      if (!hasScanned.current) {
        hasScanned.current = true;
        onScan(decodedText);
        stopScanning();
      }
    } catch (err) {
      console.error('Error scanning file:', err);
      setError('Failed to read QR from image. Try a clearer photo.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  return (
    <div className="space-y-4">
      <div
        id="qr-reader"
        className={`rounded-lg overflow-hidden ${
          isScanning ? 'block' : 'hidden'
        }`}
        style={{ minHeight: 280 }}
      ></div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {!isScanning && (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">
            Click the button below to start scanning
          </p>
          <button
            onClick={startScanning}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Camera className="w-5 h-5 mr-2" />
            Start Camera
          </button>
          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
              id="qr-upload"
            />
            <label
              htmlFor="qr-upload"
              className="inline-block px-6 py-3 ml-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 cursor-pointer"
            >
              Upload QR Photo
            </label>
          </div>
        </div>
      )}

      {isScanning && (
        <button
          onClick={stopScanning}
          className="w-full inline-flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          <CameraOff className="w-5 h-5 mr-2" />
          Stop Camera
        </button>
      )}
    </div>
  );
}
