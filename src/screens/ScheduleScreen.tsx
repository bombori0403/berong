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
import { setScheduleNotification } from '../agentTools';
import {
  formatDateTime,
  parseDateTimeInput,
  toLocalISO,
  weekdayName,
} from '../dates';
import { cancelLocalNotification } from '../notifications';
import { loadSchedules, newId, saveSchedules } from '../storage';
import { colors, spacing } from '../theme';
import { Schedule } from '../types';

export default function ScheduleScreen({ refreshKey }: { refreshKey: number }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState('');
  const [notifyMin, setNotifyMin] = useState('30');

  const reload = useCallback(() => {
    loadSchedules().then((list) =>
      setSchedules(
        [...list].sort(
          (a, b) =>
            new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )
      )
    );
  }, []);

  useEffect(reload, [reload, refreshKey]);

  const add = async () => {
    const when = parseDateTimeInput(datetime);
    if (!title.trim()) {
      Alert.alert('베롱이', '일정 제목을 입력해주세요.');
      return;
    }
    if (!when) {
      Alert.alert('베롱이', '날짜는 "2026-10-03 15:00" 형식으로 입력해주세요.');
      return;
    }
    const mins = parseInt(notifyMin, 10);
    let item: Schedule = {
      id: newId(),
      title: title.trim(),
      datetime: toLocalISO(when),
      notifyMinutesBefore: isNaN(mins) ? null : mins,
      notificationId: null,
      memo: '',
      done: false,
      createdAt: Date.now(),
    };
    item = await setScheduleNotification(item);
    const list = await loadSchedules();
    list.push(item);
    await saveSchedules(list);
    setTitle('');
    setDatetime('');
    setShowForm(false);
    reload();
  };

  const toggleDone = async (target: Schedule) => {
    const list = await loadSchedules();
    const s = list.find((x) => x.id === target.id);
    if (!s) return;
    s.done = !s.done;
    if (s.done) {
      await cancelLocalNotification(s.notificationId);
      s.notificationId = null;
    } else {
      await setScheduleNotification(s);
    }
    await saveSchedules(list);
    reload();
  };

  const remove = (target: Schedule) => {
    Alert.alert('일정 삭제', `"${target.title}" 일정을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await cancelLocalNotification(target.notificationId);
          const list = (await loadSchedules()).filter(
            (x) => x.id !== target.id
          );
          await saveSchedules(list);
          reload();
        },
      },
    ]);
  };

  const isRepeating = (s: Schedule) => s.repeat === 'daily' || s.repeat === 'weekly';

  const isPast = (s: Schedule) =>
    !isRepeating(s) && new Date(s.datetime).getTime() < Date.now() && !s.done;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅 일정</Text>
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
            placeholder="일정 제목"
            placeholderTextColor={colors.subText}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.formInput}
            placeholder="날짜와 시간 (예: 2026-10-03 15:00)"
            placeholderTextColor={colors.subText}
            value={datetime}
            onChangeText={setDatetime}
          />
          <TextInput
            style={styles.formInput}
            placeholder="몇 분 전에 알림? (기본 30)"
            placeholderTextColor={colors.subText}
            value={notifyMin}
            onChangeText={setNotifyMin}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.saveBtn} onPress={add}>
            <Text style={styles.saveBtnText}>저장</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            💡 대화 탭에서 "내일 3시 병원 등록해줘"라고 말해도 돼요!
          </Text>
        </View>
      )}

      <FlatList
        data={schedules}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            아직 일정이 없어요.{'\n'}대화 탭에서 베롱이에게 말해보세요!
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, item.done && styles.cardDone]}>
            <TouchableOpacity
              style={styles.check}
              onPress={() => toggleDone(item)}
            >
              <Text style={{ fontSize: 20 }}>{item.done ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.cardTitle, item.done && styles.cardTitleDone]}
              >
                {item.title}
              </Text>
              <Text style={[styles.cardTime, isPast(item) && styles.pastTime]}>
                {isRepeating(item)
                  ? `🔁 ${
                      item.repeat === 'daily'
                        ? '매일'
                        : `매주 ${weekdayName(item.datetime)}요일`
                    } ${formatDateTime(item.datetime).split(' ').slice(-2).join(' ')}`
                  : formatDateTime(item.datetime)}
                {isPast(item) ? ' · 지남' : ''}
              </Text>
              {item.notifyMinutesBefore !== null && !item.done && (
                <Text style={styles.cardNotify}>
                  🔔 {item.notifyMinutesBefore}분 전 알림
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => remove(item)}>
              <Text style={styles.deleteText}>삭제</Text>
            </TouchableOpacity>
          </View>
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
  form: { paddingHorizontal: spacing.lg, gap: spacing.sm },
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
  hint: { color: colors.subText, fontSize: 12, marginTop: 2 },
  empty: {
    color: colors.subText,
    textAlign: 'center',
    marginTop: 60,
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  cardDone: { opacity: 0.5 },
  check: { paddingRight: 2 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cardTitleDone: { textDecorationLine: 'line-through' },
  cardTime: { color: colors.subText, fontSize: 13, marginTop: 2 },
  pastTime: { color: colors.danger },
  cardNotify: { color: colors.accent, fontSize: 12, marginTop: 2 },
  deleteText: { color: colors.danger, fontSize: 13 },
});
