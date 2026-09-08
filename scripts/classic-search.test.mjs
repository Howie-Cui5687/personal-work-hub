import test from 'node:test';
import assert from 'node:assert/strict';
import classics from '../lib/classics.json' with { type: 'json' };
import { findTextMatches, searchClassics, searchTargetId } from '../lib/classic-search.ts';

test('sentence search ignores punctuation and whitespace but keeps source offsets', () => {
  const text = '天地与我并生，而万物与我为一。';
  const hits = findTextMatches(text, '天地与我并生 而万物与我为一');
  assert.deepEqual(hits, [{ start: 0, end: text.length - 1 }]);
  assert.equal(findTextMatches('上善若水。', '上善，若水').length, 1);
  assert.deepEqual(findTextMatches(text, ' ， '), []);
  assert.deepEqual(findTextMatches(text, '不存在'), []);
});
test('repeated matches and supplementary characters retain exact positions', () => {
  const text = '𦈎然，𦈎然。';
  const hits = findTextMatches(text, '𦈎然');
  assert.deepEqual(hits, [{ start: 0, end: 3 }, { start: 4, end: 7 }]);
  assert.ok(hits.every((hit) => text.slice(hit.start, hit.end) === '𦈎然'));
});
const corpus = [
  ...classics.daodejing.flatMap((chapter) => chapter.paragraphs.map((text, i) => ({
    id: `dao-${chapter.number}-${i}`, title: chapter.title, route: `#knowledge/daodejing/${Math.ceil(chapter.number / 9)}`, text,
  }))),
  ...classics.qiwulun.map((text, i) => ({ id: `qiwu-${i}`, title: '齐物论', route: '#knowledge/qiwulun', text })),
];
test('real texts resolve to correct parts, paragraphs and refreshable match URLs', () => {
  for (const [query, route] of [['上善若水', '#knowledge/daodejing/1'], ['为学日益', '#knowledge/daodejing/6'], ['此之谓物化', '#knowledge/qiwulun']]) {
    const [hit] = searchClassics(corpus, query);
    assert.ok(hit);
    assert.equal(hit.route, route);
    const params = new URLSearchParams(hit.href.split('?')[1]);
    assert.equal(params.get('q'), query);
    assert.equal(params.get('paragraph'), hit.id);
    assert.equal(Number(params.get('start')), hit.start);
    assert.equal(searchTargetId(hit.id, hit.start), `classic-hit-${hit.id}-${hit.start}`);
    assert.equal(hit.text.slice(hit.start, hit.end), hit.matched);
  }
  assert.deepEqual(searchClassics(corpus, ''), []);
});
