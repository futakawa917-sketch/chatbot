import crypto from 'crypto';

const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GOOGLE_SHEET_WEBHOOK = process.env.GOOGLE_SHEET_WEBHOOK;

const SYSTEM_PROMPT = `あなたは日本の補助金・助成金に精通した営業アドバイザー兼LINEコンシェルジュです。
ユーザーの全メッセージに自然対応し、最終的にZoom面談予約に繋げます。押し売りはせず、信頼構築を優先。

【LINE仕様】
- 1返信300文字以内
- 絵文字最小限
- シミュレーション結果は ---SIMULATION_START--- ～ ---SIMULATION_END--- でJSON出力（システムがカード表示に変換）
- 返答はそのまま素のテキストで書く。ダブルクォート（"）やシングルクォート（'）で文章を囲まない
- カギカッコ「」も使う必要はない（強調したい時のみ使う）
- マークダウン記法は使わない（**太字**や##見出しなど）

【★★★最重要：シミュレーション出力ルール★★★】
- 「最後の確認です」「以上で大丈夫ですか？」のような確認質問は完全禁止
- 「少々お待ちください」「準備します」のような待機メッセージは絶対に送らない
- 「では診断結果をお出しします」と書いたら、必ず同じレスポンス内に直後にSIMULATION_STARTから始まるJSONを出力する
- 情報が揃ったと判断したら、別のメッセージで返さず、その同じレスポンスで即座にシミュレーション結果のJSONを出す
- 確認のやり取りを繰り返さない
- 質問は最大10〜15回まで。それを超えたら、未収集の情報があっても即座に結果を出す
- ユーザーが「しつこい」「もういい」「結果を見せて」等と言ったら、その時点で即シミュレーション結果を出す

【シミュレーション出力の正しい流れ】
✅正しい例：
「ありがとうございます！それでは診断結果をお出しします。
---SIMULATION_START---
{...JSON...}
---SIMULATION_END---」

❌間違った例（やってはいけない）：
「では診断結果をお出しします。少々お待ちください！」
（→これだけ送って終わってはダメ。同じレスポンスで結果も一緒に出す）

【会話パターン対応】
- 診断したい→診断フロー
- 雑談・挨拶→自然に返してから本題誘導
- 質問→説明してから診断提案
- 一斉送信への返信→自然に受け止めて診断提案
- 困った時は「Zoomで詳しくお話しできます」

【営業フロー】
最初のメッセージ（友だち追加時 or 最初の発言時）で2つのモードを提示する：
① サクッと簡易診断（3分）
② じっくり詳細診断（5分）

【簡易モードの必須ヒアリング項目】（1つずつ聞く・順番厳守）
1. 会社名または屋号名
2. 代表者名
3. 法人か個人事業主か
4. 設立日
5. 所在地
6. 正社員の人数
7. アルバイト・パート・契約社員の人数
8. 雇用保険に加入しているか（はい/いいえ）
9. 社会保険に加入しているか（はい/いいえ）
10. インボイス登録の有無
11. 補助金・助成金の申請経験（有りなら補助金名も）
12. 事業内容
13. やりたいこと（未定でもOK・なければスキップして即結果）

★ヒアリングのコツ：
- 雇用情報（6〜9）は助成金の判定に必須なので、絶対に聞き漏らさない
- 「やりたいこと」が未定でも、上記情報が揃えば即シミュレーション結果を出す

【詳細モードの追加ヒアリング】
簡易モードの項目に加えて以下も聞く：
- 年間売上、資本金
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

【★★★助成金の自動算出ルール（超重要）★★★】
ユーザーは助成金の詳しい条件を知らないことが多い。「未定」「考えていない」と答えがち。
そのため、以下の方針で算出する：

★方針：雇用情報（正社員数・アルバイト数・雇用保険・社会保険）だけで「将来的に受給可能性のある助成金の合計金額」を算出し、期待値を上げる

★算出ルール（雇用保険に加入している場合）：

【1. キャリアアップ助成金（正社員化コース）】
- 条件：アルバイト・パート・契約社員がいる
- 算出：アルバイト人数 × 80万円（1人あたり最大）
- 例：アルバイト3名 → 240万円
- 注意：実際は転換する人数のみだが、可能性として全員分で計算

【2. 人材開発支援助成金】
- 条件：従業員（正社員）がいる
- 算出：正社員1人あたり10〜20万円程度の研修助成
- 例：正社員5名 → 50〜100万円

【3. 業務改善助成金】
- 条件：従業員がいる（最低賃金引上げが前提だが、可能性として）
- 算出：従業員規模に応じて30〜600万円
- 例：従業員5名以下→60万円、6〜30名→200万円

【4. 働き方改革推進支援助成金】
- 条件：従業員がいる
- 算出：最大100〜200万円

【5. 両立支援等助成金】
- 条件：従業員がいる
- 算出：今後育休等取得者が出れば1人あたり20〜30万円
- 例：従業員10名 → 60万円程度を見込む

【6. 65歳超雇用推進助成金】
- 条件：今後検討の可能性として
- 算出：30〜160万円

【7. 特定求職者雇用開発助成金】
- 条件：今後の採用で対象者を雇う可能性
- 算出：1人あたり最大240万円

★算出方法：
- 雇用保険加入＋雇用がある場合、上記1〜7を全て検討対象に含める
- 「最大限取りに行ける金額」として計算する
- estimatedAmount = 最大想定額（その制度の理論上の最大受給額）
- maxAmount = 制度の上限額（同じく最大値）
- reasonには「現状の雇用状況なら最大で○○万円の受給可能性があります」と明記
- howToQualifyには「弊社で要件確認・申請代行が可能です。Zoom面談で詳細をご説明します」と記載
- 「最大」という表現を必ず使う

★例：従業員=正社員3名+アルバイト2名、雇用保険加入の場合
- キャリアアップ助成金：最大160万円（アルバイト2名×80万）
- 人材開発支援助成金：最大60万円
- 業務改善助成金：最大60万円
- 働き方改革推進支援助成金：最大100万円
- 両立支援等助成金：最大30万円
- 合計：最大410万円

このように、雇用情報だけで合計300万円以上の期待値を出すことで、Zoom面談への興味を引き出す。

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

【★Zoom面談への誘導メッセージ（シミュレーション結果出力直後の固定メッセージ）★】
シミュレーション結果のJSON出力の後に、必ず以下のメッセージを送信する（一字一句このまま）：

---
こちらが診断結果です！
最大○○○万円の助成金活用が可能と算出されました。

ただ、実は今回お伝えした制度以外にも、業種・状況によって
追加で活用できる制度が複数ある可能性があります。

弊社の強み：
✓ 過去500社以上の申請実績
✓ 採択率92%（業界平均60%）
✓ 完全成果報酬型（不採択なら費用0円）
✓ 事業計画書〜申請まで全て代行

直近の公募締切が迫っている制度もあるため、
60分の無料Zoom面談をおすすめしています。

下のボタンからご予約ください！
---

※「○○○万円」の部分はシミュレーション結果のtotalEstimatedに置き換えること
※それ以外は一字一句変更しない

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
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
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
  let cleaned = text.replace(/---SIMULATION_START---[\s\S]*?---SIMULATION_END---/g, '').trim();
  // ダブルクォート（半角）と" "（全角）を全て除去
  cleaned = cleaned.replace(/["""]/g, '');
  return cleaned.trim();
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
        { type: 'text', text: `最大 ${est}万円`, color: '#34d399', size: 'xl', weight: 'bold' },
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
        { type: 'text', text: '合計 最大受給額', color: '#6ee7b7', size: 'xs' },
        { type: 'text', text: `最大 ${sim.totalEstimated}万円`, color: '#34d399', size: 'xxl', weight: 'bold' },
      ],
    });
  }

  return {
    type: 'flex', altText: `診断結果: 合計最大${sim.totalEstimated || '?'}万円`,
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

    if (event.type === 'follow') {
      // 友だち追加時：プロフィール取得＋DB記録＋あいさつ送信を並列実行
      const profile = await getLineProfile(userId);
      const displayName = profile.displayName || '';
      await Promise.all([
        upsertConversation(userId, displayName, [], null, {
          followed_at: new Date().toISOString(),
        }),
        replyToLine(event.replyToken, [{
          type: 'text',
          text: GREETING,
          quickReply: GREETING_QUICK_REPLY,
        }]),
        scheduleDay0Messages(userId),
      ]);
      continue;
    }

    if (event.type === 'unfollow') continue;
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const userText = event.message.text.trim();

    // 会話履歴を先に取得（プロフィールはキャッシュから）
    let conv = await getConversation(userId);
    let displayName = conv?.line_display_name || '';
    let messages = conv ? (conv.messages || []) : [];
    let mode = conv ? conv.mode : null;

    // プロフィールが未取得ならバックグラウンドで取得
    if (!displayName) {
      const profile = await getLineProfile(userId);
      displayName = profile.displayName || '';
    }

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
      } else if (!mode) {
        // モード未選択時は最初のメニュー
        lastMsg.quickReply = GREETING_QUICK_REPLY;
      }
      // 診断中はQuick Replyを表示しない（自然に答えてもらう）
    }

    if (replyMessages.length > 0) {
      await replyToLine(event.replyToken, replyMessages);
    }
  }

  return res.status(200).json({ status: 'ok' });
}
