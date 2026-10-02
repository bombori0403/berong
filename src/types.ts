export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number; // epoch ms
};

export type RepeatType = 'none' | 'daily' | 'weekly';

export type Schedule = {
  id: string;
  title: string;
  datetime: string; // ISO 8601, 기기 로컬 시간 기준 (반복 일정이면 기준 시각)
  notifyMinutesBefore: number | null; // null이면 알림 없음
  notificationId: string | null; // 예약된 로컬 알림 ID
  memo: string;
  done: boolean;
  createdAt: number;
  repeat?: RepeatType; // 기존 데이터 호환을 위해 optional (없으면 'none')
};

export type Memo = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
};

export type BerongModel = 'claude-sonnet-5-5' | 'claude-haiku-4-5-20251001';

export type Settings = {
  model: BerongModel;
  userName: string;
  voiceReply: boolean; // 베롱이가 답변을 음성으로 읽어줄지
  homeArea: string; // "우리집 근처" 검색의 기준 동네 (예: 서울 강남구 역삼동)
};
