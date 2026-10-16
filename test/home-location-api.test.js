import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1/test';
process.env.DB_SSL = 'disable';
process.env.EMAIL_ENABLED = 'false';
process.env.NODE_ENV = 'test';
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');
const { createAccessToken } = await import('../src/utils/security.js');
const user = { user_id: '00000000-0000-4000-8000-000000000099', email: 'student@example.test',
  first_name: 'Ana', middle_name: '', last_name: 'Santos', full_name: 'Ana Santos', address: 'Taguig', password_hash: null,
  home_location: { latitude: 14.61, longitude: 121.06, address: 'Taguig' } };
const auth = { Authorization: `Bearer ${createAccessToken(user)}`, 'Content-Type': 'application/json' };

async function serve(t) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}/api`;
}

test('only the authenticated account can read its home pin', async t => {
  const base = await serve(t);
  const db = t.mock.method(pool, 'execute', async (sql, values) => {
    assert.match(sql, /FROM users/); assert.deepEqual(values, [user.user_id]); return [[user]];
  });
  assert.equal((await fetch(base + '/auth/me')).status, 401);
  assert.equal(db.mock.callCount(), 0);
  const response = await fetch(base + '/auth/me', { headers: auth });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.user.homeLocation, { latitude: 14.61, longitude: 121.06 });
  assert.equal(body.user.home_location, undefined);
  assert.equal(body.user.password_hash, undefined);
});

for (const [name, change, expected] of [
  ['a confirmed point', { homeLocation: { latitude: 14.62, longitude: 121.07, confirmed: true } }, { latitude: 14.62, longitude: 121.07, address: 'Taguig' }],
  ['an unchanged pin on unrelated edits', { firstName: 'Maria' }, user.home_location],
  ['removal', { homeLocation: null }, null],
  ['an address change without a fresh pin', { address: 'Pasig' }, null]
]) {
  test(`profile atomically saves ${name} only for its owner`, async t => {
    let writes = 0;
    t.mock.method(pool, 'execute', async (sql, values) => {
      if (sql.startsWith('UPDATE')) {
        writes++;
        assert.match(sql, /home_location = \?/);
        assert.equal(values.at(-1), user.user_id);
        assert.deepEqual(values[6] === null ? null : JSON.parse(values[6]), expected);
        return [{ affectedRows: 1 }];
      }
      return [[user]];
    });
    const response = await fetch(await serve(t) + '/auth/me', { method: 'PATCH', headers: auth, body: JSON.stringify(change) });
    assert.equal(response.status, 200);
    assert.equal(writes, 1);
    const body = await response.json();
    assert.deepEqual(body.user.homeLocation, expected ? { latitude: expected.latitude, longitude: expected.longitude } : null);
  });
}

test('unconfirmed home locations are rejected without a database write', async t => {
  t.mock.method(pool, 'execute', async sql => { assert.match(sql, /^SELECT/); return [[user]]; });
  const response = await fetch(await serve(t) + '/auth/me', { method: 'PATCH', headers: auth,
    body: JSON.stringify({ homeLocation: { latitude: 14.62, longitude: 121.07 } }) });
  assert.equal(response.status, 400);
});

test('comparison uses the home point but never exposes home coordinates or changes column order', async t => {
  t.mock.method(pool, 'execute', async sql => {
    if (sql.includes('FROM users')) return [[user]];
    if (sql.includes('FROM comparison_sets c')) return [[
      { id: 'first', name: 'City center', latitude: 14.5176, longitude: 121.0509 },
      { id: 'second', name: 'Home school', latitude: 14.61, longitude: 121.06 }
    ]];
    return [[]];
  });
  const response = await fetch(await serve(t) + '/comparison', { headers: auth });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.locationBasis.kind, 'home_pin');
  assert.doesNotMatch(JSON.stringify(body.locationBasis), /latitude|longitude/);
  assert.deepEqual(body.schools.map(s => s.id), ['first', 'second']);
  assert.equal(body.schools[1].distanceKm, 0);
  assert.ok(body.schools[0].distanceKm > 10);
  assert.equal(body.homeLocation, undefined);
});
