// Shared vector artwork for the in-app logo and generated launcher assets.
export const BRAND_BACKGROUND = '#233B32';
export const BRAND_PAPER = '#F7F0DF';
export const BRAND_ACCENT = '#E6A17B';
export const BOOK_LEFT = 'M24 31C38 27 49 32 60 41V96C48 87 37 84 24 88Z';
export const BOOK_RIGHT = 'M68 41C79 32 90 27 104 31V88C91 84 80 87 68 96Z';
export const BOOK_FOLD = 'M36 41L52 47V77L36 71Z';
export const BOOK_N = 'M43 76V49L85 77V49';
export const BOOK_SPARK = 'M89 16L92 23L99 26L92 29L89 36L86 29L79 26L86 23Z';

export function logoSvg({ background = true, monochrome = false, adaptive = false } = {}) {
  const paper = monochrome ? '#FFFFFF' : BRAND_PAPER;
  const accent = monochrome ? '#FFFFFF' : BRAND_ACCENT;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 128 128">
    ${background ? `<rect width="128" height="128" fill="${BRAND_BACKGROUND}"/>` : ''}
    <g${adaptive ? ' transform="translate(20 20) scale(.6875)"' : ''}>
      <path d="${BOOK_LEFT}" fill="${paper}"/>
      <path d="${BOOK_RIGHT}" fill="${paper}"/>
      ${monochrome ? '' : `<path d="${BOOK_FOLD}" fill="${BRAND_BACKGROUND}" opacity=".13"/>
      <path d="${BOOK_N}" fill="none" stroke="${BRAND_BACKGROUND}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`}
      <path d="${BOOK_SPARK}" fill="${accent}"/>
    </g>
  </svg>`;
}
