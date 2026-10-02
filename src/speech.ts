// 음성 인식(말로 입력) 래퍼.
// expo-speech-recognition은 진짜 빌드에서만 동작하므로,
// Expo Go나 웹에서는 조용히 비활성화되도록 감싼다.
let mod: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  mod = require('expo-speech-recognition');
} catch {
  mod = null;
}

export function speechAvailable(): boolean {
  return !!mod?.ExpoSpeechRecognitionModule;
}

export async function requestSpeechPermission(): Promise<boolean> {
  if (!speechAvailable()) return false;
  try {
    const res = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return !!res.granted;
  } catch {
    return false;
  }
}

export function startListening(): boolean {
  if (!speechAvailable()) return false;
  try {
    mod.ExpoSpeechRecognitionModule.start({
      lang: 'ko-KR',
      interimResults: true,
      continuous: false,
    });
    return true;
  } catch {
    return false;
  }
}

export function stopListening(): void {
  if (!speechAvailable()) return;
  try {
    mod.ExpoSpeechRecognitionModule.stop();
  } catch {}
}

/**
 * 음성 인식 이벤트 구독. 반환된 함수로 해제한다.
 * onResult: 인식된 문장(중간 결과 포함), isFinal 여부
 * onEnd: 인식 세션 종료
 */
export function subscribeSpeech(
  onResult: (transcript: string, isFinal: boolean) => void,
  onEnd: () => void
): () => void {
  if (!speechAvailable()) return () => {};
  try {
    const resultSub = mod.ExpoSpeechRecognitionModule.addListener(
      'result',
      (event: any) => {
        const transcript = event?.results?.[0]?.transcript ?? '';
        onResult(transcript, !!event?.isFinal);
      }
    );
    const endSub = mod.ExpoSpeechRecognitionModule.addListener('end', onEnd);
    const errorSub = mod.ExpoSpeechRecognitionModule.addListener(
      'error',
      onEnd
    );
    return () => {
      try {
        resultSub?.remove?.();
        endSub?.remove?.();
        errorSub?.remove?.();
      } catch {}
    };
  } catch {
    return () => {};
  }
}
