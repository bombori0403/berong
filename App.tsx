import { setAudioModeAsync } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ensureNotificationPermission } from './src/notifications';
import ChatScreen from './src/screens/ChatScreen';
import MemoScreen from './src/screens/MemoScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/theme';

type Tab = 'chat' | 'schedule' | 'memo' | 'settings';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'chat', icon: '💬', label: '베롱이' },
  { id: 'schedule', icon: '📅', label: '일정' },
  { id: 'memo', icon: '📝', label: '메모' },
  { id: 'settings', icon: '⚙️', label: '설정' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('chat');
  // 베롱이가 대화 중 일정/메모를 바꾸면 다른 탭들이 새로고침되도록
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    ensureNotificationPermission();
    // 아이폰 무음 스위치가 켜져 있어도 베롱이 목소리가 나오게 한다
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {tab === 'chat' && (
          <ChatScreen onDataChanged={() => setRefreshKey((k) => k + 1)} />
        )}
        {tab === 'schedule' && <ScheduleScreen refreshKey={refreshKey} />}
        {tab === 'memo' && <MemoScreen refreshKey={refreshKey} />}
        {tab === 'settings' && <SettingsScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.tabBtn}
            onPress={() => setTab(t.id)}
          >
            <Text style={styles.tabIcon}>{t.icon}</Text>
            <Text
              style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.bg,
    paddingTop: 6,
    paddingBottom: 2,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 20 },
  tabLabel: { color: colors.subText, fontSize: 11 },
  tabLabelActive: { color: colors.accent, fontWeight: '700' },
});
