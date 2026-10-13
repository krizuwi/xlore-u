import { RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const serviceNames = { database: 'Database', assessment: 'Assessment', scraping: 'Catalog collection' };
const statusNames = { healthy: 'Healthy', slow: 'Slow response', warning: 'Needs review', unhealthy: 'Failed', skipped: 'Not tested' };

export function SystemHealthPanel({ health, onRefresh }) {
  const report = health.data;
  const headline = health.loading ? 'Checking services…' : health.error || !report ? 'Health check unavailable' :
    report.status === 'ok' ? 'All checked services operational' : report.status === 'degraded' ? 'Services operational with warnings' : 'Some services are unavailable';
  return <section className="ad-card ad-health" id="system-health">
    <div className="ad-card-heading"><h2>System health</h2><button className="ad-icon-button" type="button" aria-label="Refresh live data" onClick={onRefresh}><RefreshCw size={16} /></button></div>
    <div className={`ad-health-banner${report?.status === 'ok' ? ' is-healthy' : report?.status === 'degraded' ? ' is-warning' : ''}`} role="status">
      <ShieldCheck size={24} /><div><strong>{headline}</strong><span>{health.error || (report ? `Checked ${new Date(report.timestamp).toLocaleTimeString()}. Reports are shared for up to 30 seconds to reduce server load.` : 'Waiting for a health report.')}</span></div>
    </div>
    <ul className="ad-service-list">{Object.entries(report?.checks ?? {}).map(([name, check]) => <li key={name}>
      <span className="ad-service-detail"><strong>{serviceNames[name] ?? name}</strong><small>{check.responseTime} ms</small>{check.reason && <p>{check.reason}</p>}
        {name === 'scraping' && check.status !== 'healthy' && <Link to="/admin/scraping">Review catalog sources</Link>}</span>
      <span className={`ad-service-status is-${check.status}`}>{statusNames[check.status] ?? check.status}</span>
    </li>)}</ul>
    {report && <details className="ad-route-checks"><summary>View API route checks</summary><ul>{Object.entries(report.routes).map(([route, check]) => <li key={route}>
      <code>{route}</code><span>{check.status === 'skipped' ? check.reason : `${statusNames[check.status] ?? check.status} · ${check.responseTime} ms${check.reason ? ` · ${check.reason}` : ''}`}</span>
    </li>)}</ul></details>}
  </section>;
}
