import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div 
      id="pwa-offline-indicator"
      className="fixed bottom-4 left-4 z-50 flex items-center space-x-2 rounded-xl bg-stone-900/90 text-amber-400 backdrop-blur-md px-3.5 py-2 text-xs font-medium border border-stone-700 shadow-lg animate-in slide-in-from-bottom-2"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
      <span className="text-stone-200">离线模式 — 使用本地已缓存题库</span>
    </div>
  );
};
