import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyReport, previousDate, carryUnfinished } from '../lib/daily-report.ts';

test('new day: work enabled, optional sections hidden, exactly one initial row', () => {
  const report = emptyReport('2026-09-06');
  assert.equal(report.parts.work.enabled, true);
  for (const key of ['delivery', 'help', 'meeting']) {
    assert.equal(report.parts[key].enabled, false);
    assert.equal(report.parts[key].items.length, 1);
  }
});
test('previous date handles month, year and leap-day boundaries', () => {
  assert.equal(previousDate('2026-01-01'), '2025-12-31');
  assert.equal(previousDate('2024-03-01'), '2024-02-29');
  assert.equal(previousDate('2026-03-01'), '2026-02-28');
});
test('copy incomplete visible rows; preserve yesterday and today', () => {
  const yesterday = emptyReport('2026-09-05');
  yesterday.parts.work.items = [
    { id: 'a', text: 'unfinished', done: false },
    { id: 'b', text: 'done', done: true },
    { id: 'c', text: '   ', done: false },
  ];
  yesterday.parts.help.enabled = true;
  yesterday.parts.help.items[0].text = 'need help';
  yesterday.parts.meeting.items[0].text = 'hidden meeting';
  const snapshot = structuredClone(yesterday);
  const today = emptyReport('2026-09-06');
  today.parts.work.items[0].text = 'existing';
  const result = carryUnfinished(today, yesterday);
  assert.equal(result.added, 2);
  assert.deepEqual(yesterday, snapshot);
  assert.equal(today.parts.work.items.length, 1);
  assert.deepEqual(result.report.parts.work.items.map((x) => x.text), ['existing', 'unfinished']);
  assert.equal(result.report.parts.help.enabled, true);
  assert.equal(result.report.parts.help.items.length, 1);
  assert.equal(result.report.parts.meeting.enabled, false);
  assert.equal(carryUnfinished(result.report, yesterday).added, 0);
});
test('missing or non-yesterday source does not change report', () => {
  const today = emptyReport('2026-09-06');
  assert.deepEqual(carryUnfinished(today), { report: today, added: 0 });
  const source = emptyReport('2026-09-04');
  source.parts.work.items[0].text = 'older';
  assert.equal(carryUnfinished(today, source).added, 0);
});
test('carried item can continue tomorrow but cannot duplicate', () => {
  const source = emptyReport('2026-09-05');
  source.parts.work.items[0].text = 'long task';
  const today = carryUnfinished(emptyReport('2026-09-06'), source).report;
  const tomorrow = carryUnfinished(emptyReport('2026-09-07'), today);
  assert.equal(tomorrow.added, 1);
  assert.equal(carryUnfinished(tomorrow.report, today).added, 0);
});
