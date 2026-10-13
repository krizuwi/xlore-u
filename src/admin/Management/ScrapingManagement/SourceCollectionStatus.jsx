export function SourceCollectionStatus({ source }) {
  const blocked = source.diagnostic?.code === 'access_blocked';
  return <div>
    <strong>{blocked ? 'Blocked by website' : source.status || 'Not checked'}</strong>
    {source.error && <p>{source.error}</p>}
    {source.diagnostic?.action && <p>{source.diagnostic.action}</p>}
    {blocked && <p>Existing catalog data is retained. Automatic collection has not succeeded for this source.</p>}
  </div>;
}
