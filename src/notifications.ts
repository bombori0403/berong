import * as Notifications from 'expo-notifications';

// 앱이 켜져 있을 때도 알림 배너가 보이도록 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/**
 * 지정 시각에 로컬 알림 예약. 과거 시각이면 null 반환.
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  fireDate: Date
): Promise<string | null> {
  try {
    if (fireDate.getTime() <= Date.now()) return null;
    const ok = await ensureNotificationPermission();
    if (!ok) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });
  } catch {
    // 알림을 지원하지 않는 환경(웹 등)에서는 알림 없이 진행
    return null;
  }
}

/**
 * 매일/매주 반복되는 로컬 알림 예약.
 * weekly면 fireDate의 요일, 둘 다 fireDate의 시:분에 맞춰 반복된다.
 */
export async function scheduleRepeatingLocalNotification(
  title: string,
  body: string,
  repeat: 'daily' | 'weekly',
  fireDate: Date
): Promise<string | null> {
  try {
    const ok = await ensureNotificationPermission();
    if (!ok) return null;
    const trigger =
      repeat === 'daily'
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DAILY as const,
            hour: fireDate.getHours(),
            minute: fireDate.getMinutes(),
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY as const,
            weekday: fireDate.getDay() + 1, // 1 = 일요일
            hour: fireDate.getHours(),
            minute: fireDate.getMinutes(),
          };
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger,
    });
  } catch {
    return null;
  }
}

export async function cancelLocalNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // 이미 발송됐거나 없는 알림이면 무시
  }
}
