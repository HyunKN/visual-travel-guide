// SVG vectors only. Map generation runs on geometry changes, never per frame.
export const BEZEL = 14;
export const REFRACTION = 5; // Maximum inward sampling distance in CSS px.

// Circular convex roundover, with an air/glass refractive index ratio of 1 / 1.5.
export function bendAt(distance, bezel = BEZEL) {
  if (distance < 0 || distance >= bezel) return 0;
  const sinIncident = 1 - distance / bezel;
  const angle = Math.asin(sinIncident) - Math.asin(sinIncident / 1.5);
  return Math.tan(angle) / Math.sqrt(1.25);
}

export function edgeVector(x, y, width, height, radius) {
  const dx = x - width / 2, dy = y - height / 2;
  const qx = Math.max(Math.abs(dx) - (width / 2 - radius), 0);
  const qy = Math.max(Math.abs(dy) - (height / 2 - radius), 0);
  const length = Math.hypot(qx, qy), distance = radius - length;
  if (!length || distance < 0) return [0, 0];
  const strength = bendAt(distance, Math.min(BEZEL, radius));
  // Sample inward through the convex surface. Flat centre remains neutral.
  return [-Math.sign(dx) * qx / length * strength, -Math.sign(dy) * qy / length * strength];
}

export function convexMapSVG(width, height, radius) {
  const bezel = Math.min(BEZEL, radius), defs = [], shapes = [];
  const color = (x, y, strength) => `rgb(${(50 + x * strength * 50).toFixed(3)}%,${(50 + y * strength * 50).toFixed(3)}%,50%)`;
  const distances = [0, .005, .015, .035, .07, .12, .2, .3, .42, .55, .7, .85, 1];
  const stops = (nx, ny, radial = false) => distances.map(t => ({
    offset: radial ? 1 - t * bezel / radius : t,
    color: color(nx, ny, bendAt(t * bezel, bezel)),
  })).sort((a, b) => a.offset - b.offset).map(s => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
  const linear = (id, nx, ny, x1, y1, x2, y2) => {
    defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(nx, ny)}</linearGradient>`);
  };
  linear('t', 0, 1, 0, 0, 0, bezel);
  linear('b', 0, -1, 0, height, 0, height - bezel);
  linear('l', 1, 0, 0, 0, bezel, 0);
  linear('r', -1, 0, width, 0, width - bezel, 0);
  shapes.push(`<path d="M${radius} 0H${width - radius}V${bezel}H${radius}Z" fill="url(#t)"/>`,
    `<path d="M${radius} ${height - bezel}H${width - radius}V${height}H${radius}Z" fill="url(#b)"/>`,
    `<path d="M0 ${radius}H${bezel}V${height - radius}H0Z" fill="url(#l)"/>`,
    `<path d="M${width - bezel} ${radius}H${width}V${height - radius}H${width - bezel}Z" fill="url(#r)"/>`);
  const segments = 16;
  [[radius, radius, Math.PI], [width - radius, radius, Math.PI * 1.5],
    [width - radius, height - radius, 0], [radius, height - radius, Math.PI / 2]].forEach(([cx, cy, start], corner) => {
    for (let i = 0; i < segments; i++) {
      const angle = start + (i + .5) * Math.PI / (2 * segments), id = `c${corner}-${i}`;
      // Small sector overlap prevents seams; the outside rounded clip is exact.
      const a = start + i * Math.PI / (2 * segments) - .003;
      const b = start + (i + 1) * Math.PI / (2 * segments) + .003;
      const point = t => `${(cx + (radius + 1) * Math.cos(t)).toFixed(3)} ${(cy + (radius + 1) * Math.sin(t)).toFixed(3)}`;
      defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${radius}">${stops(-Math.cos(angle), -Math.sin(angle), true)}</radialGradient>`);
      shapes.push(`<path d="M${cx} ${cy}L${point(a)}A${radius + 1} ${radius + 1} 0 0 1 ${point(b)}Z" fill="url(#${id})"/>`);
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs.join('')}<clipPath id="box"><rect width="${width}" height="${height}" rx="${radius}"/></clipPath></defs><g clip-path="url(#box)"><rect width="${width}" height="${height}" fill="rgb(50%,50%,50%)"/>${shapes.join('')}</g></svg>`;
}
