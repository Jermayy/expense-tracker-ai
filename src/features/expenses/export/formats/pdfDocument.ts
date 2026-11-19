/**
 * Minimal PDF 1.4 writer: text, lines and filled rectangles in the standard Helvetica fonts.
 * Standard fonts need no embedding, which keeps the output small and avoids a PDF dependency.
 * Text is limited to the WinAnsi (Latin-1 plus typographic punctuation) character set;
 * anything else is written as "?".
 */

export const PAGE_WIDTH = 595.28; // A4 in points
export const PAGE_HEIGHT = 841.89;

export type PdfFont = "regular" | "bold";
export type Rgb = readonly [number, number, number];

const FONT_RESOURCES: Record<PdfFont, string> = { regular: "F1", bold: "F2" };
const BASE_FONTS: Record<PdfFont, string> = { regular: "Helvetica", bold: "Helvetica-Bold" };

/** Unicode code points that WinAnsiEncoding places in 0x80–0x9F. */
const WIN_ANSI_EXTRAS: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

/** Whitespace that Intl formatters and pasted text commonly contain. */
const SPACE_LIKE = new Set([0x09, 0x0a, 0x0d, 0x2009, 0x202f]);
const QUESTION_MARK = 0x3f;

/** Encode text as WinAnsi bytes; unsupported characters become "?". */
export function encodeWinAnsi(text: string): number[] {
  return Array.from(text, (char) => {
    const code = char.codePointAt(0) ?? QUESTION_MARK;
    if (SPACE_LIKE.has(code)) return 0x20;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return code;
    return WIN_ANSI_EXTRAS[code] ?? QUESTION_MARK;
  });
}

// Helvetica advance widths (1/1000 em) for bytes 32–126, from the standard AFM metrics.
// prettier-ignore
const ASCII_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const EXTRA_WIDTHS: Record<number, number> = {
  0x85: 1000,
  0x91: 222,
  0x92: 222,
  0x93: 333,
  0x94: 333,
  0x95: 350,
  0x96: 556,
  0x97: 1000,
};
const DEFAULT_WIDTH = 556;

function byteWidth(byte: number): number {
  if (byte >= 0x20 && byte <= 0x7e) return ASCII_WIDTHS[byte - 0x20];
  return EXTRA_WIDTHS[byte] ?? DEFAULT_WIDTH;
}

/**
 * Width of `text` in points. Uses regular Helvetica metrics for both weights: digits and the
 * currency punctuation are identical in bold, which is all the layout right-aligns in bold.
 */
export function textWidth(text: string, size: number): number {
  return (encodeWinAnsi(text).reduce((sum, b) => sum + byteWidth(b), 0) * size) / 1000;
}

const ELLIPSIS = "…";

/** Shorten `text` with an ellipsis so it fits within `maxWidth` points. */
export function truncateToWidth(text: string, size: number, maxWidth: number): string {
  if (textWidth(text, size) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length > 0 && textWidth(chars.join("") + ELLIPSIS, size) > maxWidth) chars.pop();
  return chars.join("").trimEnd() + ELLIPSIS;
}

const num = (n: number) => String(Math.round(n * 100) / 100);
const rgb = (c: Rgb) => c.map(num).join(" ");
const hex = (text: string) =>
  `<${encodeWinAnsi(text)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}>`;

interface TextStyle {
  font?: PdfFont;
  size: number;
  color?: Rgb;
  align?: "left" | "right";
}

export class PdfPage {
  private readonly ops: string[] = [];

  /** Draw text with its baseline at `y`; with `align: "right"`, `x` is the right edge. */
  text(text: string, x: number, y: number, { font = "regular", size, color = [0, 0, 0], align = "left" }: TextStyle) {
    const left = align === "right" ? x - textWidth(text, size) : x;
    this.ops.push(
      `BT /${FONT_RESOURCES[font]} ${num(size)} Tf ${rgb(color)} rg ${num(left)} ${num(y)} Td ${hex(text)} Tj ET`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb, width = 0.5) {
    this.ops.push(`${rgb(color)} RG ${num(width)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
  }

  rect(x: number, y: number, width: number, height: number, color: Rgb) {
    this.ops.push(`${rgb(color)} rg ${num(x)} ${num(y)} ${num(width)} ${num(height)} re f`);
  }

  content(): string {
    return this.ops.join("\n");
  }
}

/** PDF date string, e.g. `D:20261119093000Z`. */
function pdfDate(date: Date): string {
  return `D:${date.toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z`;
}

export function buildPdf(pages: readonly PdfPage[], info: { title: string; createdAt: Date }): Uint8Array<ArrayBuffer> {
  const FIRST_PAGE_OBJ = 6;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${FIRST_PAGE_OBJ + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /${BASE_FONTS.regular} /Encoding /WinAnsiEncoding >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /${BASE_FONTS.bold} /Encoding /WinAnsiEncoding >>`,
    `<< /Title ${hex(info.title)} /Producer (Spendwise) /CreationDate (${pdfDate(info.createdAt)}) >>`,
  ];
  pages.forEach((page, i) => {
    const content = page.content();
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${FIRST_PAGE_OBJ + i * 2 + 1} 0 R >>`,
      // Content is pure ASCII (text is hex-encoded), so string length equals byte length.
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });

  // The second line's high bytes mark the file as binary for transfer tools.
  let out = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = objects.map((body, i) => {
    const offset = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xrefOffset = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // Every character is below 0x100, so each maps to exactly one byte.
  const bytes = new Uint8Array(new ArrayBuffer(out.length));
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
  return bytes;
}
