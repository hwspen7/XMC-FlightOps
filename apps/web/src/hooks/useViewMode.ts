import { useEffect, useState } from 'react';

export type ViewMode = 'mobile' | 'desktop';

function automaticMode(): ViewMode {
  const isHandset = /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent);
  return isHandset ? 'mobile' : 'desktop';
}

function initialMode(): ViewMode {
  const query = new URLSearchParams(window.location.search).get('view');
  return query === 'mobile' || query === 'desktop' ? query : automaticMode();
}

export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>(initialMode);
  useEffect(() => {
    const onPopState = () => setMode(initialMode());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const changeMode = (next: ViewMode) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', next);
    window.history.replaceState(null, '', url);
    setMode(next);
  };
  return { mode, changeMode };
}
