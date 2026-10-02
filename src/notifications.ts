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

export async function cancelLocalNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // 이미 발송됐거나 없는 알림이면 무시
  }
}
