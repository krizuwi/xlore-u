import test from 'node:test';
import assert from 'node:assert/strict';

const { discoverProgramLinks, discoverEmbeddedProgramLinks, crawlProgramLinks } = await import('../src/services/program-link-crawler.js');

test('degree links on a catalog page are collected without fetching detail pages', async () => {
  const html = '<nav><a href="/degrees/fake">BS Fake</a></nav><main>' +
    '<a href="/degrees/nursing">Bachelor of Science in Nursing</a>' +
    '<a href="https://outside.edu/degrees/fake">BS Fake</a>' +
    '<a href="http://example.edu/degrees/insecure">BS Insecure</a>' +
    '<a href="/programs">Programs</a></main>';
  const found = await crawlProgramLinks(html, 'https://example.edu/catalog', 'example.edu', {
    fetchPage: async () => { throw new Error('No detail fetch expected'); }
  });
  assert.deepEqual(found, [{ name: 'Bachelor of Science in Nursing', url: 'https://example.edu/degrees/nursing' }]);
});

test('a linked degree detail page supplies an unclear listing title', async () => {
  const html = '<main><a href="/programs/computer-science">Computer Science</a></main>';
  const calls = [];
  const found = await crawlProgramLinks(html, 'https://example.edu/catalog', 'example.edu', {
    fetchPage: async url => {
      calls.push(url);
      return { html: '<main><h1>Bachelor of Science in Computer Science</h1></main>', finalUrl: url };
    }
  });
  assert.deepEqual(calls, ['https://example.edu/programs/computer-science']);
  assert.deepEqual(found, [{ name: 'Bachelor of Science in Computer Science', url: calls[0] }]);
  assert.deepEqual(discoverProgramLinks('<a href="/contact">Contact</a>', 'https://example.edu/catalog', 'example.edu'), []);
});

test('a degree card can supply the title for its generic detail link', () => {
  const html = '<main><article><h2>Bachelor of Arts in Communication</h2>' +
    '<a href="/degrees/communication">Read more</a></article></main>';
  assert.deepEqual(discoverProgramLinks(html, 'https://example.edu/catalog', 'example.edu'), [
    { title: 'Bachelor of Arts in Communication', url: 'https://example.edu/degrees/communication', explicit: true }
  ]);
});

test('degree links may distinguish pages through query parameters', () => {
  assert.deepEqual(discoverProgramLinks('<a href="?degree=nursing">BS Nursing</a>',
    'https://example.edu/programs', 'example.edu'), [
    { title: 'BS Nursing', url: 'https://example.edu/programs?degree=nursing', explicit: true }
  ]);
});

test('degree links may lead to another approved subdomain', () => {
  assert.deepEqual(discoverProgramLinks('<a href="https://degrees.example.edu/nursing">BS Nursing</a>',
    'https://www.example.edu/programs', 'example.edu'), [
    { title: 'BS Nursing', url: 'https://degrees.example.edu/nursing', explicit: true }
  ]);
});

test('structured page JSON exposes degree links without a site-specific adapter', () => {
  const html = '<script type="application/ld+json">' + JSON.stringify({ '@type': 'ItemList',
    itemListElement: [{ item: { name: 'Bachelor of Science in Biology', url: '/degrees/biology' } },
      { item: { name: 'Bachelor of Science in Physics', url: 'https://other.edu/degrees/physics' } }] }) +
    '</script><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: {
      programs: [{ title: 'Bachelor of Arts in Communication', href: '/degrees/communication' }] } } }) + '</script>';
  assert.deepEqual(discoverEmbeddedProgramLinks(html, 'https://example.edu/programs', 'example.edu'), [
    { name: 'Bachelor of Science in Biology', url: 'https://example.edu/degrees/biology' },
    { name: 'Bachelor of Arts in Communication', url: 'https://example.edu/degrees/communication' }
  ]);
});

test('a browser-rendered section on any matching host uses its paginated public article list', async () => {
  const html = '<div id="article-list-view"></div><script>kb/articleList</script>';
  const requests = [];
  const records = (start, count) => Array.from({ length: count }, (_, index) => ({
    id: start + index, name: `Bachelor of Science in Field ${start + index}`,
    slugTitle: `field-${start + index}`, section: { id: 12 }, isSection: false
  }));
  const found = await crawlProgramLinks(html, 'https://help.example.edu/kb/section/12',
    'example.edu', { fetchJson: async url => {
      requests.push(new URL(url));
      return { json: { count: 101, result: requests.length === 1 ? records(1, 100) : records(101, 1) } };
    } });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get('perpage'), '100');
  assert.equal(requests[1].searchParams.get('page'), '2');
  assert.equal(found.length, 101);
  assert.equal(found[0].url, 'https://help.example.edu/kb/article/1/field-1');
  assert.equal(found.at(-1).name, 'Bachelor of Science in Field 101');
});

test('the dynamic article list rejects incomplete or malformed responses', async () => {
  const html = '<div id="article-list-view"></div><script>kb/articleList</script>';
  await assert.rejects(crawlProgramLinks(html, 'https://help.example.edu/kb/section/12',
    'example.edu', { fetchJson: async () => ({ json: { count: 3 } }) }), /invalid article list/);
});

test('an incomplete public list fails instead of saving a partial catalog', async () => {
  const html = '<div id="article-list-view"></div><script>kb/articleList</script>';
  let page = 0;
  await assert.rejects(crawlProgramLinks(html, 'https://help.example.edu/kb/section/12',
    'example.edu', { fetchJson: async () => ({ json: { count: 3, result: ++page === 1 ? [
      { id: 1, name: 'Bachelor of Science in Nursing', slugTitle: 'nursing', section: { id: 12 } }
    ] : [] } }) }), /ended before all pages/);
});
