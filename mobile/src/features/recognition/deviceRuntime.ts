import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { MODEL_OUTPUT_CONTRACT } from './modelOutputs';
import type { ErrorCode, RecognitionRuntime } from './recognition';

export type LogitGroup = 'buildingLogits' | 'partLogits' | 'focusLogits';
type Logits = Record<LogitGroup, number[]>;
type ReferenceRun = {
  runtimeVersion: string;
  sessionAlreadyLoaded: boolean;
  loadMs: number;
  beforePssKb?: number;
  afterLoadPssKb?: number;
  cases: {
    id: string;
    logits: Logits;
    photoLogits: Logits;
    inferenceMs: number;
    preprocessingMs: number;
    maxInputDelta: number;
    pssKb?: number;
  }[];
};

type NativeRuntime = {
  analyze(uri: string): Promise<Logits & { onnxSha256: string }>;
  checkReferences(): Promise<ReferenceRun>;
};

export const iosModel = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeRuntime & {
  modelPresent(): Promise<boolean>;
  importModel(): Promise<boolean>;
}>('NubiIOSRecognition') : null;

const native = Platform.OS === 'android'
  ? requireOptionalNativeModule<NativeRuntime>('NubiRecognition')
  : iosModel;

export function createDeviceRuntime(contentVersion: string): RecognitionRuntime | null {
  if (!native) return null;
  const contract = MODEL_OUTPUT_CONTRACT;
  const configuration = {
    contentVersion,
    modelVersion: contract.modelVersion,
    preprocessingVersion: contract.preprocessingVersion,
    decisionPolicyVersion: 'explicit-topic-v1',
    scoreKind: 'softmax-and-independent-sigmoid',
    scoreOrder: 'descending',
    candidateLimit: contract.buildingLabels.length,
    policyValidation: 'pending',
  } as const;
  return {
    configuration,
    async recognize(input, photo) {
      try {
        const { onnxSha256, ...logits } = await native.analyze(photo.uri);
        if (onnxSha256 !== contract.onnxSha256) {
          return { ...input, status: 'error', code: 'MODEL_INCOMPATIBLE', retryable: false };
        }
        return {
          ...input,
          ...configuration,
          status: 'analyzed',
          locationUsed: false,
          outputs: {
            ...logits,
            contractVersion: contract.version,
            modelSha256: contract.modelSha256,
            encoderSha256: contract.encoderSha256,
            buildingLabels: contract.buildingLabels,
            partLabels: contract.partLabels,
            focusLabels: contract.focusLabels,
          },
        };
      } catch (error) {
        const nativeCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
        let code: ErrorCode = 'INFERENCE_FAILED';
        switch (nativeCode) {
          case 'PHOTO_UNREADABLE':
          case 'IMAGE_UNSUPPORTED':
          case 'MODEL_NOT_READY':
          case 'MODEL_INCOMPATIBLE':
            code = nativeCode;
            break;
        }
        return { ...input, status: 'error', code, retryable: code === 'INFERENCE_FAILED' };
      }
    },
  };
}

export async function runDeviceReferenceCheck() {
  if (!native || (!__DEV__ && !iosModel)) throw new Error('모델 검사 기능이 들어간 빌드가 필요해요.');
  return native.checkReferences();
}
