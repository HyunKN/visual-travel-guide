// A visual companion to native scrolling; it never captures pointer or keyboard input.
export function bindScrollIndicator(root) {
  const track = root.querySelector('.scroll-position');
  const thumb = track?.querySelector('.scroll-position-thumb');
  const shell = root.querySelector('.app-shell');
  if (!track || !thumb || !shell) return () => {};

  let frame = 0;
  const update = () => {
    frame = 0;
    const viewport = document.documentElement.clientHeight;
    const height = document.documentElement.scrollHeight;
    const distance = Math.max(0, height - viewport);
    track.hidden = distance <= 1;
    if (track.hidden) return;

    const length = track.clientHeight;
    const thumbHeight = Math.min(length, Math.max(24, Math.min(54, length * viewport / height)));
    const progress = Math.min(1, Math.max(0, window.scrollY / distance));
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.translate = `0 ${(length - thumbHeight) * progress}px`;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(shell);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  update();

  return () => {
    resize.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    cancelAnimationFrame(frame);
  };
}
