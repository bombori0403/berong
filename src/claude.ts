// 베롱이의 두뇌: Claude API 호출 + 도구 사용 루프
import { runTool } from './agentTools';
import { formatDateTime, nowDescription } from './dates';
import { getApiKey, loadSchedules, loadSettings } from './storage';
import { ChatMessage } from './types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOOL_TURNS = 6;
const HISTORY_LIMIT = 30; // 최근 대화만 전송해서 비용 절약

/** 모델에 맞는 Anthropic 서버측 웹 검색 도구를 포함한 전체 도구 목록 */
function buildTools(model: string) {
  // Sonnet 5.5는 동적 필터링이 되는 최신 버전, Haiku 4.5는 기본 버전 사용
  const webSearchType = model.startsWith('claude-haiku')
    ? 'web_search_20250305'
    : 'web_search_20260209';
  return [
    { type: webSearchType, name: 'web_search', max_uses: 3 },
    ...TOOLS,
  ];
}

const TOOLS = [
  {
    name: 'add_schedule',
    description:
      '새 일정을 등록하고 필요하면 미리 알림을 예약한다. 사용자가 일정/약속/할 일을 말하면 사용.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '일정 제목 (간결하게)' },
        datetime: {
          type: 'string',
          description: '일정 시각, "YYYY-MM-DD HH:mm" 형식 (24시간제)',
        },
        notify_minutes_before: {
          type: 'number',
          description:
            '몇 분 전에 알림을 보낼지. 기본 30. 알림이 필요 없으면 생략하지 말고 사용자 요청에 맞게 지정. 반복 일정에서 정각에 울리게 하려면 0.',
        },
        repeat: {
          type: 'string',
          enum: ['none', 'daily', 'weekly'],
          description:
            '반복 여부. "매일" 요청이면 daily, "매주 X요일" 요청이면 weekly (datetime을 해당 요일의 가장 가까운 날짜로 지정). 기본 none.',
        },
        memo: { type: 'string', description: '부가 메모 (선택)' },
      },
      required: ['title', 'datetime'],
    },
  },
  {
    name: 'list_schedules',
    description: '등록된 모든 일정을 조회한다.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'complete_schedule',
    description: '일정을 완료 처리한다.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'delete_schedule',
    description: '일정을 삭제한다. 삭제 전 반드시 사용자에게 확인받을 것.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'add_memo',
    description:
      '메모를 저장한다. 사용자가 기억해달라는 정보, 아이디어, 할 일 목록 등을 정리해 저장할 때 사용.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '메모 제목' },
        content: { type: 'string', description: '정리된 메모 내용' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '분류 태그 (예: 쇼핑, 아이디어, 중요)',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'list_memos',
    description: '저장된 메모 전체를 조회한다.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_memos',
    description: '키워드로 메모를 검색한다.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'delete_memo',
    description: '메모를 삭제한다. 삭제 전 반드시 사용자에게 확인받을 것.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
];

async function buildSystemPrompt(): Promise<string> {
  const settings = await loadSettings();
  const schedules = await loadSchedules();
  const upcoming = schedules
    .filter((s) => !s.done && new Date(s.datetime).getTime() > Date.now() - 60 * 60_000)
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    .slice(0, 10)
    .map((s) => `- [${s.id}] ${formatDateTime(s.datetime)} ${s.title}`)
    .join('\n');

  const callUser = settings.userName ? `${settings.userName}님` : '주인님';

  return `너는 "베롱이"야. ${callUser}의 전담 개인 비서이자 핸드폰 속 AI 에이전트야.

성격과 말투:
- 친근하고 따뜻하지만 유능하고 똑부러지는 비서. 한국어로 자연스럽게 대화한다.
- 답변은 짧고 명확하게. 핸드폰 화면이므로 긴 글은 피한다.

핵심 임무:
1. 일정 관리: 일정 얘기가 나오면 도구로 바로 등록/조회한다. 날짜가 모호하면("다음주쯤") 먼저 확인 질문을 한다.
2. 실수 방지: 일정이 겹치면 반드시 경고한다. 중요해 보이는 일(약 복용, 마감, 예약)은 알림을 먼저 제안한다. 사용자가 뭔가 잊은 것 같으면 먼저 짚어준다.
3. 정보 정리: 사용자가 두서없이 던진 내용도 깔끔하게 제목·태그를 붙여 메모로 정리한다.
4. 웹 검색: 최신 정보(가게 영업시간, 맛집, 날씨, 뉴스 등)가 필요하면 web_search로 검색해서 알려준다. "근처/우리집 주변"이라고 하면 아래 사용자 동네를 기준으로 검색한다. 검색 결과는 핵심만 간추려 짧게 답한다 (음성으로 읽히므로 URL은 말하지 않는다).
5. 사진 분석: 사용자가 사진을 보내면 내용을 읽고 핵심을 정리한다. 예약증·안내문·청구서면 날짜/시간/금액을 뽑아 일정 등록이나 메모 저장을 제안한다.
6. 메신저 대화 정리: 카톡 캡처나 붙여넣은 대화가 오면 ①중요 내용 요약 ②약속/일정/할 일 추출 ③일정 등록 제안을 한다.
7. 아침 브리핑: "[아침 브리핑]" 요청이 오면 오늘 일정을 조회하고, 오늘 날씨를 웹 검색해서, 인사+일정+날씨+챙길 것을 상냥하고 짧게 브리핑한다.
8. 삭제는 반드시 사용자 확인 후에만 실행한다.

사용자 동네: ${settings.homeArea || '(미설정 — "근처" 검색 시 동네를 먼저 물어볼 것)'}

현재 시각: ${nowDescription()}
다가오는 일정:
${upcoming || '- (등록된 일정 없음)'}

날짜 계산 시 반드시 위의 현재 시각을 기준으로 한다. "내일"은 현재 날짜 +1일이다.`;
}

export class BerongError extends Error {}

/**
 * Claude API 호출. 표준 방식(x-api-key)이 401로 거부되면
 * 새 키 타입용 방식(Authorization: Bearer)으로 자동 재시도한다.
 */
async function fetchClaude(
  apiKey: string,
  body: any
): Promise<{ res: Response; authMode: string }> {
  const headerSets: { mode: string; headers: Record<string, string> }[] = [
    {
      mode: 'x-api-key',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    },
    {
      mode: 'bearer',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
    },
  ];
  let last: { res: Response; authMode: string } | null = null;
  for (const { mode, headers } of headerSets) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    last = { res, authMode: mode };
    if (res.status !== 401 && res.status !== 403) return last;
  }
  return last!;
}

/**
 * 설정 화면의 "연결 테스트"용: 최소 요청을 보내 서버의 응답을 그대로 돌려준다.
 */
export async function testApiConnection(): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) return '저장된 API 키가 없어요. 키를 먼저 저장해주세요.';
  const settings = await loadSettings();
  try {
    const { res, authMode } = await fetchClaude(apiKey, {
      model: settings.model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'hi' }],
    });
    const body = await res.text();
    if (res.ok) {
      return `✅ 연결 성공! 베롱이가 정상 작동합니다.\n(인증 방식: ${authMode}, 모델: ${settings.model})`;
    }
    return `❌ 실패 (HTTP ${res.status})\n저장된 키: ${apiKey.slice(0, 14)}…${apiKey.slice(-4)} (${apiKey.length}자)\n모델: ${settings.model}\n두 가지 인증 방식 모두 시도함\n\n서버 응답:\n${body.slice(0, 400)}\n\n💡 콘솔(platform.claude.com) 키 목록에서 끝 4글자가 "${apiKey.slice(-4)}"인 키가 있는지 확인해보세요. 없다면 이미 삭제된 키예요!`;
  } catch (e: any) {
    return `❌ 네트워크 오류: ${e?.message ?? e}`;
  }
}

type ApiContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: any };

/**
 * 사용자 메시지에 대한 베롱이의 답변을 생성.
 * 도구 사용(일정/메모 조작)이 필요하면 스스로 실행하고 결과까지 반영해 답한다.
 * @returns 최종 답변 텍스트와, 일정/메모 데이터 변경 여부
 */
export async function askBerong(
  history: ChatMessage[]
): Promise<{ text: string; dataChanged: boolean }> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new BerongError(
      '아직 API 키가 없어요. 설정 탭에서 Anthropic API 키를 등록해주세요!'
    );
  }
  const settings = await loadSettings();
  const system = await buildSystemPrompt();

  const recent = history.slice(-HISTORY_LIMIT);
  const apiMessages: any[] = recent.map((m, idx) => {
    // 사진은 토큰 비용이 커서 최근 4개 메시지 안의 것만 실제로 전송
    const isRecentEnough = idx >= recent.length - 4;
    if (m.imageBase64 && isRecentEnough) {
      return {
        role: m.role,
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: m.imageBase64,
            },
          },
          { type: 'text', text: m.text || '이 사진을 분석해줘.' },
        ],
      };
    }
    // 긴 대화 파일도 최근 4개 메시지 안의 것만 전체 내용을 전송
    if (m.fileText && isRecentEnough) {
      return {
        role: m.role,
        content: `${m.text}\n\n[첨부된 대화 파일: ${m.fileName ?? '파일'}]\n${m.fileText}`,
      };
    }
    let text = m.text;
    if (m.imageBase64) text = `[사진을 보냈음] ${text}`;
    if (m.fileText) text = `[대화 파일을 보냈음: ${m.fileName ?? ''}] ${text}`;
    return { role: m.role, content: text };
  });

  let dataChanged = false;
  let finalText = '';

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const { res } = await fetchClaude(apiKey, {
      model: settings.model,
      max_tokens: 2048,
      system,
      tools: buildTools(settings.model),
      messages: apiMessages,
    });

    if (!res.ok) {
      let detail = '';
      try {
        const err = await res.json();
        detail = err?.error?.message ?? '';
      } catch {}
      if (res.status === 401) {
        throw new BerongError('API 키가 올바르지 않아요. 설정에서 다시 확인해주세요.');
      }
      if (res.status === 429) {
        throw new BerongError('지금 요청이 너무 많아요. 잠시 후 다시 시도해주세요.');
      }
      throw new BerongError(`베롱이 연결에 문제가 생겼어요 (${res.status}). ${detail}`);
    }

    const data = await res.json();
    const blocks: ApiContentBlock[] = data.content ?? [];
    const textParts = blocks
      .filter((b): b is Extract<ApiContentBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text);
    if (textParts.length > 0) finalText = textParts.join('\n');

    // 웹 검색 등 서버측 작업이 길어져 턴이 일시정지된 경우: 그대로 이어서 재요청
    if (data.stop_reason === 'pause_turn') {
      apiMessages.push({ role: 'assistant', content: blocks });
      continue;
    }

    if (data.stop_reason !== 'tool_use') {
      return { text: finalText || '…', dataChanged };
    }

    // 도구 실행 후 결과를 붙여서 다시 질의
    apiMessages.push({ role: 'assistant', content: blocks });
    const toolResults: any[] = [];
    for (const block of blocks) {
      if (block.type !== 'tool_use') continue;
      const { result, changed } = await runTool(block.name, block.input);
      if (changed) dataChanged = true;
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      });
    }
    apiMessages.push({ role: 'user', content: toolResults });
  }

  return {
    text: finalText || '처리하다가 단계가 너무 길어졌어요. 다시 한번 말씀해주실래요?',
    dataChanged,
  };
}
