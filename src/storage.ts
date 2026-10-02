import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ChatMessage, Memo, Schedule, Settings } from './types';

const KEYS = {
  chat: 'berong.chat.v1',
  schedules: 'berong.schedules.v1',
  memos: 'berong.memos.v1',
  settings: 'berong.settings.v1',
};

const API_KEY_KEY = 'berong_anthropic_api_key';

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeList<T>(key: string, list: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

// ---------- 대화 ----------
export const loadChat = () => readList<ChatMessage>(KEYS.chat);
export const saveChat = (list: ChatMessage[]) => writeList(KEYS.chat, list);
export const clearChat = () => AsyncStorage.removeItem(KEYS.chat);

// ---------- 일정 ----------
export const loadSchedules = () => readList<Schedule>(KEYS.schedules);
export const saveSchedules = (list: Schedule[]) => writeList(KEYS.schedules, list);

// ---------- 메모 ----------
export const loadMemos = () => readList<Memo>(KEYS.memos);
export const saveMemos = (list: Memo[]) => writeList(KEYS.memos, list);

// ---------- 설정 ----------
const DEFAULT_SETTINGS: Settings = {
  model: 'claude-sonnet-5-5',
  userName: '',
  voiceReply: true,
  homeArea: '',
  briefingEnabled: false,
  briefingTime: '08:00',
  briefingNotificationId: null,
};

// ---------- 아침 브리핑: 오늘 이미 했는지 ----------
const BRIEFING_DATE_KEY = 'berong.lastBriefingDate.v1';

export async function getLastBriefingDate(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(BRIEFING_DATE_KEY);
  } catch {
    return null;
  }
}

export async function setLastBriefingDate(date: string): Promise<void> {
  await AsyncStorage.setItem(BRIEFING_DATE_KEY, date);
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.settings);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

// ---------- API 키 (보안 저장소) ----------
export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(API_KEY_KEY);
  } catch {
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  if (key.trim().length === 0) {
    await SecureStore.deleteItemAsync(API_KEY_KEY);
  } else {
    await SecureStore.setItemAsync(API_KEY_KEY, key.trim());
  }
}
