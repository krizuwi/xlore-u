// Read public, official pages only. This does not import data or bypass access controls.
import { load } from 'cheerio';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = process.env.RESEARCH_EVIDENCE_DIR;
await Promise.all(process.argv.slice(2).map(async url => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) { console.log(JSON.stringify({ url, status: response.status })); return; }
    const html = await response.text();
    const jq = load(html);
    const links = jq('a').map((_index, element) => ({ title: jq(element).text().trim(), href: jq(element).attr('href') })).get();
    jq('script,style').remove();
    const body = jq('body').text().replace(/\s+/g, ' ').trim();
    const record = { url, finalUrl: response.url, checkedAt: new Date().toISOString(), status: response.status, title: jq('title').text(), body, links };
    if (directory) {
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(`${directory}/${createHash('sha256').update(url).digest('hex').slice(0, 16)}.json`, JSON.stringify(record, null, 2));
    }
    console.log(JSON.stringify({ ...record, body: body.slice(0, Number(process.env.RESEARCH_PRINT_LIMIT || 18000)), links: links.filter(link => /academic|program|college|bachelor|undergrad|camarin|campus/i.test(link.title + ' ' + link.href)).slice(0, 65) }));
  } catch (error) { console.log(JSON.stringify({ url, failed: true, message: error.name })); }
}));
