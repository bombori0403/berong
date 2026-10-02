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
  cancelLocalNotification,
  scheduleRepeatingLocalNotification,
} from '../notifications';
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
    briefingEnabled: false,
    briefingTime: '08:00',
    briefingNotificationId: null,
  });
  const [briefTime, setBriefTime] = useState('08:00');
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
    loadSettings().then((s) => {
      setSettings(s);
      setBriefTime(s.briefingTime);
    });
  }, []);

  /** "08:00" 형식 검증 후 Date(오늘 그 시각) 반환, 실패 시 null */
  const parseBriefTime = (v: string): Date | null => {
    const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    const d = new Date();
    d.setHours(h, min, 0, 0);
    return d;
  };

  /** 브리핑 켜기/끄기/시간 변경 시 반복 알림을 다시 예약 */
  const applyBriefing = async (enabled: boolean, timeStr: string) => {
    const current = await loadSettings();
    await cancelLocalNotification(current.briefingNotificationId);
    let notifId: string | null = null;
    if (enabled) {
      const when = parseBriefTime(timeStr);
      if (!when) {
        Alert.alert('베롱이', '시간은 "08:00" 형식(24시간제)으로 입력해주세요.');
        return;
      }
      notifId = await scheduleRepeatingLocalNotification(
        '🌅 좋은 아침이에요!',
        '베롱이를 열면 오늘 브리핑을 들려드릴게요.',
        'daily',
        when
      );
    }
    const next = {
      ...current,
      briefingEnabled: enabled,
      briefingTime: timeStr,
      briefingNotificationId: notifId,
    };
    setSettings(next);
    await saveSettings(next);
    if (enabled) {
      Alert.alert('베롱이', `매일 ${timeStr}에 아침 브리핑을 준비할게요! 🌅`);
    }
  };

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

      <Text style={styles.sectionTitle}>아침 브리핑</Text>
      <View style={[styles.card, styles.rowCard]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.modelLabel}>🌅 매일 아침 브리핑</Text>
          <Text style={styles.hint}>
            매일 정해진 시간에 알림이 오고, 베롱이를 열면{'\n'}오늘
            일정·날씨·챙길 것을 브리핑해줘요.
          </Text>
        </View>
        <Switch
          value={settings.briefingEnabled}
          onValueChange={(v) => applyBriefing(v, briefTime)}
          trackColor={{ true: colors.accent, false: colors.cardBorder }}
        />
      </View>
      {settings.briefingEnabled && (
        <View style={[styles.card, styles.rowCard, { marginTop: spacing.sm }]}>
          <Text style={[styles.modelLabel, { flex: 0 }]}>시간</Text>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={briefTime}
            onChangeText={setBriefTime}
            placeholder="08:00"
            placeholderTextColor={colors.subText}
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity
            style={[styles.saveBtn, { paddingHorizontal: spacing.lg, paddingVertical: 10 }]}
            onPress={() => applyBriefing(true, briefTime)}
          >
            <Text style={styles.saveBtnText}>적용</Text>
          </TouchableOpacity>
        </View>
      )}

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
