import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { askBerong, BerongError } from '../claude';
import { formatTime } from '../dates';
import {
  getLastBriefingDate,
  loadChat,
  loadSettings,
  newId,
  saveChat,
  setLastBriefingDate,
} from '../storage';
import {
  requestSpeechPermission,
  speechAvailable,
  startListening,
  stopListening,
  subscribeSpeech,
} from '../speech';
import { colors, spacing } from '../theme';
import { ChatMessage } from '../types';

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: '안녕하세요, 저는 베롱이예요! 🌸\n일정, 메모, 사진, 뭐든 편하게 맡겨주세요.\n\n예시:\n• "내일 오후 3시에 병원 예약 잡아줘"\n• 📷 버튼으로 예약증/카톡 캡처 보내기\n• 🎤 버튼을 누르고 말하기',
  ts: Date.now(),
};

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export default function ChatScreen({
  onDataChanged,
}: {
  onDataChanged: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const listRef = useRef<FlatList>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    loadChat().then((saved) => {
      setMessages(saved.length > 0 ? saved : [WELCOME]);
      maybeRunBriefing(saved);
    });
    // 음성 인식 결과 → 입력창에 실시간 반영
    const unsubscribe = subscribeSpeech(
      (transcript) => setInput(transcript),
      () => setListening(false)
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakReply = async (text: string) => {
    try {
      const settings = await loadSettings();
      if (!settings.voiceReply) return;
      const clean = text
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
        .replace(/[*#_`~]/g, '')
        .trim();
      if (!clean) return;
      Speech.stop();
      Speech.speak(clean, { language: 'ko-KR' });
    } catch {}
  };

  /** 공용 전송 로직: 손으로 친 메시지, 사진/파일 첨부, 브리핑 자동 요청 모두 이리로 */
  const sendMessage = async (
    text: string,
    base: ChatMessage[],
    extras?: { imageBase64?: string; fileText?: string; fileName?: string }
  ) => {
    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      text,
      ts: Date.now(),
      ...(extras ?? {}),
    };
    const next = [...base.filter((m) => m.id !== 'welcome'), userMsg];
    setMessages(next);
    await saveChat(next);
    setLoading(true);
    try {
      const { text: reply, dataChanged } = await askBerong(next);
      const botMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        text: reply,
        ts: Date.now(),
      };
      const after = [...next, botMsg];
      setMessages(after);
      await saveChat(after);
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
      const after = [...next, errMsg];
      setMessages(after);
      await saveChat(after);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || loading) return;
    setInput('');
    const image = pendingImage;
    setPendingImage(null);
    try {
      Speech.stop();
    } catch {}
    if (listening) {
      stopListening();
      setListening(false);
    }
    await sendMessage(
      text || '이 사진을 분석해줘.',
      messagesRef.current,
      image ? { imageBase64: image } : undefined
    );
  };

  /** 아침 브리핑: 켜져 있고, 오늘 아직 안 했고, 설정 시각이 지났으면 자동 실행 */
  const maybeRunBriefing = async (saved: ChatMessage[]) => {
    try {
      const settings = await loadSettings();
      if (!settings.briefingEnabled) return;
      const last = await getLastBriefingDate();
      if (last === todayString()) return;
      const [h, m] = settings.briefingTime.split(':').map((v) => parseInt(v, 10));
      const now = new Date();
      if (isNaN(h) || now.getHours() * 60 + now.getMinutes() < h * 60 + (m || 0))
        return;
      await setLastBriefingDate(todayString());
      await sendMessage('[아침 브리핑] 오늘 브리핑 부탁해!', saved);
    } catch {}
  };

  const attachImage = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('베롱이', '카메라 권한을 허용해주세요.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('베롱이', '사진 접근 권한을 허용해주세요.');
          return;
        }
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      // 토큰 비용 절약: 가로 1024px로 줄이고 JPEG 압축
      const context = ImageManipulator.manipulate(result.assets[0].uri);
      context.resize({ width: 1024, height: null });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        base64: true,
        compress: 0.6,
      });
      if (saved.base64) setPendingImage(saved.base64);
    } catch (e: any) {
      Alert.alert('베롱이', `사진을 불러오지 못했어요: ${e?.message ?? e}`);
    }
  };

  /** 카톡 "대화 내용 내보내기"로 만든 .txt 파일을 읽어서 바로 분석 요청 */
  const attachChatFile = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      const asset = picked.assets[0];
      const file = new File(asset.uri);
      let content = await file.text();
      if (!content.trim()) {
        Alert.alert('베롱이', '파일이 비어 있어요.');
        return;
      }
      // 너무 긴 대화는 최근 내용 위주로 (약 15만 자까지)
      const LIMIT = 150_000;
      let note = '';
      if (content.length > LIMIT) {
        content = content.slice(-LIMIT);
        note = ' (대화가 아주 길어서 최근 부분만 읽었어요)';
      }
      await sendMessage(
        `이 대화 파일을 분석해서 중요한 내용을 정리해줘. 약속/일정/할 일이 있으면 등록도 제안해줘.${note}`,
        messagesRef.current,
        { fileText: content, fileName: asset.name ?? '대화.txt' }
      );
    } catch (e: any) {
      Alert.alert('베롱이', `파일을 읽지 못했어요: ${e?.message ?? e}`);
    }
  };

  const onCameraButton = () => {
    Alert.alert('베롱이에게 보여주기', '무엇을 보여줄까요?', [
      { text: '📷 카메라로 찍기', onPress: () => attachImage(true) },
      { text: '🖼️ 앨범에서 고르기 (캡처 등)', onPress: () => attachImage(false) },
      { text: '📄 카톡 대화 파일(.txt)', onPress: attachChatFile },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const onMicButton = async () => {
    if (!speechAvailable()) {
      Alert.alert(
        '베롱이',
        '이 버전에서는 앱 내 음성 인식을 쓸 수 없어요.\n키보드의 🎤 버튼(받아쓰기)을 이용해주세요!'
      );
      return;
    }
    if (listening) {
      stopListening();
      setListening(false);
      return;
    }
    const ok = await requestSpeechPermission();
    if (!ok) {
      Alert.alert('베롱이', '마이크/음성 인식 권한을 허용해주세요.');
      return;
    }
    try {
      Speech.stop();
    } catch {}
    if (startListening()) setListening(true);
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
              {item.imageBase64 && (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${item.imageBase64}` }}
                  style={styles.bubbleImage}
                  resizeMode="cover"
                />
              )}
              {item.fileName && (
                <Text style={styles.fileChip}>
                  📄 {item.fileName}
                  {item.fileText ? ` (${item.fileText.length.toLocaleString()}자)` : ''}
                </Text>
              )}
              {!!item.text && <Text style={styles.bubbleText}>{item.text}</Text>}
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
      {listening && (
        <View style={styles.thinking}>
          <Text style={styles.listeningText}>🎙️ 듣고 있어요… (다시 누르면 멈춤)</Text>
        </View>
      )}
      {pendingImage && (
        <View style={styles.attachRow}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${pendingImage}` }}
            style={styles.attachPreview}
          />
          <Text style={styles.attachText}>사진 첨부됨 — 보내기를 누르세요</Text>
          <TouchableOpacity onPress={() => setPendingImage(null)}>
            <Text style={{ color: colors.danger }}>삭제</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={onCameraButton} disabled={loading}>
          <Text style={styles.iconText}>📷</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, listening && styles.iconBtnActive]}
          onPress={onMicButton}
          disabled={loading}
        >
          <Text style={styles.iconText}>🎤</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={listening ? '말씀하세요…' : '베롱이에게 말하기…'}
          placeholderTextColor={colors.subText}
          multiline
          editable={!loading}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            !(input.trim() || pendingImage) || loading ? styles.sendBtnOff : null,
          ]}
          onPress={send}
          disabled={(!input.trim() && !pendingImage) || loading}
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
  fileChip: {
    color: colors.text,
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
    overflow: 'hidden',
  },
  bubbleImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: colors.inputBg,
  },
  time: { color: colors.subText, fontSize: 11, marginTop: 3, marginHorizontal: 4 },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  thinkingText: { color: colors.subText, fontSize: 13 },
  listeningText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  attachPreview: { width: 44, height: 44, borderRadius: 8 },
  attachText: { color: colors.subText, fontSize: 13, flex: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.bg,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  iconText: { fontSize: 18 },
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
