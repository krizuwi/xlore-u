export const ADSENSE_CLIENT = 'ca-pub-8222864305978009';
export const ADSENSE_SLOT = '3234621623';
export const ADSENSE_SCRIPT_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

// This switch controls the manual unit, not the head script or Google's Auto ads.
export function canServeHomepageAd({ enabled, production, hostname, pathname, user }) {
  return enabled === 'true' && production === true && !user && pathname === '/'
    && ['www.xloreu.com', 'xloreu.com'].includes(hostname);
}

let scriptPromise;
export function loadAdSense(documentObject = document) {
  // Google's queue accepts pushes before the async verification script loads.
  // Reuse it instead of downloading the publisher script a second time.
  if (documentObject.querySelector?.(`script[src="${ADSENSE_SCRIPT_URL}"]`)) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = documentObject.createElement('script');
    script.id = 'xlore-adsense-script';
    script.async = true;
    script.src = ADSENSE_SCRIPT_URL;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      scriptPromise = undefined;
      reject(new Error('AdSense unavailable'));
    };
    documentObject.head.appendChild(script);
  });
  return scriptPromise;
}

export function requestAd(element, browserWindow = window) {
  if (!element?.isConnected || element.getBoundingClientRect().width <= 0
      || element.dataset.xloreAdRequested || element.dataset.adsbygoogleStatus) return false;
  // Mark before pushing: React StrictMode must not queue the same unit twice.
  element.dataset.xloreAdRequested = 'true';
  (browserWindow.adsbygoogle = browserWindow.adsbygoogle || []).push({});
  return true;
}
