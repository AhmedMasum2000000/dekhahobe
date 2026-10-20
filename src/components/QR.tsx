import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QR({ value, size = 240, className = '' }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: 'M', color: { dark: '#0A0A0A', light: '#FFFFFF' } }).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [value, size]);
  return src ? <img src={src} width={size} height={size} alt="Ticket QR code" className={className} data-qr={value} /> : <div style={{ width: size, height: size }} className={`animate-pulse rounded-xl bg-mist ${className}`} />;
}
