import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import { askBerong, BerongError } from '../claude';
import { formatTime } from '../dates';
import { loadChat, loadSettings, newId, saveChat } from '../storage';
import { colors, spacing } from '../theme';
import { ChatMessage } from '../types';

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: '안녕하세요, 저는 베롱이예요! 🌸\n일정, 메모, 뭐든 편하게 말씀해주세요.\n\n예시:\n• "내일 오후 3시에 병원 예약 잡아줘"\n• "우유 사야 하는 거 기억해줘"\n• "이번 주 일정 뭐 있지?"',
  ts: Date.now(),
};

export default function ChatScreen({
  onDataChanged,
}: {
  onDataChanged: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    loadChat().then((saved) =>
      setMessages(saved.length > 0 ? saved : [WELCOME])
    );
  }, []);

  const speakReply = async (text: string) => {
    try {
      const settings = await loadSettings();
      if (!settings.voiceReply) return;
      // 이모지와 특수문자는 빼고 읽는다
      const clean = text
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
        .replace(/[*#_`~]/g, '')
        .trim();
      if (!clean) return;
      Speech.stop();
      Speech.speak(clean, { language: 'ko-KR' });
    } catch {
      // 음성을 지원하지 않는 환경에서는 조용히 무시
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    try {
      Speech.stop(); // 말하는 중이면 멈추고 새 대화 시작
    } catch {}
    const userMsg: ChatMessage = { id: newId(), role: 'user', text, ts: Date.now() };
    const base = [...messages.filter((m) => m.id !== 'welcome'), userMsg];
    setMessages(base);
    await saveChat(base);
    setLoading(true);
    try {
      const { text: reply, dataChanged } = await askBerong(base);
      const botMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        text: reply,
        ts: Date.now(),
      };
      const next = [...base, botMsg];
      setMessages(next);
      await saveChat(next);
      speakReply(reply);
      if (dataChanged) onDataChanged();
    } catch (e: any) {
      const msg =
        e instanceof BerongError
          ? e.message
          : '연결에 실패했어요. 인터넷 상태를 확인해주세요.';
      const errMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        text: `⚠️ ${msg}`,
        ts: Date.now(),
      };
      const next = [...base, errMsg];
      setMessages(next);
      await saveChat(next);
    } finally {
      setLoading(false);
    }
  };

  const reversed = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <FlatList
        ref={listRef}
        data={reversed}
        inverted
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubbleRow,
              item.role === 'user' ? styles.rowRight : styles.rowLeft,
            ]}
          >
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.userBubble : styles.botBubble,
              ]}
            >
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
            <Text style={styles.time}>{formatTime(item.ts)}</Text>
          </View>
        )}
      />
      {loading && (
        <View style={styles.thinking}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.thinkingText}>베롱이가 생각 중…</Text>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="베롱이에게 말하기…"
          placeholderTextColor={colors.subText}
          multiline
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
          onPress={send}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bubbleRow: { marginBottom: spacing.md, maxWidth: '85%' },
  rowRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userBubble: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  botBubble: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: colors.text, fontSize: 16, lineHeight: 22 },
  time: { color: colors.subText, fontSize: 11, marginTop: 3, marginHorizontal: 4 },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  thinkingText: { color: colors.subText, fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    color: colors.text,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
