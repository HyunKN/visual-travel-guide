import { springState, stepSpring } from './spring.js';

let motionPreference = null;
try {
  const saved = sessionStorage.getItem('palace-motion');
  if (saved === 'full' || saved === 'reduce') {
    motionPreference = saved === 'full'; document.documentElement.dataset.motion = saved;
  }
} catch { /* Storage can be disabled. OS preference still works. */ }
export const motionEnabled = () => motionPreference ?? !matchMedia('(prefers-reduced-motion: reduce)').matches;
const reducedMotion = () => !motionEnabled();
export function setMotionPreference(enabled) {
  motionPreference = enabled;
  document.documentElement.dataset.motion = enabled ? 'full' : 'reduce';
  try { sessionStorage.setItem('palace-motion', enabled ? 'full' : 'reduce'); } catch { /* Optional setting only. */ }
  document.dispatchEvent(new Event('prototype-motion-change'));
}
let currentTransition;

/** Keep the user's photo in place while its surrounding screen changes. */
export function takePhotoSnapshot(root, preferredSelector) {
  const image = root.querySelector(preferredSelector ?? '[data-shared-photo]');
  if (!image?.complete || !image.naturalWidth || reducedMotion()) return null;
  const rect = image.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > innerHeight) return null;
  return { image, rect, fit: getComputedStyle(image).objectFit, src: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight };
}

function visualBounds(rect, width, height, mode) {
  const scale = (mode === 'cover' ? Math.max : Math.min)(rect.width / width, rect.height / height);
  const w = width * scale, h = height * scale;
  return { left: rect.left + (rect.width - w) / 2, top: rect.top + (rect.height - h) / 2, width: w, height: h,
    cropX: Math.max(0, (w - rect.width) / 2), cropY: Math.max(0, (h - rect.height) / 2) };
}

export function animateScreen(root, snapshot) {
  currentTransition?.();
  const main = root.querySelector('main');
  if (reducedMotion()) return;
  main?.animate([{ transform: 'translateY(6px)' }, { transform: 'translateY(0)' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
  const destination = root.querySelector('[data-shared-photo]');
  if (!snapshot || !destination || destination.src.split('?')[0] !== snapshot.src.split('?')[0]) return;
  const end = destination.getBoundingClientRect();
  const from = visualBounds(snapshot.rect, snapshot.width, snapshot.height, snapshot.fit);
  const to = visualBounds(end, snapshot.width, snapshot.height, getComputedStyle(destination).objectFit);
  const scale = to.width / from.width;
  const clone = document.createElement('img');
  clone.src = snapshot.src;
  clone.alt = '';
  clone.className = 'photo-flight';
  Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, objectFit: 'fill' });
  document.body.append(clone);
  destination.style.opacity = '0';
  const finish = () => { clone.remove(); destination.style.opacity = ''; if (currentTransition === finish) currentTransition = null; };
  currentTransition = finish;
  const dx = to.left - from.left, dy = to.top - from.top;
  const animation = clone.animate([
    { transform: 'translate(0,0) scale(1)', clipPath: `inset(${from.cropY}px ${from.cropX}px round 32px)` },
    { transform: `translate(${dx}px,${dy}px) scale(${scale})`, clipPath: `inset(${to.cropY / scale}px ${to.cropX / scale}px round 24px)` },
  ], { duration: 480, easing: 'cubic-bezier(.22,.85,.2,1)', fill: 'forwards' });
  animation.finished.then(finish, finish);
}

/** Pointer-following deformation. The live spring retains velocity across every target change. */
export function bindPressFeedback(root) {
  const cleanups = [];
  for (const element of root.querySelectorAll('button:not(.photo-canvas), summary, .curiosity-card')) {
    const target = element.matches('.curiosity-card') ? element.querySelector('.discovery-icon') : element;
    if (!target) continue;
    const liquid = target.matches('.glass');
    const axes = { x: springState(), y: springState(), sx: springState(1), sy: springState(1) };
    let frame = 0, last = 0, bounds, pointer = null, key = null, hovering = false, disposed = false;
    const events = [];
    const on = (type, fn) => { element.addEventListener(type, fn); events.push([type, fn]); };
    const paint = () => {
      target.style.transform = `translate3d(${axes.x.value.toFixed(3)}px,${axes.y.value.toFixed(3)}px,0) scale(${axes.sx.value.toFixed(5)},${axes.sy.value.toFixed(5)})`;
    };
    const clear = () => {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      for (const [name, axis] of Object.entries(axes)) { axis.value = axis.target = name.startsWith('s') ? 1 : 0; axis.velocity = 0; }
      target.style.removeProperty('transform');
      for (const name of ['--press-x', '--press-y']) target.style.removeProperty(name);
    };
    const tick = (now) => {
      frame = 0;
      if (disposed || !element.isConnected || reducedMotion()) { clear(); return; }
      const dt = last ? (now - last) / 1000 : 1 / 60; last = now;
      let moving = false;
      for (const axis of Object.values(axes)) moving = stepSpring(axis, dt) || moving;
      paint();
      if (moving) frame = requestAnimationFrame(tick); else last = 0;
    };
    const retarget = (x = 0, y = 0) => {
      const pressing = pointer !== null || key !== null;
      const wide = (bounds?.width ?? 100) > (bounds?.height ?? 50) * 2;
      axes.x.target = x * (pressing ? 5 : 3);
      axes.y.target = y * (pressing ? 4 : 2);
      axes.sx.target = pressing ? (wide ? 1.04 : 1.12) + Math.abs(x) * .015 : hovering ? 1.012 + Math.abs(x) * .012 : 1;
      axes.sy.target = pressing ? (wide ? 1.12 : 1.12) + Math.abs(y) * .02 : hovering ? 1.025 + Math.abs(y) * .015 : 1;
      if (liquid && !reducedMotion() && !frame) frame = requestAnimationFrame(tick);
    };
    const locate = (event) => {
      bounds ??= target.getBoundingClientRect();
      const x = Number.isFinite(event.clientX) ? Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)) : bounds.width / 2;
      const y = Number.isFinite(event.clientY) ? Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)) : bounds.height / 2;
      target.style.setProperty('--press-x', `${x}px`); target.style.setProperty('--press-y', `${y}px`);
      return [x / bounds.width * 2 - 1, y / bounds.height * 2 - 1];
    };
    const reset = () => {
      pointer = key = null; hovering = false; bounds = undefined;
      element.classList.remove('is-pressed'); target.classList.remove('is-pressed'); clear();
    };
    on('pointerenter', (event) => {
      if (element.disabled) return;
      bounds = target.getBoundingClientRect(); hovering = event.pointerType === 'mouse';
      if (hovering) retarget(...locate(event));
    });
    on('pointermove', (event) => {
      if (element.disabled || reducedMotion() || event.isPrimary === false || pointer !== null && event.pointerId !== pointer) return;
      if (hovering || pointer !== null) retarget(...locate(event));
    });
    const down = (event) => {
      if (element.disabled || pointer !== null || key !== null || event.button !== undefined && event.button !== 0 || event.isPrimary === false) return;
      if (event.type === 'pointerdown') pointer = event.pointerId; else key = event.key;
      bounds = target.getBoundingClientRect();
      element.classList.add('is-pressed'); target.classList.add('is-pressed');
      retarget(...locate(event));
      if (liquid && !reducedMotion()) {
        // A quick tap can release before the first RAF. Give contact an immediate
        // displacement and velocity so its release is still a continuous motion.
        axes.sx.value += .012; axes.sy.value += .035;
        axes.sx.velocity += .45; axes.sy.velocity += 1.05; paint();
      }
    };
    const up = (event) => {
      if (event.type === 'pointerup' ? pointer === null || pointer !== event.pointerId : key === null || key !== event.key) return;
      pointer = key = null;
      element.classList.remove('is-pressed'); target.classList.remove('is-pressed');
      if (!element.isConnected || reducedMotion()) { clear(); return; }
      retarget();
    };
    on('pointerdown', down); on('pointerup', up);
    on('pointerleave', () => {
      pointer = key = null; hovering = false; bounds = undefined;
      element.classList.remove('is-pressed'); target.classList.remove('is-pressed');
      if (reducedMotion()) clear(); else retarget();
    });
    on('pointercancel', reset); on('blur', reset);
    on('keydown', (event) => { if ([' ', 'Enter'].includes(event.key) && !event.repeat) down(event); });
    on('keyup', up);
    document.addEventListener('prototype-motion-change', reset);
    cleanups.push(() => { disposed = true; reset(); events.forEach(([type, fn]) => element.removeEventListener(type, fn)); document.removeEventListener('prototype-motion-change', reset); });
  }
  return () => cleanups.forEach(cleanup => cleanup());
}
