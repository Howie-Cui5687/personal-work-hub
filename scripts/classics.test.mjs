import test from 'node:test';
import assert from 'node:assert/strict';
import classics from '../lib/classics.json' with { type: 'json' };
import { annotateText, glosses } from '../lib/classic-glosses.ts';

test('Dao has 81 nonempty chapters, in nine nonoverlapping parts', () => {
  assert.equal(classics.daodejing.length, 81);
  const numbers = [];
  for (let part = 0; part < 9; part++) {
    const group = classics.daodejing.slice(part * 9, part * 9 + 9);
    assert.equal(group.length, 9);
    for (const chapter of group) {
      assert.ok(chapter.paragraphs.join('').length > 15);
      numbers.push(chapter.number);
    }
  }
  assert.deepEqual(numbers, Array.from({ length: 81 }, (_, i) => i + 1));
  assert.ok(classics.daodejing[0].paragraphs[0].startsWith('道可道'));
  assert.ok(classics.daodejing[80].paragraphs[0].endsWith('圣人之道，为而不争。'));
});
test('Qiwu contains its opening, middle and ending without webpage debris', () => {
  assert.equal(classics.qiwulun.length, 12);
  const text = classics.qiwulun.join('');
  assert.ok(text.startsWith('南郭子綦'));
  for (const phrase of ['道通为一', '天地与我并生', '啮缺问乎王倪', '罔两问景']) assert.ok(text.includes(phrase));
  assert.ok(text.endsWith('此之谓物化。'));
  assert.ok(text.length > 3500);
});
test('annotations preserve all source characters, including supplementary ideographs', () => {
  for (const text of [...classics.daodejing.flatMap((c) => c.paragraphs), ...classics.qiwulun]) {
    assert.equal(annotateText(text).map((c) => c.text).join(''), text);
    assert.doesNotMatch(text, /<|>|mw-parser|variant-tooltip|政和乙未|&#|一作/);
  }
  const supplementary = annotateText('𦈎然而善谋');
  assert.equal(supplementary[0].gloss.pinyin, 'chǎn rán');
});
test('longer contextual phrases take precedence and glosses have readings and notes', () => {
  assert.equal(annotateText('玄牝之门')[0].gloss.text, '玄牝');
  assert.equal(annotateText('天下之牝')[1].gloss.text, '牝');
  assert.equal(annotateText('恶乎知之')[0].gloss.pinyin, 'wū hū');
  assert.equal(annotateText('善恶')[0].gloss, undefined);
  assert.equal(new Set(glosses.map((g) => g.text)).size, glosses.length);
  const all = classics.daodejing.flatMap((c) => c.paragraphs).concat(classics.qiwulun).join('');
  for (const gloss of glosses) { assert.ok(gloss.pinyin && gloss.note); assert.ok(all.includes(gloss.text), gloss.text); }
});
