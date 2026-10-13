import { assertTrustedUrl } from './robots.js';

export function assertSchoolSourceOwnership(source) {
  if (!source.official_website_url) return;
  try {
    const official = new URL(source.official_website_url);
    if (!['http:', 'https:'].includes(official.protocol)) throw new Error('Invalid website');
    // Legacy school website metadata may be HTTP. This is a hostname check,
    // not a fetch; the actual catalog request still requires HTTPS.
    official.protocol = 'https:';
    assertTrustedUrl(official.toString(), source.allowed_host);
  }
  catch { throw new Error("Catalog source domain does not match the school's official website. Verify the school association before collecting data."); }
}
