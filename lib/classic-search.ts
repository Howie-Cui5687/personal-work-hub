export interface TextMatch { start: number; end: number }
export interface SearchParagraph { id: string; title: string; route: string; text: string }

// Keep original UTF-16 offsets so highlights remain aligned with annotated text.
function indexedText(text: string) {
  const chars: string[] = [];
  const offsets: TextMatch[] = [];
  let offset = 0;
  for (const char of text) {
    if (!/[\p{P}\s]/u.test(char)) {
      chars.push(char);
      offsets.push({ start: offset, end: offset + char.length });
    }
    offset += char.length;
  }
  return { chars, offsets };
}

export function findTextMatches(text: string, query: string): TextMatch[] {
  const source = indexedText(text);
  const needle = indexedText(query).chars;
  if (!needle.length) return [];
  const matches: TextMatch[] = [];
  for (let i = 0; i <= source.chars.length - needle.length; i++) {
    if (needle.every((char, j) => char === source.chars[i + j])) {
      matches.push({ start: source.offsets[i].start, end: source.offsets[i + needle.length - 1].end });
      i += needle.length - 1;
    }
  }
  return matches;
}

export function searchClassics(paragraphs: SearchParagraph[], query: string) {
  return paragraphs.flatMap((paragraph) => findTextMatches(paragraph.text, query).map((match) => {
    const params = new URLSearchParams({ q: query.trim(), paragraph: paragraph.id, start: String(match.start) });
    const before = Array.from(paragraph.text.slice(0, match.start));
    const after = Array.from(paragraph.text.slice(match.end));
    return { ...paragraph, ...match, href: `${paragraph.route}?${params}`,
      before: `${before.length > 22 ? '…' : ''}${before.slice(-22).join('')}`,
      matched: paragraph.text.slice(match.start, match.end),
      after: `${after.slice(0, 22).join('')}${after.length > 22 ? '…' : ''}` };
  }));
}

export function searchTargetId(paragraph: string, start: number) {
  return `classic-hit-${paragraph}-${start}`;
}
