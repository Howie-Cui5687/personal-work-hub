import test from 'node:test';
import assert from 'node:assert/strict';
import { quickLinks, searchQuickLinks } from '../lib/quick-links.ts';

test('default shortcuts are exactly GitHub, Supabase and YouTube', () => {
  assert.deepEqual(searchQuickLinks('').map((link) => link.name), ['GitHub', 'Supabase', 'YouTube']);
  assert.deepEqual(searchQuickLinks('   '), searchQuickLinks(''));
});

test('more retains all seven other websites without duplicate shortcuts', () => {
  assert.deepEqual(quickLinks.filter((link) => !link.featured).map((link) => link.name),
    ['Notion', 'Coursera', 'arXiv', 'MDN', '少数派', '知乎', 'Bilibili']);
  assert.equal(new Set(quickLinks.map((link) => link.href)).size, 10);
});

test('search includes collapsed links, trims spaces and ignores case', () => {
  assert.deepEqual(searchQuickLinks('  NOTION ').map((link) => link.name), ['Notion']);
  assert.deepEqual(searchQuickLinks('论文').map((link) => link.name), ['arXiv']);
  assert.deepEqual(searchQuickLinks('youtube.com').map((link) => link.name), ['YouTube']);
  assert.deepEqual(searchQuickLinks('没有这个网站'), []);
});
