import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

// Exercise the component's actual timer and event handlers without a browser,
// using a small hook/effect harness rather than waiting ten real seconds.
let activeHarness;
const hooks = {
  useState(initial) { return activeHarness.useState(initial); },
  useEffect(callback, dependencies) { activeHarness.useEffect(callback, dependencies); }
};
const built = await build({
  entryPoints: [fileURLToPath(new URL('../src/components/DashboardSchoolSlideshow.jsx', import.meta.url))],
  bundle: true, packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'test-hooks', setup(builder) {
    builder.onResolve({ filter: /^react$/ }, () => ({ path: 'dashboard-test-hooks', external: true }));
  } }]
});
const compiled = { exports: {} }, realRequire = createRequire(import.meta.url);
new Function('require', 'module', 'exports', built.outputFiles[0].text)(
  name => name === 'dashboard-test-hooks' ? hooks : realRequire(name), compiled, compiled.exports);

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) return node.map(item => find(item, predicate)).find(Boolean) ?? null;
  return predicate(node) ? node : find(node.props?.children, predicate);
}

function fixture(t, { reducedMotion = false, count = 3 } = {}) {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  const listeners = new Map(), timers = new Map();
  globalThis.window = { matchMedia: () => ({ matches: reducedMotion }) };
  globalThis.document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name) };
  let nextTimer = 0, cursor = 0, effectCursor = 0, pending = [];
  const states = [], effects = [];
  t.mock.method(globalThis, 'setInterval', (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; });
  t.mock.method(globalThis, 'clearInterval', id => timers.delete(id));
  const harness = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useEffect(callback, dependencies) {
      const index = effectCursor++, previous = effects[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        pending.push(() => { previous?.cleanup?.(); effects[index] = { dependencies, cleanup: callback() }; });
      }
    }
  };
  const props = { showcase: { discoverySchools: Array.from({ length: count }, (_, i) => ({ id: String(i), name: `School ${i}`, city: 'Manila' })) }, latestAssessment: { assessmentId: 'test' } };
  function render() {
    cursor = 0; effectCursor = 0; pending = []; activeHarness = harness;
    const tree = compiled.exports.DashboardSchoolSlideshow(props);
    pending.forEach(effect => effect());
    return tree;
  }
  t.after(() => {
    effects.forEach(effect => effect?.cleanup?.());
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  });
  return { render, timers, props, listeners,
    tick() { for (const timer of [...timers.values()]) timer.callback(); return render(); },
    button(tree, label) { const button = find(tree, node => node.props?.['aria-label'] === label); assert.ok(button, label); return button; },
    title(tree) { return find(tree, node => node.type === 'h2').props.children; }
  };
}

test('dashboard starts playing at ten-second intervals and loops without a hover pause', t => {
  const f = fixture(t), initial = f.render();
  assert.equal(f.timers.size, 1);
  assert.equal([...f.timers.values()][0].delay, 10000);
  assert.equal(initial.props.onMouseEnter, undefined);
  assert.equal(f.title(initial), 'School 0');
  assert.equal(f.title(f.tick()), 'School 1');
  assert.equal(f.title(f.tick()), 'School 2');
  assert.equal(f.title(f.tick()), 'School 0');
});

test('Pause stops rotation and Play resumes even while its button retains focus', t => {
  const f = fixture(t);
  let tree = f.render();
  tree.props.onFocusCapture({ target: { closest: () => ({}) } });
  tree = f.render();
  f.button(tree, 'Pause school highlights').props.onClick();
  tree = f.render();
  assert.equal(f.timers.size, 0);
  f.button(tree, 'Play school highlights').props.onClick();
  f.render();
  assert.equal(f.timers.size, 1);
  assert.equal(f.title(f.tick()), 'School 1');
});

test('focus on content pauses rotation, while an explicit Play clears that focus pause', t => {
  const f = fixture(t);
  let tree = f.render();
  tree.props.onFocusCapture({ target: { closest: () => null } });
  tree = f.render();
  assert.equal(f.timers.size, 0);
  f.button(tree, 'Play school highlights').props.onClick();
  f.render();
  assert.equal(f.timers.size, 1);
});

test('hidden tabs stop the timer; returning and stable dashboard refreshes do not duplicate it', t => {
  const f = fixture(t);
  f.render();
  const firstTimer = [...f.timers.keys()][0];
  f.props.showcase = { ...f.props.showcase };
  f.render();
  assert.deepEqual([...f.timers.keys()], [firstTimer]);
  document.hidden = true; f.listeners.get('visibilitychange')(); f.render();
  assert.equal(f.timers.size, 0);
  document.hidden = false; f.listeners.get('visibilitychange')(); f.render();
  assert.equal(f.timers.size, 1);
});

test('reduced-motion preferences start paused but users can explicitly play', t => {
  const f = fixture(t, { reducedMotion: true });
  const tree = f.render();
  assert.equal(f.timers.size, 0);
  f.button(tree, 'Play school highlights').props.onClick(); f.render();
  assert.equal(f.timers.size, 1);
});

test('a single highlight never starts an unnecessary timer', t => {
  const f = fixture(t, { count: 1 });
  f.render();
  assert.equal(f.timers.size, 0);
});

test('dashboard keeps fixed responsive heights, with reachable overflowing content and anchored controls', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const card = css.match(/\.dashboard-showcase\s*\{([^}]+)\}/)?.[1];
  assert.match(card, /height:\s*560px;/);
  assert.doesNotMatch(card, /min-height:/);
  assert.match(card, /grid-template-rows:\s*minmax\(0,\s*1fr\) auto;/);
  const content = css.match(/\.dashboard-showcase-content\s*\{([^}]+)\}/)?.[1];
  assert.match(content, /min-height:\s*0;/);
  assert.match(content, /overflow-y:\s*auto;/);
  assert.match(css, /@media \(min-width: 601px\) and \(max-width: 900px\)\s*\{\s*\.dashboard-showcase\s*\{\s*height:\s*620px;/);
  assert.match(css, /@media \(max-width: 600px\)\s*\{\s*\.dashboard-showcase\s*\{\s*height:\s*680px;/);
});

test('long school titles remain available without altering the timer', t => {
  const f = fixture(t);
  f.props.showcase.discoverySchools[0].name = 'A very long campus and college name '.repeat(8);
  const tree = f.render();
  assert.equal(f.title(tree), f.props.showcase.discoverySchools[0].name);
  assert.equal([...f.timers.values()][0].delay, 10000);
});
