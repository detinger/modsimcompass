/**
 * The only place in the app that injects markup. It shows a picture made by `KINDS[kind].figure()`.
 * The kind is responsible for safe markup; this component changes nothing in it and shows nothing at all
 * when the string is not plainly a self-contained SVG picture.
 */
const EMBEDS = /<\s*(script|foreignObject|iframe|object|embed|img|image|link|meta|base|form|audio|video)\b/i;
// An attribute can follow white space, a quote or a slash (`<g/onclick=…>` is read as an attribute too).
const EVENT_ATTRIBUTE = /[\s/"']on[a-z]+\s*=/i;
const HREF = /(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi;
const OUTSIDE_URL = /url\(\s*['"]?\s*(?!#)/i;

/** True for a string that starts with `<svg`, ends with `</svg>` and holds nothing that runs or loads anything. */
export function isSafeSvg(svg: unknown): svg is string {
  if (typeof svg !== 'string' || svg.length > 2_000_000) return false;
  const s = svg.trim();
  if (!s.startsWith('<svg') || !s.endsWith('</svg>')) return false;
  if (EMBEDS.test(s) || EVENT_ATTRIBUTE.test(s) || /javascript:/i.test(s) || /@import/i.test(s) || OUTSIDE_URL.test(s)) return false;
  // Links may only point inside the picture (`#id`), never to an address.
  for (const m of s.matchAll(HREF)) if (!(m[1] ?? m[2] ?? m[3] ?? '').trim().startsWith('#')) return false;
  // An animation must not be able to rewrite a link.
  if (/attributeName\s*=\s*["']?\s*(?:xlink:)?href/i.test(s)) return false;
  return true;
}

/** `label` is the text equivalent of the picture; without one the picture is hidden from assistive technology. */
export function SvgFigure({ svg, label, className }: { svg: string | null | undefined; label?: string; className?: string }) {
  if (!isSafeSvg(svg)) return null;
  return (
    <div className={`svg-figure${className ? ` ${className}` : ''}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
