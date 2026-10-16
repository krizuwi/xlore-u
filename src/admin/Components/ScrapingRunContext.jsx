import { createContext, useContext, useRef, useState } from 'react';
import { adminWrite } from '../lib/adminApi.js';
import { scrapingRunNotification } from '../Management/ScrapingManagement/scraping-run-notification.js';

const ScrapingRunContext = createContext(null);

export function ScrapingRunProvider({ children }) {
  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [notification, setNotification] = useState(null);
  const [latestRun, setLatestRun] = useState(null);
  const [unread, setUnread] = useState(false);

  async function runCollection(schoolId, schoolName) {
    if (runningRef.current) return null;
    runningRef.current = true;
    setRunning(true);
    const working = { kind: 'working', title: 'Collection is running',
      detail: `Checking ${schoolName}'s enabled sources. This may take a few minutes.` };
    setNotification(working);
    setLatestRun(working);
    setUnread(false);
    try {
      const result = await adminWrite('/scraping/run', 'POST', { schoolId });
      const completed = { ...scrapingRunNotification(result, schoolName), runId: result.runId ?? null };
      setNotification(completed);
      setLatestRun(completed);
      setUnread(true);
      return result;
    } catch (error) {
      const failed = { kind: 'error', title: 'Collection failed', detail: error.message, runId: null };
      setNotification(failed);
      setLatestRun(failed);
      setUnread(true);
      throw error;
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  return <ScrapingRunContext.Provider value={{ running, notification, latestRun, unread,
    runCollection, dismissNotification: () => setNotification(null), markRead: () => setUnread(false) }}>
    {children}
  </ScrapingRunContext.Provider>;
}

export function useScrapingRun() {
  const context = useContext(ScrapingRunContext);
  if (!context) throw new Error('ScrapingRunProvider is missing.');
  return context;
}
