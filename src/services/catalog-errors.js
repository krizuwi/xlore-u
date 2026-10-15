export function catalogFailure(message = '') {
  if (/ScrapeGraphAI (URL extraction|program extraction) timed out/i.test(message)) return {
    code: 'provider_timeout',
    action: 'The hosted scraper exceeded its request limit. Retry later; if this source repeatedly times out, review its page size and the ScrapeGraphAI timeout setting.'
  };
  if (/HTTP (401|403)|robots\.txt policy/i.test(message)) return {
    code: 'access_blocked',
    action: 'The website refused automated access in the selected mode. Review the configured source and university access requirements, or maintain this school manually using its official pages. Increasing the timeout will not fix an HTTP 403.'
  };
  if (/HTTP 404|HTTP 410/i.test(message)) return {
    code: 'source_missing', action: 'Verify the current official page URL before replacing this source.'
  };
  if (/abort|timeout|timed out|HTTP 429|HTTP 5\d\d|fetch failed/i.test(message)) return {
    code: 'temporarily_unavailable', action: 'The source may be temporarily unavailable. Wait before retrying; check the university site and request timeout.'
  };
  if (/No recognizable programs|No usable school profile/i.test(message)) return {
    code: 'content_not_found', action: 'The page did not contain usable catalog information. Review the official page and extraction selector; existing records have been preserved.'
  };
  if (/must use HTTPS|outside the allowed host|does not match|redirect/i.test(message)) return {
    code: 'source_configuration', action: 'Verify the official source configuration. Collection refuses insecure or untrusted redirects; the university may need to correct its website or robots.txt.'
  };
  return { code: 'collection_error', action: 'Review the source URL, school association and collection error before retrying.' };
}
