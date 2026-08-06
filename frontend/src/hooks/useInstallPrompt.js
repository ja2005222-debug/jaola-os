import { useState, useEffect, useCallback } from 'react';

// 📲 تثبيت PWA: يلتقط beforeinstallprompt (Chrome/Edge/Android) ويخفي
// نفسه تلقائياً إن كان التطبيق مثبَّتاً أصلاً (standalone) أو على متصفح
// لا يدعم الحدث (Safari/iOS) — لا زر معطَّل بلا فائدة في تلك الحالات.
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  );

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return { canInstall: !isInstalled && !!deferredPrompt, promptInstall };
}
