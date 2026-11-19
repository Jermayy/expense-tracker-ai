const SIZE = 25;
const FINDER = 7;

/** FNV-1a, then xorshift: a stable pseudo-random module pattern per link. */
function modules(seed: string): boolean[] {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  const out: boolean[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    out.push((h & 1) === 1);
  }
  return out;
}

function inFinder(x: number, y: number): { finder: boolean; dark: boolean } {
  for (const [ox, oy] of [
    [0, 0],
    [SIZE - FINDER, 0],
    [0, SIZE - FINDER],
  ]) {
    const dx = x - ox;
    const dy = y - oy;
    if (dx >= -1 && dx <= FINDER && dy >= -1 && dy <= FINDER) {
      const edge = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      return { finder: true, dark: edge === 3 || edge <= 1 };
    }
  }
  return { finder: false, dark: false };
}

/**
 * Looks like a QR code but isn't one: share links are simulated, so a scannable code would only
 * lead to a dead URL. Labelled as a preview for screen readers and sighted users alike.
 */
export function QrPreview({ value }: { value: string }) {
  const random = modules(value);
  const cells: [number, number][] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const f = inFinder(x, y);
      if (f.finder ? f.dark : random[y * SIZE + x]) cells.push([x, y]);
    }
  }
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        role="img"
        aria-label="QR code preview (not scannable in this demo)"
        viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`}
        className="h-40 w-40 rounded-lg bg-white p-1 text-black"
        shapeRendering="crispEdges"
      >
        {cells.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
        ))}
      </svg>
      <figcaption className="text-xs text-ink-soft">Preview only, not scannable</figcaption>
    </figure>
  );
}
