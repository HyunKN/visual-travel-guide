// Exact solution of an underdamped mass-spring-damper, with unit mass.
// Retargeting keeps position and velocity so rapid input never restarts a canned bounce.
export function springState(value = 0) { return { value, velocity: 0, target: value }; }
export function stepSpring(state, seconds, stiffness = 340, damping = 24) {
  const dt = Math.min(.064, Math.max(0, seconds));
  const decay = damping / 2, frequency = Math.sqrt(stiffness - decay * decay);
  const displacement = state.value - state.target;
  const b = (state.velocity + decay * displacement) / frequency;
  const sin = Math.sin(frequency * dt), cos = Math.cos(frequency * dt), envelope = Math.exp(-decay * dt);
  state.value = state.target + envelope * (displacement * cos + b * sin);
  state.velocity = envelope * ((b * frequency - decay * displacement) * cos - (displacement * frequency + decay * b) * sin);
  if (Math.abs(state.value - state.target) < .0001 && Math.abs(state.velocity) < .001) {
    state.value = state.target; state.velocity = 0;
  }
  return state.value !== state.target || state.velocity !== 0;
}
