import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { loadMemos, newId, saveMemos } from '../storage';
import { colors, spacing } from '../theme';
import { Memo } from '../types';

export default function MemoScreen({ refreshKey }: { refreshKey: number }) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const reload = useCallback(() => {
    loadMemos().then(setMemos);
  }, []);

  useEffect(reload, [reload, refreshKey]);

  const add = async () => {
    if (!title.trim() && !content.trim()) return;
    const memo: Memo = {
      id: newId(),
      title: title.trim() || '제목 없음',
      content: content.trim(),
      tags: [],
      createdAt: Date.now(),
    };
    const list = await loadMemos();
    list.unshift(memo);
    await saveMemos(list);
    setTitle('');
    setContent('');
    setShowForm(false);
    reload();
  };

  const remove = (target: Memo) => {
    Alert.alert('메모 삭제', `"${target.title}" 메모를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const list = (await loadMemos()).filter((m) => m.id !== target.id);
          await saveMemos(list);
          reload();
        },
      },
    ]);
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? memos.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
      )
    : memos;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📝 메모</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm((v) => !v)}
        >
          <Text style={styles.addBtnText}>{showForm ? '닫기' : '+ 추가'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.formInput}
            placeholder="제목"
            placeholderTextColor={colors.subText}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.formInput, { minHeight: 80 }]}
            placeholder="내용"
            placeholderTextColor={colors.subText}
            value={content}
            onChangeText={setContent}
            multiline
          />
          <TouchableOpacity style={styles.saveBtn} onPress={add}>
            <Text style={styles.saveBtnText}>저장</Text>
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        style={styles.search}
        placeholder="🔍 메모 검색"
        placeholderTextColor={colors.subText}
        value={query}
        onChangeText={setQuery}
      />

      <FlatList
        data={visible}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {q
              ? '검색 결과가 없어요.'
              : '아직 메모가 없어요.\n대화 탭에서 "~기억해줘"라고 말해보세요!'}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              setExpanded(expanded === item.id ? null : item.id)
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <TouchableOpacity onPress={() => remove(item)}>
                <Text style={styles.deleteText}>삭제</Text>
              </TouchableOpacity>
            </View>
            {item.tags.length > 0 && (
              <View style={styles.tagRow}>
                {item.tags.map((t) => (
                  <Text key={t} style={styles.tag}>
                    #{t}
                  </Text>
                ))}
              </View>
            )}
            <Text
              style={styles.cardContent}
              numberOfLines={expanded === item.id ? undefined : 2}
            >
              {item.content}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  addBtn: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 16,
  },
  addBtnText: { color: colors.accent, fontWeight: '600' },
  form: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  formInput: {
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
  search: {
    backgroundColor: colors.inputBg,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    fontSize: 15,
    marginHorizontal: spacing.lg,
  },
  empty: {
    color: colors.subText,
    textAlign: 'center',
    marginTop: 60,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { color: colors.accent, fontSize: 12 },
  cardContent: { color: colors.subText, fontSize: 14, marginTop: 6, lineHeight: 20 },
  deleteText: { color: colors.danger, fontSize: 13, marginLeft: spacing.md },
});
