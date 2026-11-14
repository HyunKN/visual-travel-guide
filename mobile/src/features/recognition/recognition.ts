import type { Photo } from '../photo-input/photoInput';

export type RecognitionInput = Readonly<{ requestId: string; photoId: string; contentVersion: string }>;
export type Candidate = Readonly<{ targetId: string; rank: number; score: number }>;
export type ErrorCode = 'PHOTO_UNREADABLE' | 'IMAGE_UNSUPPORTED' | 'MODEL_NOT_READY' | 'MODEL_INCOMPATIBLE'
  | 'CONTENT_MISMATCH' | 'INFERENCE_FAILED' | 'TIMEOUT' | 'BUSY';
type Provenance = {
  modelVersion: string; preprocessingVersion: string; decisionPolicyVersion: string;
  scoreKind: string; locationUsed: false;
};
export type RecognitionResult = RecognitionInput & (
  | ({ status: 'identified'; candidates: Candidate[]; selectedTargetId: string } & Provenance)
  | ({ status: 'uncertain'; candidates: Candidate[]; reason: 'below-policy' | 'no-candidate' | 'policy-unvalidated' } & Provenance)
  | { status: 'cancelled'; reason: 'user' | 'superseded' }
  | { status: 'error'; code: ErrorCode; retryable: boolean }
);
/** Supplied only after artifact/preprocessing handoff; validated requires independent policy evidence. */
export type RuntimeConfiguration = Omit<Provenance, 'locationUsed'> & {
  contentVersion: string; scoreOrder: 'ascending' | 'descending'; candidateLimit: number;
  policyValidation: 'pending' | 'validated';
};
export type RecognitionRuntime = {
  configuration: Readonly<RuntimeConfiguration>;
  // Resolves/rejects only when native work has really stopped, including decoding/preprocessing.
  recognize(input: RecognitionInput, photo: Readonly<Photo>): Promise<unknown>;
};
type Context = { photo: Photo | null; contentVersion: string; supportedTargetIds: readonly string[] };
const errorCodes: readonly string[] = ['PHOTO_UNREADABLE', 'IMAGE_UNSUPPORTED', 'MODEL_NOT_READY',
  'MODEL_INCOMPATIBLE', 'CONTENT_MISMATCH', 'INFERENCE_FAILED', 'TIMEOUT', 'BUSY'];
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const failure = (input: RecognitionInput, code: ErrorCode, retryable = true): RecognitionResult => ({ ...input, status: 'error', code, retryable });

function validate(value: unknown, input: RecognitionInput, config: RuntimeConfiguration, targets: readonly string[]): RecognitionResult {
  if (!record(value)) return failure(input, 'INFERENCE_FAILED');
  if (value.requestId !== input.requestId || value.photoId !== input.photoId || value.contentVersion !== input.contentVersion)
    return failure(input, 'CONTENT_MISMATCH', false);
  if (value.status === 'error') return typeof value.code === 'string' && errorCodes.includes(value.code) && typeof value.retryable === 'boolean'
    ? { ...input, status: 'error', code: value.code as ErrorCode, retryable: value.retryable } : failure(input, 'INFERENCE_FAILED');
  if (value.status === 'cancelled') return value.reason === 'user' || value.reason === 'superseded'
    ? { ...input, status: 'cancelled', reason: value.reason } : failure(input, 'INFERENCE_FAILED');
  if (value.status !== 'identified' && value.status !== 'uncertain') return failure(input, 'INFERENCE_FAILED');
  if (value.modelVersion !== config.modelVersion || value.preprocessingVersion !== config.preprocessingVersion
    || value.decisionPolicyVersion !== config.decisionPolicyVersion || value.scoreKind !== config.scoreKind || value.locationUsed !== false)
    return failure(input, 'MODEL_INCOMPATIBLE', false);
  if (!Array.isArray(value.candidates) || value.candidates.length > config.candidateLimit) return failure(input, 'INFERENCE_FAILED');
  const candidates: Candidate[] = [];
  for (const [index, item] of value.candidates.entries()) {
    if (!record(item) || typeof item.targetId !== 'string' || !targets.includes(item.targetId)) return failure(input, 'CONTENT_MISMATCH', false);
    if (item.rank !== index + 1 || typeof item.score !== 'number' || !Number.isFinite(item.score)
      || candidates.some(c => c.targetId === item.targetId)) return failure(input, 'INFERENCE_FAILED');
    const previous = candidates[index - 1];
    if (previous && (config.scoreOrder === 'descending' ? previous.score < item.score : previous.score > item.score)) return failure(input, 'INFERENCE_FAILED');
    candidates.push({ targetId: item.targetId, rank: index + 1, score: item.score });
  }
  const provenance: Provenance = { modelVersion: config.modelVersion, preprocessingVersion: config.preprocessingVersion,
    decisionPolicyVersion: config.decisionPolicyVersion, scoreKind: config.scoreKind, locationUsed: false };
  if (value.status === 'identified' && (!candidates.length || value.selectedTargetId !== candidates[0].targetId)) return failure(input, 'INFERENCE_FAILED');
  if (value.status === 'uncertain' && (typeof value.reason !== 'string'
    || !['below-policy', 'no-candidate', 'policy-unvalidated'].includes(value.reason)
    || (value.reason === 'no-candidate' && candidates.length !== 0))) return failure(input, 'INFERENCE_FAILED');
  if (config.policyValidation !== 'validated') return { ...input, ...provenance, status: 'uncertain', candidates, reason: 'policy-unvalidated' };
  return value.status === 'identified'
    ? { ...input, ...provenance, status: 'identified', candidates, selectedTargetId: candidates[0].targetId }
    : { ...input, ...provenance, status: 'uncertain', candidates, reason: value.reason as 'below-policy' | 'no-candidate' | 'policy-unvalidated' };
}

/** Application lifetime: cancellation ends UI waiting, never releases the native lock early. */
export function createRecognition(options: {
  getContext(): Context;
  runtime: RecognitionRuntime | null;
  scheduleTimeout?: (callback: () => void, ms: number) => () => void;
}) {
  type Job = { input: RecognitionInput; finish(result: RecognitionResult): void };
  let current: Job | null = null, running: Job | null = null, serial = 0;
  const schedule = options.scheduleTimeout ?? ((callback, ms) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); });
  function cancelRecognition(requestId: string, reason: 'user' | 'superseded' = 'user'): { status: 'accepted' | 'not-active' } {
    if (!current || current.input.requestId !== requestId) return { status: 'not-active' };
    current.finish({ ...current.input, status: 'cancelled', reason });
    return { status: 'accepted' };
  }
  return {
    createRequest(photoId: string): RecognitionInput {
      return Object.freeze({ requestId: `recognition-${Date.now()}-${++serial}`, photoId, contentVersion: options.getContext().contentVersion });
    },
    cancelRecognition,
    recognize(request: RecognitionInput): Promise<RecognitionResult> {
      const input = Object.freeze({ requestId: request.requestId, photoId: request.photoId, contentVersion: request.contentVersion });
      if (running) return Promise.resolve(failure(input, 'BUSY'));
      const context = options.getContext();
      if (!input.requestId.trim() || !context.photo || input.photoId !== context.photo.photoId) return Promise.resolve(failure(input, 'PHOTO_UNREADABLE'));
      if (input.contentVersion !== context.contentVersion) return Promise.resolve(failure(input, 'CONTENT_MISMATCH', false));
      const runtime = options.runtime;
      if (!runtime) return Promise.resolve(failure(input, 'MODEL_NOT_READY', false));
      const config = { ...runtime.configuration };
      if (config.contentVersion !== input.contentVersion) return Promise.resolve(failure(input, 'CONTENT_MISMATCH', false));
      if (![config.modelVersion, config.preprocessingVersion, config.decisionPolicyVersion, config.scoreKind].every(v => typeof v === 'string' && v.trim())
        || !Number.isInteger(config.candidateLimit) || config.candidateLimit < 1 || config.candidateLimit > context.supportedTargetIds.length
        || !['ascending', 'descending'].includes(config.scoreOrder) || !['pending', 'validated'].includes(config.policyValidation))
        return Promise.resolve(failure(input, 'MODEL_INCOMPATIBLE', false));
      // Pin the ephemeral input through native settlement. We never delete its file.
      const photo = Object.freeze({ ...context.photo });
      return new Promise(resolve => {
        let stopTimer = () => {};
        const job: Job = { input, finish(result) {
          if (current !== job) return;
          current = null; stopTimer(); resolve(result);
        } };
        current = running = job;
        stopTimer = schedule(() => job.finish(failure(input, 'TIMEOUT')), 30_000);
        const complete = (value: unknown, failed = false) => {
          if (running === job) running = null;
          if (current !== job) return;
          const latest = options.getContext();
          if (latest.photo?.photoId !== input.photoId || latest.contentVersion !== input.contentVersion)
            job.finish({ ...input, status: 'cancelled', reason: 'superseded' });
          else job.finish(failed ? failure(input, 'INFERENCE_FAILED') : validate(value, input, config, latest.supportedTargetIds));
        };
        try { void runtime.recognize(input, photo).then(value => complete(value), () => complete(null, true)); }
        catch { complete(null, true); }
      });
    },
  };
}
