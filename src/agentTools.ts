// 베롱이(Claude)가 대화 중에 직접 사용하는 도구들의 실제 구현.
// 각 도구는 결과를 JSON 문자열로 돌려주고, 데이터가 바뀌면 changed 플래그를 올린다.
import { formatDateTime, parseDateTimeInput, toLocalISO } from './dates';
import {
  cancelLocalNotification,
  scheduleLocalNotification,
  scheduleRepeatingLocalNotification,
} from './notifications';
import {
  loadMemos,
  loadSchedules,
  newId,
  saveMemos,
  saveSchedules,
} from './storage';
import { Memo, Schedule } from './types';

export type ToolRunResult = { result: string; changed: boolean };

function scheduleBrief(s: Schedule) {
  return {
    id: s.id,
    title: s.title,
    datetime: formatDateTime(s.datetime),
    repeat: s.repeat && s.repeat !== 'none' ? s.repeat : undefined,
    done: s.done,
    notifyMinutesBefore: s.notifyMinutesBefore,
    memo: s.memo || undefined,
  };
}

function memoBrief(m: Memo) {
  return { id: m.id, title: m.title, content: m.content, tags: m.tags };
}

async function setScheduleNotification(s: Schedule): Promise<Schedule> {
  await cancelLocalNotification(s.notificationId);
  s.notificationId = null;
  if (s.done) return s;

  const repeat = s.repeat ?? 'none';
  // 반복 일정은 알림이 꺼져 있어도 기준 시각에 울리는 게 자연스럽다
  const minutesBefore =
    s.notifyMinutesBefore !== null ? s.notifyMinutesBefore : repeat !== 'none' ? 0 : null;
  if (minutesBefore === null) return s;

  const fireAt = new Date(
    new Date(s.datetime).getTime() - minutesBefore * 60_000
  );
  const body =
    minutesBefore === 0
      ? '지금 할 시간이에요!'
      : `${minutesBefore}분 뒤 일정이에요. 미리 준비하세요!`;

  if (repeat === 'none') {
    s.notificationId = await scheduleLocalNotification(
      `⏰ ${s.title}`,
      body,
      fireAt
    );
  } else {
    s.notificationId = await scheduleRepeatingLocalNotification(
      `🔁 ${s.title}`,
      body,
      repeat,
      fireAt
    );
  }
  return s;
}

export async function runTool(
  name: string,
  input: any
): Promise<ToolRunResult> {
  try {
    switch (name) {
      case 'add_schedule': {
        const when = parseDateTimeInput(String(input.datetime ?? ''));
        if (!when) {
          return {
            result: JSON.stringify({
              error:
                'datetime 형식이 잘못됨. "YYYY-MM-DD HH:mm" 형식으로 다시 시도.',
            }),
            changed: false,
          };
        }
        const schedules = await loadSchedules();
        // 실수 방지: 같은 시간대(±30분)에 겹치는 일정 감지
        const conflicts = schedules.filter(
          (s) =>
            !s.done &&
            Math.abs(new Date(s.datetime).getTime() - when.getTime()) <
              30 * 60_000
        );
        const repeatInput = String(input.repeat ?? 'none');
        let item: Schedule = {
          id: newId(),
          title: String(input.title ?? '제목 없음'),
          datetime: toLocalISO(when),
          notifyMinutesBefore:
            typeof input.notify_minutes_before === 'number'
              ? input.notify_minutes_before
              : 30,
          notificationId: null,
          memo: String(input.memo ?? ''),
          done: false,
          createdAt: Date.now(),
          repeat:
            repeatInput === 'daily' || repeatInput === 'weekly'
              ? repeatInput
              : 'none',
        };
        item = await setScheduleNotification(item);
        schedules.push(item);
        await saveSchedules(schedules);
        return {
          result: JSON.stringify({
            ok: true,
            saved: scheduleBrief(item),
            notificationScheduled: item.notificationId !== null,
            conflicts: conflicts.map(scheduleBrief),
          }),
          changed: true,
        };
      }

      case 'list_schedules': {
        const schedules = await loadSchedules();
        const sorted = [...schedules].sort(
          (a, b) =>
            new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        );
        return {
          result: JSON.stringify({ schedules: sorted.map(scheduleBrief) }),
          changed: false,
        };
      }

      case 'complete_schedule':
      case 'delete_schedule': {
        const schedules = await loadSchedules();
        const idx = schedules.findIndex((s) => s.id === String(input.id));
        if (idx < 0) {
          return {
            result: JSON.stringify({ error: '해당 id의 일정이 없음' }),
            changed: false,
          };
        }
        const target = schedules[idx];
        await cancelLocalNotification(target.notificationId);
        if (name === 'complete_schedule') {
          target.done = true;
          target.notificationId = null;
        } else {
          schedules.splice(idx, 1);
        }
        await saveSchedules(schedules);
        return {
          result: JSON.stringify({ ok: true, title: target.title }),
          changed: true,
        };
      }

      case 'add_memo': {
        const memos = await loadMemos();
        const memo: Memo = {
          id: newId(),
          title: String(input.title ?? '제목 없음'),
          content: String(input.content ?? ''),
          tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
          createdAt: Date.now(),
        };
        memos.unshift(memo);
        await saveMemos(memos);
        return {
          result: JSON.stringify({ ok: true, saved: memoBrief(memo) }),
          changed: true,
        };
      }

      case 'list_memos': {
        const memos = await loadMemos();
        return {
          result: JSON.stringify({ memos: memos.map(memoBrief) }),
          changed: false,
        };
      }

      case 'search_memos': {
        const q = String(input.query ?? '').toLowerCase();
        const memos = await loadMemos();
        const hits = memos.filter(
          (m) =>
            m.title.toLowerCase().includes(q) ||
            m.content.toLowerCase().includes(q) ||
            m.tags.some((t) => t.toLowerCase().includes(q))
        );
        return {
          result: JSON.stringify({ memos: hits.map(memoBrief) }),
          changed: false,
        };
      }

      case 'delete_memo': {
        const memos = await loadMemos();
        const idx = memos.findIndex((m) => m.id === String(input.id));
        if (idx < 0) {
          return {
            result: JSON.stringify({ error: '해당 id의 메모가 없음' }),
            changed: false,
          };
        }
        const [removed] = memos.splice(idx, 1);
        await saveMemos(memos);
        return {
          result: JSON.stringify({ ok: true, title: removed.title }),
          changed: true,
        };
      }

      default:
        return {
          result: JSON.stringify({ error: `알 수 없는 도구: ${name}` }),
          changed: false,
        };
    }
  } catch (e: any) {
    return {
      result: JSON.stringify({ error: `도구 실행 오류: ${e?.message ?? e}` }),
      changed: false,
    };
  }
}

/** 일정 화면에서 직접 추가/수정할 때도 같은 알림 로직을 쓰도록 공개 */
export { setScheduleNotification };
