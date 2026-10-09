export const IDLE_NOTICE_MS = 20 * 60 * 1000;
export const LIVE_REFRESH_MS = 15 * 1000;

export function isIdleNoticeEnabled(pathname) {
  return !/^\/admin(?:\/|$)/.test(pathname);
}

// Timers measure elapsed time, not interval ticks (background tabs may throttle).
export function createEngagementMonitor({ onIdle, onResume, onRefresh, now = Date.now, timers = globalThis, idleMs = IDLE_NOTICE_MS, refreshMs = LIVE_REFRESH_MS, idleEnabled = true }) {
  let lastActivity = now(), idle = false, stopped = true, idleTimer, refreshTimer;
  function check() {
    if (stopped || idle || !idleEnabled) return;
    timers.clearTimeout(idleTimer);
    const remaining = idleMs - (now() - lastActivity);
    if (remaining <= 0) { idle = true; onIdle(); }
    else idleTimer = timers.setTimeout(check, remaining);
  }
  return {
    start() {
      if (!stopped) return;
      stopped = false; lastActivity = now(); idle = false;
      if (idleEnabled) idleTimer = timers.setTimeout(check, idleMs);
      refreshTimer = timers.setInterval(() => { check(); if (!idle) onRefresh(); }, refreshMs);
    },
    activity() { if (!stopped && !idle) lastActivity = now(); },
    check,
    resume() {
      if (stopped) return;
      idle = false; lastActivity = now(); timers.clearTimeout(idleTimer);
      if (idleEnabled) idleTimer = timers.setTimeout(check, idleMs);
      onResume(); onRefresh();
    },
    stop() { stopped = true; timers.clearTimeout(idleTimer); timers.clearInterval(refreshTimer); }
  };
}

export function canRefreshPage({ visible, pathname, editing, dialogOpen, submitting }) {
  return visible && !editing && !dialogOpen && !submitting &&
    !/^\/(?:assessment(?:\/|$)|profile(?:\/|$)|login(?:\/|$)|register(?:\/|$)|admin\/(?:login|settings)(?:\/|$))/.test(pathname);
}

export function createRefreshTask(getCallback) {
  let running = false, disposed = false, controller;
  return {
    async run() {
      if (running || disposed) return;
      running = true; controller = new AbortController();
      try { await getCallback()(controller.signal); }
      catch { /* Keep the last loaded data when a background request fails. */ }
      finally { running = false; }
    },
    stop() { disposed = true; controller?.abort(); }
  };
}
