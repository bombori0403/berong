import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import { testApiConnection } from '../claude';
import {
  clearChat,
  getApiKey,
  loadSettings,
  saveSettings,
  setApiKey,
} from '../storage';
import { colors, spacing } from '../theme';
import { BerongModel, Settings } from '../types';

const MODELS: { id: BerongModel; label: string; desc: string }[] = [
  {
    id: 'claude-sonnet-5-5',
    label: '똑똑 모드 (Sonnet)',
    desc: '가장 자연스럽고 똑똑해요. 비용은 조금 더 나가요.',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: '절약 모드 (Haiku)',
    desc: '빠르고 저렴해요. 간단한 비서 업무엔 충분해요.',
  },
];

export default function SettingsScreen() {
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    model: 'claude-sonnet-5-5',
    userName: '',
    voiceReply: true,
    homeArea: '',
  });
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    setTesting(true);
    try {
      const result = await testApiConnection();
      Alert.alert('연결 테스트 결과', result);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    getApiKey().then((k) => setHasKey(!!k));
    loadSettings().then(setSettings);
  }, []);

  const saveKey = async () => {
    try {
      const entered = keyInput.trim();
      await setApiKey(keyInput);
      // 저장 직후 되읽어서, 실제로 저장된 값을 확인시켜 준다
      const stored = await getApiKey();
      setHasKey(!!stored);
      setKeyInput('');
      if (!entered) {
        Alert.alert('베롱이', stored ? '⚠️ 삭제를 시도했지만 키가 아직 남아있어요.' : 'API 키를 삭제했어요.');
      } else if (stored && stored.slice(-4) === entered.slice(-4)) {
        Alert.alert(
          '저장 확인 ✅',
          `방금 입력한 키가 제대로 저장됐어요!\n끝 4글자: ${stored.slice(-4)} / 길이: ${stored.length}자`
        );
      } else {
        Alert.alert(
          '저장 이상 ⚠️',
          `입력한 키 끝: ${entered.slice(-4)}\n실제 저장된 키 끝: ${stored ? stored.slice(-4) : '(없음)'}\n\n저장이 반영되지 않았어요. 이 화면을 캡처해서 보여주세요!`
        );
      }
    } catch (e: any) {
      Alert.alert('저장 실패 ❌', `오류: ${e?.message ?? e}\n이 화면을 캡처해서 보여주세요!`);
    }
  };

  const update = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
  };

  const confirmClearChat = () => {
    Alert.alert('대화 기록 삭제', '베롱이와의 대화를 전부 지울까요?\n(일정과 메모는 그대로 남아요)', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await clearChat();
          Alert.alert('베롱이', '대화 기록을 지웠어요.');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.headerTitle}>⚙️ 설정</Text>

      <Text style={styles.sectionTitle}>Anthropic API 키</Text>
      <View style={styles.card}>
        <Text style={styles.status}>
          {hasKey ? '✅ API 키가 등록되어 있어요' : '❌ 아직 API 키가 없어요'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="sk-ant-... 키 붙여넣기"
          placeholderTextColor={colors.subText}
          value={keyInput}
          onChangeText={setKeyInput}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <TouchableOpacity style={styles.saveBtn} onPress={saveKey}>
          <Text style={styles.saveBtnText}>저장</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.accentSoft }]}
          onPress={runTest}
          disabled={testing}
        >
          <Text style={[styles.saveBtnText, { color: colors.accent }]}>
            {testing ? '테스트 중…' : '🔌 연결 테스트'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          키는 핸드폰의 보안 저장소(iOS 키체인)에만 저장되고 Anthropic 외엔 어디에도 전송되지 않아요.
          발급: console.anthropic.com → API Keys
        </Text>
      </View>

      <Text style={styles.sectionTitle}>베롱이 두뇌 선택</Text>
      {MODELS.map((m) => (
        <TouchableOpacity
          key={m.id}
          style={[styles.card, styles.modelCard, settings.model === m.id && styles.modelActive]}
          onPress={() => update({ model: m.id })}
        >
          <Text style={styles.modelLabel}>
            {settings.model === m.id ? '● ' : '○ '}
            {m.label}
          </Text>
          <Text style={styles.hint}>{m.desc}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>음성</Text>
      <View style={[styles.card, styles.rowCard]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.modelLabel}>🔊 베롱이 목소리</Text>
          <Text style={styles.hint}>
            베롱이가 답변을 한국어 음성으로 읽어줘요.{'\n'}
            말로 입력하려면 키보드의 🎤 버튼을 누르세요!
          </Text>
        </View>
        <Switch
          value={settings.voiceReply}
          onValueChange={(v) => {
            update({ voiceReply: v });
            if (v) {
              // 켜는 즉시 소리가 나는지 바로 확인시켜 준다
              try {
                Speech.stop();
                Speech.speak('베롱이 목소리예요! 잘 들리면 성공이에요.', {
                  language: 'ko-KR',
                });
              } catch {}
            } else {
              try {
                Speech.stop();
              } catch {}
            }
          }}
          trackColor={{ true: colors.accent, false: colors.cardBorder }}
        />
      </View>

      <Text style={styles.sectionTitle}>내 이름 (베롱이가 불러줄 호칭)</Text>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="예: 봄보리"
          placeholderTextColor={colors.subText}
          value={settings.userName}
          onChangeText={(v) => update({ userName: v })}
        />
      </View>

      <Text style={styles.sectionTitle}>내 동네 ("근처" 검색 기준)</Text>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="예: 서울 강남구 개포동"
          placeholderTextColor={colors.subText}
          value={settings.homeArea}
          onChangeText={(v) => update({ homeArea: v })}
        />
        <Text style={styles.hint}>
          "우리집 근처 맛집 알려줘"라고 하면 이 동네 기준으로 검색해요.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>데이터</Text>
      <TouchableOpacity style={[styles.card, { alignItems: 'center' }]} onPress={confirmClearChat}>
        <Text style={{ color: colors.danger, fontWeight: '600' }}>대화 기록 전체 삭제</Text>
      </TouchableOpacity>

      <Text style={[styles.hint, { textAlign: 'center', marginTop: spacing.xl }]}>
        베롱이 v1.0 🌸{'\n'}모든 데이터는 이 핸드폰 안에만 저장돼요.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.sm },
  sectionTitle: {
    color: colors.subText,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  status: { color: colors.text, fontSize: 14 },
  input: {
    backgroundColor: colors.inputBg,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { color: colors.subText, fontSize: 12, lineHeight: 17 },
  modelCard: { marginBottom: spacing.sm },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  modelActive: { borderColor: colors.accent },
  modelLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
