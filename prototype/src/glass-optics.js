// SVG vectors → feImage → feDisplacementMap. No Canvas or pixel buffers.
import { convexMapSVG, REFRACTION } from './glass-map.js';
export { edgeVector } from './glass-map.js';
const svgNS = 'http://www.w3.org/2000/svg';
let nextId = 0;
export function bindGlassOptics(root) {
  // CSS.supports alone also returns true in engines that don't render URL backdrop filters.
  const chromium = /Chrome|Chromium|Edg\//.test(navigator.userAgent) && !/CriOS|EdgiOS/.test(navigator.userAgent);
  if (!chromium || !CSS.supports('backdrop-filter', 'url("#test")')) return () => {};
  const host = document.createElementNS(svgNS, 'svg');
  host.setAttribute('aria-hidden', 'true'); host.setAttribute('width', '0'); host.setAttribute('height', '0');
  host.style.position = 'absolute'; host.style.pointerEvents = 'none';
  const defs = document.createElementNS(svgNS, 'defs'); host.append(defs); root.append(host);
  const filters = new Map(), shared = new Map();
  const make = (tag, attrs) => {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const release = key => {
    const item = shared.get(key);
    if (item && --item.users === 0) { item.filter.remove(); shared.delete(key); }
  };
  const build = (element) => {
    const width = Math.round(element.offsetWidth), height = Math.round(element.offsetHeight);
    if (!width || !height || width > 1000 || height > 320) return;
    const radius = Math.min(parseFloat(getComputedStyle(element).borderRadius) || height / 2, height / 2, width / 2);
    const dimensions = `${width}:${height}:${radius}`;
    if (filters.get(element) === dimensions) return;
    release(filters.get(element));
    let item = shared.get(dimensions);
    if (!item) {
      const id = `palace-glass-${++nextId}`, padding = 8;
      const filter = make('filter', { id, x: -padding, y: -padding, width: width + padding * 2, height: height + padding * 2,
        filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
      filter.append(
        make('feFlood', { 'flood-color': 'rgb(50%,50%,50%)', result: 'neutral' }),
        make('feImage', { href: `data:image/svg+xml,${encodeURIComponent(convexMapSVG(width, height, radius))}`, x: 0, y: 0, width, height, preserveAspectRatio: 'none', result: 'bezel' }),
        make('feComposite', { in: 'bezel', in2: 'neutral', operator: 'over', result: 'map' }),
        make('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: REFRACTION * 2, xChannelSelector: 'R', yChannelSelector: 'G' })
      );
      defs.append(filter); item = { filter, id, users: 0 }; shared.set(dimensions, item);
    }
    item.users++; filters.set(element, dimensions);
    element.style.setProperty('--glass-backdrop', `url("#${item.id}") blur(.25px) saturate(1.05)`);
    element.dataset.glassOptics = 'svg-vector';
  };
  const observer = new ResizeObserver(entries => entries.forEach(({ target }) => build(target)));
  root.querySelectorAll('.glass').forEach(element => { build(element); observer.observe(element); });
  return () => {
    observer.disconnect(); host.remove(); shared.clear();
    filters.forEach((_, element) => { element.style.removeProperty('--glass-backdrop'); delete element.dataset.glassOptics; });
  };
}
