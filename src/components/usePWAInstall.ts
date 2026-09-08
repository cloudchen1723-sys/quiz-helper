import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __pwa_deferred_prompt?: BeforeInstallPromptEvent | null;
  }
}

export type DetectedBrowser = 'wechat' | 'qq' | 'huawei' | 'xiaomi' | 'quark' | 'chrome' | 'edge' | 'safari' | 'other';

// Capture event globally at module load to avoid losing prompt fired before React mount
let moduleDeferredPrompt: BeforeInstallPromptEvent | null =
  typeof window !== 'undefined' ? window.__pwa_deferred_prompt || null : null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    moduleDeferredPrompt = e as BeforeInstallPromptEvent;
    window.__pwa_deferred_prompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('pwa-prompt-ready'));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => moduleDeferredPrompt || (typeof window !== 'undefined' ? window.__pwa_deferred_prompt || null : null)
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInApp, setIsInApp] = useState(false);
  const [browserType, setBrowserType] = useState<DetectedBrowser>('other');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode (already installed on home screen / desktop)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();

    // OS Detection
    const ios = /iphone|ipad|ipod/.test(ua);
    const android = /android/.test(ua);
    setIsIOS(ios);
    setIsAndroid(android);

    // In-app browsers detection (WeChat, QQ, DingTalk, Weibo)
    const inApp = /micromessenger|wechat|qq\/|dingtalk|alipay|weibo|toutiao/.test(ua);
    setIsInApp(inApp);

    // Specific browser detection
    if (/micromessenger/.test(ua)) {
      setBrowserType('wechat');
    } else if (/qq\//.test(ua)) {
      setBrowserType('qq');
    } else if (/huaweibrowser|hbpc/.test(ua)) {
      setBrowserType('huawei');
    } else if (/miuibrowser/.test(ua)) {
      setBrowserType('xiaomi');
    } else if (/quark/.test(ua)) {
      setBrowserType('quark');
    } else if (/edga|edg\/|edge/.test(ua)) {
      setBrowserType('edge');
    } else if (/chrome|crios/.test(ua)) {
      setBrowserType('chrome');
    } else if (/safari/.test(ua) && !/chrome|crios/.test(ua)) {
      setBrowserType('safari');
    } else {
      setBrowserType('other');
    }

    // Handlers for install events
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      moduleDeferredPrompt = promptEvent;
      window.__pwa_deferred_prompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handlePromptReady = () => {
      if (moduleDeferredPrompt || window.__pwa_deferred_prompt) {
        setDeferredPrompt(moduleDeferredPrompt || window.__pwa_deferred_prompt || null);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      moduleDeferredPrompt = null;
      if (window.__pwa_deferred_prompt) {
        window.__pwa_deferred_prompt = null;
      }
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    const promptEvent = deferredPrompt || moduleDeferredPrompt || (typeof window !== 'undefined' ? window.__pwa_deferred_prompt : null);
    if (!promptEvent) {
      return 'unsupported';
    }

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        moduleDeferredPrompt = null;
        if (typeof window !== 'undefined') window.__pwa_deferred_prompt = null;
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unsupported';
    }
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isInApp,
    browserType,
    install,
  };
}
