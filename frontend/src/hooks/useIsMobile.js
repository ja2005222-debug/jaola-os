import { useState, useEffect } from 'react';

// كشف الشاشات الصغيرة — يتفاعل مع تدوير الجهاز وتغيير حجم النافذة
export function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isMobile;
}
