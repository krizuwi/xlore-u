import test from "node:test";
import assert from "node:assert/strict";
import { IDLE_NOTICE_MS, LIVE_REFRESH_MS, createEngagementMonitor, canRefreshPage, createRefreshTask } from "../src/lib/engagement.js";

function clock() {
  let time = 0, id = 0;
  const jobs = new Map();
  const timers = {
    setTimeout(fn, delay) { jobs.set(++id, { fn, at: time + delay }); return id; },
    clearTimeout(key) { jobs.delete(key); },
    setInterval(fn, delay) { jobs.set(++id, { fn, at: time + delay, interval: delay }); return id; },
    clearInterval(key) { jobs.delete(key); }
  };
  return { now: () => time, timers, jobs,
    advance(ms) {
      const end = time + ms;
      while (true) {
        const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [key, job] = next; time = job.at;
        if (job.interval) job.at += job.interval; else jobs.delete(key);
        job.fn();
      }
      time = end;
    }, jump(ms) { time += ms; }
  };
}
function fixture() {
  const fake = clock(); let idle = 0, resume = 0, refresh = 0;
  const monitor = createEngagementMonitor({ now: fake.now, timers: fake.timers, onIdle: () => idle++, onResume: () => resume++, onRefresh: () => refresh++ });
  monitor.start();
  return { fake, monitor, counts: () => ({ idle, resume, refresh }) };
}
test("defaults are exactly twenty minutes and fifteen seconds", () => {
  assert.equal(IDLE_NOTICE_MS, 1_200_000); assert.equal(LIVE_REFRESH_MS, 15_000);
});
test("idle notice appears once at twenty minutes and pauses refresh until confirmation", () => {
  const { fake, monitor, counts } = fixture();
  fake.advance(IDLE_NOTICE_MS - 1); assert.equal(counts().idle, 0); assert.equal(counts().refresh, 79);
  fake.advance(1); assert.equal(counts().idle, 1);
  const before = counts().refresh; monitor.activity(); fake.advance(60_000);
  assert.equal(counts().idle, 1); assert.equal(counts().refresh, before);
  monitor.resume(); assert.equal(counts().resume, 1);
  fake.advance(15_000); assert.equal(counts().refresh, before + 2); monitor.stop();
});
test("real activity resets the idle deadline without creating extra timers", () => {
  const { fake, monitor, counts } = fixture();
  fake.advance(19 * 60_000); monitor.activity(); fake.advance(19 * 60_000);
  assert.equal(counts().idle, 0); assert.equal(fake.jobs.size, 2);
  fake.advance(60_000); assert.equal(counts().idle, 1); monitor.stop(); assert.equal(fake.jobs.size, 0);
});
test("returning from a throttled background tab checks elapsed time", () => {
  const { fake, monitor, counts } = fixture(); fake.jump(IDLE_NOTICE_MS + 1); monitor.check();
  assert.equal(counts().idle, 1); monitor.check(); assert.equal(counts().idle, 1); monitor.stop();
});
test("stopping removes timers and prevents further callbacks", () => {
  const { fake, monitor, counts } = fixture(); monitor.stop(); fake.advance(IDLE_NOTICE_MS * 2);
  assert.deepEqual(counts(), { idle: 0, resume: 0, refresh: 0 }); assert.equal(fake.jobs.size, 0);
});
test("refresh is paused for hidden tabs, typing, dialogs, writes and draft pages", () => {
  const safe = { visible: true, pathname: "/schools", editing: false, dialogOpen: false, submitting: false };
  assert.equal(canRefreshPage(safe), true);
  for (const field of ["editing", "dialogOpen", "submitting"]) assert.equal(canRefreshPage({ ...safe, [field]: true }), false);
  assert.equal(canRefreshPage({ ...safe, visible: false }), false);
  for (const pathname of ["/assessment", "/assessment/123/results", "/profile", "/login", "/register", "/admin/login", "/admin/settings"]) assert.equal(canRefreshPage({ ...safe, pathname }), false);
  for (const pathname of ["/", "/dashboard", "/schools/123", "/programs", "/comparison", "/admin", "/admin/universities", "/admin/scraping"]) assert.equal(canRefreshPage({ ...safe, pathname }), true);
});
test("refresh tasks do not overlap, retry after failure, and abort on cleanup", async () => {
  let calls = 0, finish, signal;
  const task = createRefreshTask(() => async received => { calls++; signal = received; await new Promise(resolve => { finish = resolve; }); });
  const first = task.run(); await task.run(); assert.equal(calls, 1);
  finish(); await first; const second = task.run(); assert.equal(calls, 2);
  task.stop(); assert.equal(signal.aborted, true); finish(); await second; await task.run(); assert.equal(calls, 2);
  let attempts = 0;
  const failing = createRefreshTask(() => async () => { attempts++; throw new Error("Offline"); });
  await failing.run(); await failing.run(); assert.equal(attempts, 2); failing.stop();
});
