export type ReadingPage = { text: string; start: number; end: number };

export function readingText(paragraphs: string[]): string {
  return paragraphs.map(paragraph => `　　${paragraph}`).join('\n\n');
}

// A conservative fallback for Web, which does not emit native Text line measurements.
export function paginateText(text: string, columns: number, linesPerPage: number): ReadingPage[] {
  const width = Math.max(1, Math.floor(columns));
  const height = Math.max(1, Math.floor(linesPerPage));
  const ends: number[] = [];
  let units = 0, offset = 0;
  for (const char of text) {
    if (char === '\n') { offset += char.length; ends.push(offset); units = 0; continue; }
    const size = /^[\x20-\x7e]$/.test(char) ? 0.65 : 1;
    if (units + size > width && units > 0) { ends.push(offset); units = 0; }
    offset += char.length; units += size;
  }
  if (ends.at(-1) !== text.length) ends.push(text.length);
  return pagesAtLineEnds(text, ends, height);
}

function pagesAtLineEnds(text: string, ends: number[], linesPerPage: number): ReadingPage[] {
  const pages: ReadingPage[] = [];
  let start = 0;
  for (let index = linesPerPage - 1; index < ends.length + linesPerPage - 1; index += linesPerPage) {
    const end = ends[Math.min(index, ends.length - 1)];
    if (end > start || !pages.length) pages.push({ text: text.slice(start, end), start, end });
    start = end;
  }
  return pages.length ? pages : [{ text: '', start: 0, end: 0 }];
}

export function paginateMeasuredLines(text: string, lines: { text: string }[], linesPerPage: number): ReadingPage[] | null {
  if (!lines.length) return null;
  const ends: number[] = [];
  let offset = 0;
  for (const line of lines) {
    if (!text.startsWith(line.text, offset)) return null;
    offset += line.text.length;
    if (!line.text.endsWith('\n') && text[offset] === '\n') offset++;
    ends.push(offset);
  }
  if (offset !== text.length) return null;
  return pagesAtLineEnds(text, ends, Math.max(1, Math.floor(linesPerPage)));
}

export function pageAtOffset(pages: ReadingPage[], offset: number): number {
  const index = pages.findIndex(page => offset < page.end);
  return index < 0 ? Math.max(0, pages.length - 1) : index;
}

export function turnDestination(page: number, count: number, chapter: number, chapterCount: number, direction: -1 | 1) {
  if (direction === 1) {
    if (page + 1 < count) return { kind: 'page' as const, index: page + 1 };
    if (chapter >= 0 && chapter + 1 < chapterCount) return { kind: 'chapter' as const, index: chapter + 1, position: 'start' as const };
  } else {
    if (page > 0) return { kind: 'page' as const, index: page - 1 };
    if (chapter > 0) return { kind: 'chapter' as const, index: chapter - 1, position: 'end' as const };
  }
  return { kind: 'boundary' as const };
}

export function swipeDirection(dx: number, dy: number, velocityX: number, width: number): -1 | 1 | null {
  if (Math.abs(dx) <= Math.abs(dy) * 1.4 || (Math.abs(dx) < Math.max(40, width * 0.12) && !(Math.abs(dx) > 18 && Math.abs(velocityX) > 0.45))) return null;
  return dx < 0 ? 1 : -1;
}
