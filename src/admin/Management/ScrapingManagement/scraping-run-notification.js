export function scrapingRunNotification(result, schoolName) {
  const subject = schoolName || 'the university';
  if (result.skipped) return {
    kind: 'warning', title: 'Collection did not start', detail: result.reason || `No sources were checked for ${subject}.`
  };
  const count = `${result.succeeded ?? 0}/${result.checked ?? 0} sources succeeded`;
  if (result.status === 'completed') return {
    kind: 'success', title: 'Collection complete', detail: `${subject}: ${count}.`
  };
  if (result.status === 'partial') return {
    kind: 'warning', title: 'Collection partially completed', detail: `${subject}: ${count}. Review the failed sources below.`
  };
  return {
    kind: 'error', title: 'Collection failed', detail: `${subject}: ${count}. ${result.errors?.[0] || 'Review the run results for details.'}`
  };
}
