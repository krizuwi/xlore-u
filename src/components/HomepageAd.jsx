import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ADSENSE_CLIENT, ADSENSE_SLOT, canServeHomepageAd, loadAdSense, requestAd } from '../lib/adsense.js';
import './HomepageAd.css';

function ResponsiveAd() {
  const unit = useRef(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let observer;
    loadAdSense().then(() => {
      if (cancelled) return;
      const initialize = () => {
        if (cancelled) return;
        try {
          if (requestAd(unit.current)) observer?.disconnect();
        } catch {
          observer?.disconnect();
          setUnavailable(true);
        }
      };
      initialize();
      if (!unit.current?.dataset.xloreAdRequested && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(initialize);
        if (unit.current) observer.observe(unit.current);
      }
    }).catch(() => { if (!cancelled) setUnavailable(true); });
    return () => { cancelled = true; observer?.disconnect(); };
  }, []);

  if (unavailable) return null;
  return <aside className="container homepage-ad" aria-label="Advertisement">
    <span className="homepage-ad-label">Advertisement</span>
    <ins ref={unit} className="adsbygoogle" style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT} data-ad-slot={ADSENSE_SLOT}
      data-ad-format="auto" data-full-width-responsive="true" />
  </aside>;
}

export function HomepageAd() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const eligible = canServeHomepageAd({
    enabled: import.meta.env.VITE_ADSENSE_ENABLED,
    production: import.meta.env.PROD,
    hostname: typeof window === 'undefined' ? '' : window.location.hostname,
    pathname, user
  });
  return eligible ? <ResponsiveAd /> : null;
}
