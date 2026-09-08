import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, X, Check, ShieldCheck, Share2 } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface PWAInstallButtonProps {
  storagePersisted?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ storagePersisted }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already installed in standalone PWA mode, show subtle protection badge or hide
  if (isInstalled) {
    return (
      <div 
        title="已保存在设备本地 IndexedDB 存储"
        className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full bg-black/[0.04] text-black/60 border border-black/[0.08] text-[11px] font-medium"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-black/60" />
        <span>已本地储存</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-button"
        onClick={install}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-transparent hover:bg-black/[0.04] active:bg-black/[0.08] text-black/80 text-xs font-medium border border-black/[0.08] transition-colors"
        title="安装为独立应用，防止手机系统清理数据"
      >
        <Download className="w-3.5 h-3.5" />
        <span>安装应用</span>
      </button>
    );
  }

  // iOS Safari flow or generic fallback guide
  return (
    <>
      <button
        id="pwa-install-guide-button"
        onClick={() => setShowGuide(true)}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-transparent hover:bg-black/[0.04] active:bg-black/[0.08] text-black/80 text-xs font-medium border border-black/[0.08] transition-colors"
        title="安装至主屏幕开启永久保护"
      >
        <Smartphone className="w-3.5 h-3.5 text-black/60" />
        <span>添加到桌面</span>
      </button>

      {showGuide && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuide(false);
          }}
        >
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl border border-stone-100 relative my-auto">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2.5 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">添加到手机主屏幕</h3>
                <p className="text-[11px] text-stone-500">开启全屏沉浸与永久防丢保护</p>
              </div>
            </div>

            <div className="space-y-2 my-3 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
              {isIOS ? (
                <>
                  <div className="flex items-start space-x-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <p>在 Safari 底部轻按 <strong className="text-stone-900 font-semibold inline-flex items-center gap-0.5"><Share2 className="w-3 h-3 inline text-amber-600" /> 分享</strong> 按钮。</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <p>在弹出的菜单中下滑，选择 <strong className="text-stone-900 font-semibold">“添加到主屏幕”</strong>。</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <p>点击右上角 <strong className="text-stone-900 font-semibold">“添加”</strong>，桌面即生成专属图标！</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start space-x-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <p>点击浏览器右上角或底部的菜单图标（三个点或横线）。</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <p>找到并点击 <strong className="text-stone-900 font-semibold">“添加到主屏幕”</strong> 或 <strong className="text-stone-900 font-semibold">“安装应用”</strong>。</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-emerald-700 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200/60 mb-3">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{storagePersisted ? '已为您申请最高级存储权限，手机垃圾清理时不会被误删。' : '添加后，系统会将本应用视为独立App，永久保护刷题进度。'}</span>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-98 text-white text-xs font-semibold transition-all"
            >
              我知道了
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
