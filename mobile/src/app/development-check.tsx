import { ScrollView, StyleSheet, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Action } from '../ui/Action';
import { iosModel, runDeviceReferenceCheck, type LogitGroup } from '../features/recognition/deviceRuntime';
import androidReferences from '../features/recognition/fixtures/runtime-controls-20261118.json';
import iosReferences from '../features/recognition/fixtures/ios-generated-controls.json';

const groups: LogitGroup[] = ['buildingLogits', 'partLogits', 'focusLogits'];
const references = iosModel ? iosReferences : androidReferences;

function compareLogits(actual: Record<LogitGroup, number[]>, expected: typeof references.cases[number]['outputs']) {
  let maximum = 0;
  let passed = true;
  for (const group of groups) {
    const values = actual[group];
    const reference = expected[group].python;
    if (!values || values.length !== reference.length) return { passed: false, maximum: Infinity };
    for (const [index, value] of values.entries()) {
      const delta = Math.abs(value - reference[index]);
      maximum = Math.max(maximum, delta);
      passed &&= Number.isFinite(value) && delta <= 1e-4 + 1e-4 * Math.abs(reference[index]);
    }
  }
  return { passed, maximum };
}

export default function DevelopmentCheckScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState('');
  const [modelPresent, setModelPresent] = useState(false);
  const [coreMLBenchmark, setCoreMLBenchmark] = useState(false);
  const modelTitle = coreMLBenchmark ? 'Core ML 모델 검사' : '사진 인식 모델';
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    let active = true;
    void iosModel?.modelPresent().then(present => {
      if (active) setModelPresent(present);
    }).catch(() => {
      if (active) setReport('저장된 모델을 확인하지 못했어요.');
    });
    void iosModel?.isCoreMLBenchmark?.().then(enabled => {
      if (active) setCoreMLBenchmark(enabled);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function importModel() {
    if (!iosModel || importing || busy) return;
    setImporting(true);
    setReport('');
    try {
      if (await iosModel.importModel()) {
        setModelPresent(true);
        setReport('사진 인식 모델을 준비했어요.');
      }
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
      setReport(code === 'MODEL_INCOMPATIBLE'
        ? `이 빌드와 맞는 ${coreMLBenchmark ? 'NubiRecognition.mlpackage' : 'model.onnx'}를 선택해 주세요.`
        : '모델을 가져오지 못했어요. 파일이 다운로드됐는지와 여유 공간을 확인해 주세요.');
    } finally {
      setImporting(false);
    }
  }

  async function check() {
    if (importing || busy) return;
    setBusy(true);
    setReport('');
    try {
      const result = await runDeviceReferenceCheck();
      if (new Set(result.cases.map(sample => sample.id)).size !== references.cases.length ||
        result.cases.length !== references.cases.length) throw new Error('기준 입력이 일부 누락됐어요.');
      const caseLines = result.cases.map(sample => {
        const expected = references.cases.find(row => row.id === sample.id);
        if (!expected) throw new Error('등록되지 않은 기준 입력이에요.');
        const tensor = compareLogits(sample.logits, expected.outputs);
        const photo = compareLogits(sample.photoLogits, expected.outputs);
        return [
          sample.id,
          `${iosModel ? '기준 텐서' : '동일 텐서'} 출력 ${tensor.passed ? '통과' : '실패'} · 최대 오차 ${tensor.maximum.toExponential(2)}`,
          `원본 입력 최대 차이 ${sample.maxInputDelta.toExponential(2)} · 원본 출력 ${photo.passed ? '통과' : '실패'} · 최대 오차 ${photo.maximum.toExponential(2)}`,
          `전처리 ${sample.preprocessingMs.toFixed(1)}ms · 추론 ${sample.inferenceMs.toFixed(1)}ms` +
            (sample.pssKb == null ? '' : ` · PSS ${sample.pssKb}KiB`),
          ...(sample.repeatedInferenceMedianMs == null ? [] : [
            `추론 10회 중앙값 ${sample.repeatedInferenceMedianMs.toFixed(1)}ms`,
            ...(sample.sampledFootprintKiB == null ? [] : [
              `반복 실행 후 측정한 최대 메모리 ${(sample.sampledFootprintKiB / 1024).toFixed(1)}MiB`,
            ]),
          ]),
        ].join('\n');
      });
      setReport([
        result.runtimeVersion === 'Core ML' ? 'Core ML · 모든 연산 장치 허용' : `ONNX Runtime ${result.runtimeVersion} · CPU`,
        `모델 준비 ${result.loadMs.toFixed(1)}ms · ${result.sessionAlreadyLoaded ? '이미 적재됨' : '첫 적재'}`,
        ...(result.beforePssKb == null ? [] : [`프로세스 PSS ${result.beforePssKb} → ${result.afterLoadPssKb}KiB`]),
        ...(result.beforeFootprintKiB == null || result.afterLoadFootprintKiB == null ? [] : [
          `프로세스 메모리 ${(result.beforeFootprintKiB / 1024).toFixed(1)} → ${(result.afterLoadFootprintKiB / 1024).toFixed(1)}MiB`,
        ]),
        ...caseLines,
      ].join('\n\n'));
    } catch (error) {
      setReport(error instanceof Error ? error.message : '기준 입력을 검사하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      {iosModel ? <>
        <Stack.Screen options={{ title: modelTitle }} />
        <Text accessibilityRole="header" style={styles.title}>{modelTitle}</Text>
        <Text style={styles.description}>{modelPresent
          ? '모델 파일이 저장되어 있어요.'
          : `파일 앱에 저장한 ${coreMLBenchmark ? 'NubiRecognition.mlpackage' : 'model.onnx'}를 선택해 주세요.`}</Text>
        <Action label="모델 파일 가져오기" busy={importing} disabled={busy} onPress={() => void importModel()} />
      </> : <>
        <Text accessibilityRole="header" style={styles.title}>상세 화면에 도착했습니다</Text>
        <Text style={styles.description}>
          상단 뒤로가기 또는 Android 시스템 뒤로가기로 시작 화면에 돌아갈 수 있습니다.
        </Text>
      </>}
      {(iosModel ? modelPresent : __DEV__) && <Action label={busy ? '모델 검사 중' : '모델 기준 입력 검사'} busy={busy} disabled={importing} variant="soft" onPress={() => void check()} />}
      {!!report && <Text selectable accessibilityLiveRegion="polite" style={styles.description}>{report}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 20 },
  title: { color: '#292929', fontSize: 28, fontWeight: '700' },
  description: { color: '#626262', fontSize: 17, lineHeight: 26 },
});
