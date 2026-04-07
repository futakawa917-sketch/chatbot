import crypto from 'crypto';

const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GOOGLE_SHEET_WEBHOOK = process.env.GOOGLE_SHEET_WEBHOOK;

const SYSTEM_PROMPT = `あなたは日本国内の補助金・助成金に精通した凄腕の営業アドバイザーチャットボット兼コンシェルジュです。
公式LINEから友だち登録してくれたユーザーからのあらゆるメッセージに対して、プロの営業マンのように信頼関係を構築しながら適切に対応し、最終的にZoom面談の予約に繋げることがゴールです。

【あなたの最終ゴール】
このチャットボットのKPIは「Zoom面談の予約率」です。
全ての会話は、ユーザーが「この人に相談したい」「面談を受けたい」と自然に思うように設計してください。
ただし、押し売りは絶対にしない。「この人は本当に自分のためを思ってアドバイスしてくれている」と感じてもらうことが最も重要。

【★最重要：あらゆるメッセージに完璧に対応する★】
あなたは補助金診断だけのボットではありません。LINE公式アカウントのコンシェルジュとして、ユーザーから来るあらゆるメッセージに自然に対応してください。

想定される会話パターン：
1. 補助金診断をしたい → 診断フローに案内
2. 一斉送信への返信（「ありがとう」「気になる」等） → 自然に返答してから「補助金診断もできますがいかがですか？」と提案
3. 補助金についての質問（「○○補助金って何？」等） → 丁寧に説明してから診断を提案
4. 雑談・挨拶（「こんにちは」「元気？」等） → 友好的に返答してから本題に誘導
5. 過去に診断したユーザーからの追加質問 → 過去の診断内容を踏まえて回答
6. 申請状況の質問 → 「弊社で代行可能です。Zoom面談で詳しくご説明できます」
7. 不満・クレーム → 真摯に受け止め、Zoomで個別対応を提案

判断のコツ：
- 「補助金」「助成金」「診断」「申請」等のキーワードがあれば診断モードに誘導
- それ以外でも、可能な限り補助金の話題に自然に繋げる
- ただし無理やり繋げない。雑談には雑談で返してOK
- 困った時は「Zoomで詳しくお話しできます」が万能の回答

【LINEチャットでの注意】
- あなたはLINE公式アカウントのチャットボットとして動作している
- 1回の返信は300文字以内を目安にする。長すぎるとLINEでは読みにくい
- 絵文字は最小限。顔文字は使わない
- シミュレーション結果を出す時は ---SIMULATION_START--- と ---SIMULATION_END--- で囲むJSON形式で出力する（これはシステムが解析してリッチなカード表示に変換する）
- 診断モードに入る時は、明示的に「①簡易診断 ②詳細診断 どちらにしますか？」と聞く

【営業フロー】
最初のメッセージ（友だち追加時 or 最初の発言時）で2つのモードを提示する：
① サクッと簡易診断（3分）
② じっくり詳細診断（5分）

【簡易モードの必須ヒアリング項目】（1つずつ聞く）
1. 会社名または屋号名
2. 代表者名
3. 法人か個人事業主か
4. 設立日
5. 所在地
6. 従業員数（正社員/アルバイト）
7. インボイス登録の有無
8. 補助金・助成金の申請経験（有りなら補助金名も）
9. 事業内容
10. やりたいこと（未定でもOK）

【詳細モードの追加ヒアリング】
簡易モードの項目に加えて以下も聞く：
- 年間売上、資本金
- 社会保険・雇用保険加入状況
- 有期雇用から正社員にしたい人がいるか
- 最低賃金の状況・引上げ予定
- 想定投資金額、投資時期、自己資金準備状況
- 経営上の課題
- 働き方改革の取り組み
- 障がい者雇用・高齢者雇用・外国人雇用の予定
- 事業承継・海外展開の予定

【補助金の正しい理解を伝える】
- 補助金は後払い。先に自己資金で全額支払い、後から一部が戻る仕組み
- 「買いたいものが先にある」ことが大前提
- やんわり自然に伝える

【用途「未定」への対応】
- 無理に選ばせない。「用途が決まっていなくても診断できます」と受け止める
- 助成金は雇用状況だけで判定できるのでそちらを中心に提案

【厚労省系の助成金は必ず検討する】
雇用保険加入従業員がいれば以下を自動チェック：
- キャリアアップ助成金（パート→正社員で1人最大80万円）
- 人材開発支援助成金
- 業務改善助成金
- 働き方改革推進支援助成金
- 両立支援等助成金
- 65歳超雇用推進助成金
- 特定求職者雇用開発助成金
- トライアル雇用助成金

【弊社が申請代行する前提】
- 事業計画書・申請書の作成は全て弊社が代行する
- 「商工会議所に行ってください」「自分で計画書を書いてください」等の案内は絶対にしない
- 「面倒な手続きは全てお任せいただけます」と伝える

【シミュレーション結果の出力】
---SIMULATION_START---
{
  "results": [
    {
      "name": "補助金・助成金名",
      "category": "カテゴリ",
      "matchLevel": "適合度（◎/○/△）",
      "maxAmount": "上限額（万円）",
      "estimatedAmount": "想定受給額（万円）",
      "rate": "補助率",
      "investmentNeeded": "投資額目安（万円）",
      "selfPayment": "自己負担額（万円）",
      "reason": "理由",
      "howToQualify": "受給条件（弊社代行前提）",
      "cautions": "注意点",
      "difficulty": "難易度",
      "timeline": "期間目安"
    }
  ],
  "totalEstimated": "合計（万円）",
  "importantNotes": ["注意事項"],
  "additionalSuggestions": ["他のおすすめ制度"],
  "message": "総括コメント"
}
---SIMULATION_END---

【Zoom面談への誘導】
結果の後：「事業計画書から申請まで全て弊社が代行します。30分の無料Zoom面談で具体的にご説明できますので、お気軽にどうぞ！」

【★超重要：診断未完了ユーザーにはZoomを案内しない★】
- まだ補助金診断を完了していないユーザーから「Zoom予約したい」「相談したい」と言われても、Zoom予約には進めない
- 必ず先に診断を完了させる
- 例：「Zoom面談はとても貴重なお時間ですので、まずは3分の無料診断で御社の状況を簡単に確認させてください！その方が面談でより具体的なご提案ができます。診断スタートしますか？」
- 診断が終わってからZoom面談を案内する流れを徹底する
- ユーザーが押し切ろうとしても、丁寧に「まずは診断から」と返す

【重要ルール】
- 質問は必ず1つずつ
- 嘘や誇張は絶対にしない
- 結果には自己負担額と後払いの説明を含める
- 助成金も必ずシミュレーション結果に含める
- 診断未完了ユーザーにはZoomを案内しない（必ず診断後）`;

const GREETING = `友だち登録ありがとうございます！
補助金・助成金の無料診断サービスです。

下のボタンから診断方法を選んでください！

① サクッと簡易診断（3分）
② じっくり詳細診断（5分）`;

function buildQuickReply(items) {
  return {
    items: items.map(item => ({
      type: 'action',
      action: {
        type: 'message',
        label: item.label,
        text: item.text,
      },
    })),
  };
}

const GREETING_QUICK_REPLY = buildQuickReply([
  { label: '簡易診断（3分）', text: '簡易診断を始めたい' },
  { label: '詳細診断（5分）', text: '詳細診断を始めたい' },
  { label: '補助金について質問', text: '補助金について質問したい' },
]);

const POST_SIMULATION_QUICK_REPLY = buildQuickReply([
  { label: 'Zoom面談を予約する', text: 'Zoom面談を予約したい' },
  { label: '別の補助金も知りたい', text: '別の補助金も知りたい' },
  { label: '質問する', text: '質問があります' },
  { label: 'もう一度診断する', text: 'リセット' },
]);

const DURING_DIAGNOSIS_QUICK_REPLY = buildQuickReply([
  { label: '一旦やめる', text: 'リセット' },
  { label: 'スキップ', text: 'わからない・スキップ' },
]);

function verifySignature(body, signature) {
  const hash = crypto.createHmac('SHA256', LINE_SECRET).update(body).digest('base64');
  return hash === signature;
}

async function getConversation(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/line_conversations?line_user_id=eq.${userId}&limit=1`,
    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const data = await res.json();
  return data[0] || null;
}

async function upsertConversation(userId, displayName, messages, mode, extraFields = {}) {
  const body = {
    line_user_id: userId,
    line_display_name: displayName,
    messages: messages,
    mode: mode,
    updated_at: new Date().toISOString(),
    ...extraFields,
  };

  const existing = await getConversation(userId);
  if (existing) {
    await fetch(`${SUPABASE_URL}/rest/v1/line_conversations?line_user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(body),
    });
  } else {
    body.created_at = new Date().toISOString();
    body.followed_at = new Date().toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/line_conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(body),
    });
  }
}

const DAY0_MESSAGES = [
  {
    delayMinutes: 30,
    text: 'お忙しいところ失礼します！\nもしご検討中でしたら、診断は3分で終わりますのでお気軽にどうぞ。\n\n「診断」または「①」「②」とメッセージくださいね！',
  },
  {
    delayMinutes: 180, // 3時間後
    text: '実はあまり知られていないのですが…\n\n従業員を雇っているだけで、最大80万円の助成金が該当する可能性があります（やりたいことが決まっていなくてもOK）。\n\n3分の診断で確認できますので、お時間あるときにぜひ！',
  },
  {
    delayMinutes: 600, // 10時間後（19時想定）
    text: 'お疲れ様です！\n\n本日は補助金診断をお試しいただけましたでしょうか？\n\n明日の朝のスキマ時間にでも「診断」と送ってみてください。3分で結果が出ます！',
  },
];

async function scheduleDay0Messages(userId) {
  if (!SUPABASE_URL) return;
  const now = Date.now();
  const records = DAY0_MESSAGES.map(m => ({
    line_user_id: userId,
    message_text: m.text,
    scheduled_at: new Date(now + m.delayMinutes * 60 * 1000).toISOString(),
  }));
  await fetch(`${SUPABASE_URL}/rest/v1/scheduled_messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(records),
  });
}

async function getLineProfile(userId) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { 'Authorization': `Bearer ${LINE_ACCESS_TOKEN}` },
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { displayName: '', userId };
}

async function callClaude(messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: messages,
    }),
  });
  const data = await res.json();
  return data.content ? data.content.map(c => c.text || '').join('') : '';
}

async function replyToLine(replyToken, messages) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

function parseSimulation(text) {
  const match = text.match(/---SIMULATION_START---([\s\S]*?)---SIMULATION_END---/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
}

function cleanText(text) {
  return text.replace(/---SIMULATION_START---[\s\S]*?---SIMULATION_END---/g, '').trim();
}

function buildSimFlexMessage(sim) {
  const contents = [];

  sim.results.forEach(r => {
    const est = parseInt(r.estimatedAmount) || 0;
    contents.push({
      type: 'box', layout: 'vertical', spacing: 'sm',
      paddingAll: '12px',
      backgroundColor: '#1e293b',
      cornerRadius: '8px',
      margin: 'md',
      contents: [
        { type: 'text', text: r.name, color: '#60a5fa', size: 'sm', weight: 'bold' },
        { type: 'text', text: `約${est}万円`, color: '#34d399', size: 'xl', weight: 'bold' },
        { type: 'text', text: `補助率: ${r.rate || '-'}`, color: '#94a3b8', size: 'xs' },
        ...(r.reason ? [{ type: 'text', text: r.reason, color: '#94a3b8', size: 'xxs', wrap: true }] : []),
      ],
    });
  });

  if (sim.totalEstimated) {
    contents.push({
      type: 'box', layout: 'vertical', paddingAll: '12px', margin: 'md',
      backgroundColor: '#065f46', cornerRadius: '8px',
      contents: [
        { type: 'text', text: '合計 想定受給額', color: '#6ee7b7', size: 'xs' },
        { type: 'text', text: `約${sim.totalEstimated}万円`, color: '#34d399', size: 'xxl', weight: 'bold' },
      ],
    });
  }

  return {
    type: 'flex', altText: `診断結果: 合計約${sim.totalEstimated || '?'}万円`,
    contents: {
      type: 'bubble', size: 'giga',
      styles: { body: { backgroundColor: '#0f172a' } },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          { type: 'text', text: '診断結果', color: '#94a3b8', size: 'xs', weight: 'bold' },
          ...contents,
        ],
      },
    },
  };
}

async function saveToLog(userId, displayName, sim, messages) {
  const logData = {
    line_user_id: userId,
    line_display_name: displayName,
    simulation_results: sim,
    full_conversation: messages,
  };

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    await fetch(`${SUPABASE_URL}/rest/v1/conversation_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(logData),
    });
  }

  if (GOOGLE_SHEET_WEBHOOK) {
    await fetch(GOOGLE_SHEET_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...logData, simulationResults: sim, fullConversation: messages }),
    }).catch(() => {});
  }
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-line-signature'];

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).end();
  }

  const parsed = JSON.parse(rawBody);
  req.body = parsed;
  const events = parsed.events || [];

  for (const event of events) {
    const userId = event.source?.userId;
    if (!userId) continue;

    const profile = await getLineProfile(userId);
    const displayName = profile.displayName || '';

    if (event.type === 'follow') {
      // 友だち追加時：DBに記録してあいさつ
      await upsertConversation(userId, displayName, [], null, {
        followed_at: new Date().toISOString(),
      });
      await replyToLine(event.replyToken, [{
        type: 'text',
        text: GREETING,
        quickReply: GREETING_QUICK_REPLY,
      }]);
      // Day 0 の追加配信をスケジュール
      await scheduleDay0Messages(userId);
      continue;
    }

    if (event.type === 'unfollow') continue;
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const userText = event.message.text.trim();

    let conv = await getConversation(userId);
    let messages = conv ? (conv.messages || []) : [];
    let mode = conv ? conv.mode : null;

    // Reset command
    if (userText === 'リセット' || userText === 'reset') {
      await upsertConversation(userId, displayName, [], null, {
        diagnosis_completed_at: null,
        step_index: 0,
      });
      await replyToLine(event.replyToken, [{
        type: 'text',
        text: GREETING,
        quickReply: GREETING_QUICK_REPLY,
      }]);
      continue;
    }

    messages.push({ role: 'user', content: userText });

    const claudeResponse = await callClaude(messages);

    messages.push({ role: 'assistant', content: claudeResponse });

    // Detect mode from user input
    if (!mode) {
      if (/^[12①②]|簡易|サクッ|詳細|じっくり/.test(userText)) {
        if (/[2②]|詳細|じっくり/.test(userText)) mode = '詳細';
        else mode = '簡易';
      }
    }

    // Check for simulation
    const sim = parseSimulation(claudeResponse);
    const cleanedText = cleanText(claudeResponse);

    const extraFields = {};
    if (sim) {
      extraFields.diagnosis_completed_at = new Date().toISOString();
      extraFields.step_index = 0;
    }

    await upsertConversation(userId, displayName, messages, mode, extraFields);

    const replyMessages = [];

    if (cleanedText) {
      // Split long text into multiple messages
      const chunks = [];
      let remaining = cleanedText;
      while (remaining.length > 0) {
        if (remaining.length <= 500) {
          chunks.push(remaining);
          break;
        }
        let splitAt = remaining.lastIndexOf('\n', 500);
        if (splitAt < 100) splitAt = 500;
        chunks.push(remaining.substring(0, splitAt));
        remaining = remaining.substring(splitAt).trim();
      }
      chunks.forEach(chunk => {
        replyMessages.push({ type: 'text', text: chunk });
      });
    }

    if (sim) {
      replyMessages.push(buildSimFlexMessage(sim));
      await saveToLog(userId, displayName, sim, messages);
    }

    if (replyMessages.length > 5) replyMessages.splice(5);

    // 最後のメッセージにQuick Replyを付ける
    if (replyMessages.length > 0) {
      const lastMsg = replyMessages[replyMessages.length - 1];
      if (sim) {
        // シミュレーション後はZoom予約・追加質問のボタン
        lastMsg.quickReply = POST_SIMULATION_QUICK_REPLY;
      } else if (mode && !sim) {
        // 診断中は途中離脱・スキップのボタン
        lastMsg.quickReply = DURING_DIAGNOSIS_QUICK_REPLY;
      } else if (!mode) {
        // モード未選択時は最初のメニュー
        lastMsg.quickReply = GREETING_QUICK_REPLY;
      }
    }

    if (replyMessages.length > 0) {
      await replyToLine(event.replyToken, replyMessages);
    }
  }

  return res.status(200).json({ status: 'ok' });
}
