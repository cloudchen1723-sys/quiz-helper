import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Download, 
  Smartphone, 
  X, 
  Check, 
  ShieldCheck, 
  Share2, 
  Copy, 
  ExternalLink, 
  AlertTriangle, 
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface PWAInstallButtonProps {
  storagePersisted?: boolean;
}

type AndroidBrandTab = 'chrome' | 'huawei' | 'xiaomi' | 'quark';

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ storagePersisted }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInApp, browserType, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeBrand, setActiveBrand] = useState<AndroidBrandTab>(() => {
    if (browserType === 'huawei') return 'huawei';
    if (browserType === 'xiaomi') return 'xiaomi';
    if (browserType === 'quark') return 'quark';
    return 'chrome';
  });

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const input = document.createElement('input');
        input.value = window.location.href;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleButtonClick = async () => {
    // If in WeChat/QQ, always show guide because in-app webviews block install
    if (isInApp) {
      setShowGuide(true);
      return;
    }

    // If install prompt is ready (Android Chrome / Edge / Samsung Internet / Desktop)
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        // Successfully installed
        return;
      }
      if (outcome === 'unsupported') {
        // If the prompt is no longer valid, fallback to guide
        setShowGuide(true);
      }
      return;
    }

    // Default fallback: show guide tailored to device
    setShowGuide(true);
  };

  // If already running in standalone PWA app mode
  if (isInstalled) {
    return (
      <div 
        title="已保存在设备本地 IndexedDB 存储并安装在桌面"
        className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium shadow-2xs"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>已安装至桌面</span>
      </div>
    );
  }

  return (
    <>
      <button
        id="pwa-install-button"
        onClick={handleButtonClick}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          isInstallable && !isInApp
            ? 'bg-amber-500 hover:bg-amber-600 active:scale-98 text-white border-amber-600 shadow-xs'
            : 'bg-transparent hover:bg-black/[0.04] active:bg-black/[0.08] text-black/80 border-black/[0.08]'
        }`}
        title={isInstallable ? '一键安装为独立桌面App' : '添加到手机桌面或主屏幕'}
      >
        {isInstallable && !isInApp ? (
          <>
            <Download className="w-3.5 h-3.5 animate-bounce" />
            <span>安装应用</span>
          </>
        ) : (
          <>
            <Smartphone className="w-3.5 h-3.5 text-amber-600" />
            <span>添加到桌面</span>
          </>
        )}
      </button>

      {/* Detail / Troubleshooting Modal */}
      {showGuide && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuide(false);
          }}
        >
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl border border-stone-100 relative my-auto">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center space-x-2.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  添加到手机主屏幕
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {isIOS ? 'iOS 苹果' : isAndroid ? 'Android 安卓' : '桌面/移动'}
                  </span>
                </h3>
                <p className="text-[11px] text-stone-500">像原生App一样全屏使用，题库离线防丢</p>
              </div>
            </div>

            {/* In-App Webview Warning (WeChat / QQ / DingTalk) */}
            {isInApp && (
              <div className="mb-3.5 p-3 rounded-xl bg-amber-50 border border-amber-300/80 text-amber-950 text-xs">
                <div className="flex items-start gap-2 mb-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>检测到当前在微信/QQ等应用内：</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900 pl-6 mb-2.5">
                  微信和QQ出于安全限制，禁止任何网页直接向手机桌面添加图标。
                </p>
                <div className="pl-6 space-y-1.5 text-[11px] text-amber-950 font-medium">
                  <p>1. 请轻按右上角的 <strong className="px-1 py-0.5 bg-amber-200/70 rounded">···</strong>（三个点）</p>
                  <p>2. 选择 <strong className="px-1 py-0.5 bg-amber-200/70 rounded">在默认浏览器中打开</strong>（如Chrome、华为、小米等浏览器）</p>
                  <p>3. 在外部浏览器中即可秒级添加到桌面！</p>
                </div>
              </div>
            )}

            {/* Device-Specific Instructions */}
            {isIOS ? (
              /* iOS Safari Guide */
              <div className="space-y-2.5 mb-3.5 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                  <p>必须使用苹果自带的 <strong className="text-stone-900 font-semibold">Safari 浏览器</strong> 打开当前网页。</p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                  <p>轻按 Safari 屏幕底部的 <strong className="text-stone-900 font-semibold inline-flex items-center gap-0.5"><Share2 className="w-3 h-3 inline text-amber-600" /> 分享</strong> 按钮。</p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                  <p>在弹出的菜单中向下轻扫，找到并点击 <strong className="text-stone-900 font-semibold">“添加到主屏幕”</strong>。</p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                  <p>轻按右上角的 <strong className="text-stone-900 font-semibold">“添加”</strong>，桌面即可生成专属图标。</p>
                </div>
              </div>
            ) : (
              /* Android Multi-Brand Guide */
              <div className="mb-3.5">
                {/* Brand Tabs */}
                <div className="flex items-center space-x-1 p-1 bg-stone-100 rounded-lg mb-2.5 text-[11px] font-medium text-stone-600">
                  <button
                    onClick={() => setActiveBrand('chrome')}
                    className={`flex-1 py-1 px-2 rounded-md transition-all ${activeBrand === 'chrome' ? 'bg-white text-stone-900 font-semibold shadow-2xs' : 'hover:text-stone-900'}`}
                  >
                    Chrome/Edge
                  </button>
                  <button
                    onClick={() => setActiveBrand('huawei')}
                    className={`flex-1 py-1 px-2 rounded-md transition-all ${activeBrand === 'huawei' ? 'bg-white text-stone-900 font-semibold shadow-2xs' : 'hover:text-stone-900'}`}
                  >
                    华为/荣耀
                  </button>
                  <button
                    onClick={() => setActiveBrand('xiaomi')}
                    className={`flex-1 py-1 px-2 rounded-md transition-all ${activeBrand === 'xiaomi' ? 'bg-white text-stone-900 font-semibold shadow-2xs' : 'hover:text-stone-900'}`}
                  >
                    小米/红米
                  </button>
                  <button
                    onClick={() => setActiveBrand('quark')}
                    className={`flex-1 py-1 px-2 rounded-md transition-all ${activeBrand === 'quark' ? 'bg-white text-stone-900 font-semibold shadow-2xs' : 'hover:text-stone-900'}`}
                  >
                    夸克/其他
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs text-stone-600 space-y-2">
                  {activeBrand === 'chrome' && (
                    <>
                      <div className="flex items-start space-x-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                        <p>点击浏览器右上角的 <strong className="text-stone-900 font-semibold">三个点 (︙)</strong> 菜单。</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                        <p>找到并点击 <strong className="text-stone-900 font-semibold">“安装应用”</strong> 或 <strong className="text-stone-900 font-semibold">“添加到主屏幕”</strong>。</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                        <p>系统将自动在手机桌面生成无浏览器地址栏的独立 App 图标！</p>
                      </div>
                    </>
                  )}

                  {activeBrand === 'huawei' && (
                    <>
                      <div className="flex items-start space-x-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                        <p>用华为/荣耀手机自带的 <strong className="text-stone-900 font-semibold">华为浏览器</strong> 打开本站。</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                        <p>点击底栏或右上角菜单 <strong className="text-stone-900 font-semibold">四个方块/更多</strong> ➔ 选择 <strong className="text-stone-900 font-semibold">“添加到桌面”</strong>。</p>
                      </div>
                    </>
                  )}

                  {activeBrand === 'xiaomi' && (
                    <>
                      <div className="flex items-start space-x-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                        <p>用小米手机自带的 <strong className="text-stone-900 font-semibold">小米浏览器</strong> 打开本站。</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                        <p>点击底栏菜单 <strong className="text-stone-900 font-semibold">三条横线</strong> ➔ <strong className="text-stone-900 font-semibold">添加书签/快捷方式</strong> ➔ 选择 <strong className="text-stone-900 font-semibold">“桌面快捷方式”</strong>。</p>
                      </div>
                    </>
                  )}

                  {activeBrand === 'quark' && (
                    <>
                      <div className="flex items-start space-x-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                        <p>点击浏览器底部菜单 <strong className="text-stone-900 font-semibold">三条横线</strong> ➔ 打开 <strong className="text-stone-900 font-semibold">“工具箱”</strong>。</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                        <p>点击 <strong className="text-stone-900 font-semibold">“添加到手机桌面”</strong>。</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Crucial Android Permission Callout */}
                <div className="mt-2.5 p-2.5 bg-red-50/70 border border-red-200/80 rounded-xl text-[11px] text-red-900 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-red-950 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>⚠️ 重点排查：点击后手机桌面没有图标？</span>
                  </div>
                  <p className="text-stone-600">
                    国产安卓系统默认会拦截浏览器的桌面权限。请打开手机【系统设置】➔【应用管理】➔ 找到你用的浏览器 ➔【权限管理】➔ 开启<strong className="text-red-800 font-semibold">【创建桌面快捷方式】</strong>权限后再次尝试即可成功！
                  </p>
                </div>
              </div>
            )}

            {/* Copy Link Helper */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200 mb-3 text-xs">
              <div className="truncate mr-2 text-stone-500 text-[11px] font-mono select-all">
                {typeof window !== 'undefined' ? window.location.href : ''}
              </div>
              <button
                onClick={handleCopyLink}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-stone-100 active:scale-95 text-stone-800 border border-stone-200 rounded-lg shrink-0 font-medium transition-all shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">已复制网址</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-stone-500" />
                    <span>复制网址</span>
                  </>
                )}
              </button>
            </div>

            {/* Offline Storage Guarantee */}
            <div className="flex items-center space-x-2 text-[11px] text-emerald-700 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200/60 mb-3">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{storagePersisted ? '已为您申请系统最高级存储保护，清理手机缓存时不会被清除。' : '添加到桌面后系统将视为独立App运行，无需重复加载。'}</span>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-98 text-white text-xs font-semibold transition-all shadow-xs"
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
