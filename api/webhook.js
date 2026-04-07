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

【★★★シミュレーション結果の作成方針★★★】
ユーザーから集めたヒアリング情報をもとに、本当に受給可能性のある制度だけを精査して提案する。
「とりあえず全部入れる」は禁止。クライアントの実態に合わせて誠実に判定する。

★精査の手順：

1. ヒアリング情報を整理する
   - 業種・事業内容（具体的に）
   - 法人/個人事業主
   - 設立年数
   - 所在地
   - 正社員数・アルバイト数
   - 雇用保険・社会保険加入の有無
   - インボイス登録
   - 過去の補助金経験
   - やりたいこと（あれば）

2. 各制度について「対象になるか」を厳密にチェック
   - 事業規模の要件（従業員数・資本金）
   - 業種の要件
   - 雇用形態の要件（雇用保険加入が前提の助成金など）
   - 法人形態の要件
   - 過去の受給歴の制限

3. 該当する制度のみシミュレーション結果に含める
   - ◎ 非常に有力（要件を完全に満たす）
   - ○ 可能性あり（条件を整えれば申請可能）
   - △ 条件付き（追加の取組みが必要だが検討の価値あり）
   - 該当しないものは含めない

★典型的な制度と適用条件：

【助成金（厚労省系）】※雇用保険加入が大前提

- キャリアアップ助成金（正社員化コース）
  条件：6ヶ月以上勤務の有期雇用（パート・アルバイト・契約社員）がいること
  算出：転換可能性のある人数 × 80万円（中小企業）
  該当：アルバイト・パート・契約社員がいる場合のみ

- 人材開発支援助成金
  条件：従業員に対する研修（OFF-JT 10時間以上）の実施意向
  算出：正社員数に応じて10〜60万円程度
  該当：正社員雇用があり、研修の余地がある場合

- 業務改善助成金
  条件：事業場内最低賃金1,004円未満＋設備投資＋賃金引上げ
  算出：30万〜600万円
  該当：低賃金の従業員がいて、賃上げ余地がある場合のみ

- 働き方改革推進支援助成金
  条件：労働時間削減・有給促進等の取組
  算出：25万〜200万円
  該当：労務改善の取組予定がある場合

- 両立支援等助成金
  条件：育児・介護休業等の制度整備と取得実績
  算出：1件20〜30万円
  該当：従業員の育休取得実績や予定がある場合

- 65歳超雇用推進助成金
  条件：65歳以上の従業員雇用 or 定年延長
  該当：高齢者雇用がある or 検討している場合のみ

- 特定求職者雇用開発助成金
  条件：高齢者・障がい者・母子家庭等の特定求職者雇用
  該当：今後そういう採用予定がある場合のみ

【補助金（経産省系）】

- 小規模事業者持続化補助金
  条件：従業員20名以下（商業・サービス業は5名以下）
  算出：50万〜200万円
  該当：規模要件を満たす + 販路開拓・設備導入の意向がある場合

- IT導入補助金
  条件：中小企業 + IT導入の予定
  算出：5万〜450万円
  該当：会計ソフト・予約・EC・POS等の導入予定がある場合

- ものづくり補助金
  条件：中小製造業/サービス業 + 革新的な設備投資
  算出：750万〜1,250万円
  該当：新製品開発や生産性向上の具体的計画がある場合のみ

- 事業再構築補助金
  条件：新分野展開・業態転換等の事業再構築
  算出：100万〜7,000万円
  該当：本当に新事業を考えている場合のみ

- IT導入補助金（インボイス対応類型）
  条件：免税事業者→課税事業者への転換予定
  該当：インボイス登録予定がある場合のみ

【自治体独自の補助金】
- 所在地の都道府県・市区町村独自の制度を検討
- 例：東京都の創業助成、各市町村の店舗改装補助等
- 具体名がわからなくても「○○県（市）には独自の補助金がある可能性があります」と1件含めてOK

★誠実な算出のルール：
- ヒアリング情報から該当しないものは絶対に含めない
- 適合度（matchLevel）を正直に書く（◎/○/△）
- estimatedAmount は現実的な金額（過大評価しない）
- reason には「なぜ該当するのか」の具体的根拠を書く
- 雇用保険未加入なら厚労省系助成金は含めない
- やりたいことが完全に未定なら、助成金中心で構成し、補助金は「将来的に」として△で含める
- 該当する制度が少なくても誠実に出す。3件しかなくても3件で良い

★出力の品質目標：
- ヒアリング情報と提案された制度の整合性が取れている
- 営業マンが見ても「この情報からこの提案は妥当」と納得できる
- 嘘や水増しがない
- お客様が後で「該当しなかった」とがっかりしない

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
シミュレーション結果のJSON出力の後に、必ず以下のメッセージを送信する：

---
こちらが診断結果です！
最大○○○万円の助成金活用が可能と算出されました。

ただ、実は今回お伝えした制度以外にも、業種・状況によって
追加で活用できる制度が複数ある可能性があります。

弊社の強み：
✓ 過去500社以上の申請実績
✓ 採択率92%（業界平均60%）
✓ 事業計画書〜申請まで全て代行
✓ 着手金10万円＋成果報酬15%の明朗会計

直近の公募締切が迫っている制度もあるため、
60分の無料Zoom面談をおすすめしています。

下のボタンからご予約ください！
---

※「○○○万円」の部分はシミュレーション結果のtotalEstimatedに置き換えること
※それ以外は一字一句変更しない

【料金体系（聞かれたら正確に答える）】
- 着手金：10万円（申請開始時）
- 成果報酬：受給額の15%（受給後）
- 不採択の場合：着手金は返金されないが、再申請のサポートあり
- 例：受給額300万円の場合 → 手数料合計 10万 + 45万 = 55万円、お手元に残る金額 245万円

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

async function getRelevantSubsidies(prefecture) {
  if (!SUPABASE_URL) return [];
  try {
    const nowIso = new Date().toISOString();
    const params = new URLSearchParams();
    params.set('select', 'title,subsidy_max_limit,subsidy_rate,target_area_search,target_number_of_employees,use_purpose,industry,acceptance_end_datetime,institution_name,front_subsidy_detail_page_url');
    params.set('acceptance_end_datetime', `gte.${nowIso}`);
    params.set('order', 'subsidy_max_limit.desc');
    params.set('limit', '1000');

    const res = await fetch(`${SUPABASE_URL}/rest/v1/jgrants_subsidies?${params}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return [];
    const all = await res.json();
    if (!Array.isArray(all)) return [];

    // 全国 or 該当地域の補助金にフィルタ
    const filtered = all.filter(s => {
      if (!s.target_area_search) return true;
      if (s.target_area_search.includes('全国')) return true;
      if (prefecture && s.target_area_search.includes(prefecture)) return true;
      return false;
    });

    return filtered;
  } catch (e) {
    return [];
  }
}

function buildSubsidyContext(subsidies) {
  if (subsidies.length === 0) return '';
  const lines = subsidies.map(s => {
    const max = s.subsidy_max_limit ? `最大${Math.round(s.subsidy_max_limit / 10000)}万円` : '上限額不明';
    const deadline = s.acceptance_end_datetime ? `（締切: ${s.acceptance_end_datetime.slice(0, 10)}）` : '';
    return `- ${s.title} | ${max} | 補助率: ${s.subsidy_rate || '-'} | 対象: ${s.target_number_of_employees || '-'} | 地域: ${s.target_area_search || '-'} ${deadline}`;
  }).join('\n');
  return `\n\n【現在公募中の補助金（Jグランツ最新データ）】\n${lines}\n\n上記は公式の最新データです。シミュレーション結果には、ユーザーの状況に該当する制度をこの中から優先的に選んで提案してください。`;
}

async function callClaude(messages, extraSystemContext = '') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: SYSTEM_PROMPT + extraSystemContext,
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
  // 完全な SIMULATION ブロックを除去
  let cleaned = text.replace(/---SIMULATION_START---[\s\S]*?---SIMULATION_END---/g, '').trim();
  // SIMULATION_START があって END がない（途中で切れた）場合も以降を全て除去
  cleaned = cleaned.replace(/---SIMULATION_START---[\s\S]*$/, '').trim();
  // 単独の JSON っぽい塊（{ "results": ... ）も除去
  cleaned = cleaned.replace(/\{[\s\S]*?"results"[\s\S]*$/, '').trim();
  // ダブルクォート（半角）と" "（全角）を全て除去
  cleaned = cleaned.replace(/["""]/g, '');
  return cleaned.trim();
}

const FEE_INITIAL = 10; // 着手金（万円）
const FEE_RATE = 0.15; // 成果報酬率

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
        { type: 'text', text: r.name, color: '#60a5fa', size: 'sm', weight: 'bold', wrap: true },
        { type: 'text', text: `最大 ${est}万円`, color: '#34d399', size: 'xl', weight: 'bold' },
        { type: 'text', text: `補助率: ${r.rate || '-'}`, color: '#94a3b8', size: 'xs' },
        ...(r.reason ? [{ type: 'text', text: r.reason, color: '#94a3b8', size: 'xxs', wrap: true }] : []),
      ],
    });
  });

  // 合計と手数料計算
  const total = parseInt(sim.totalEstimated) || 0;
  const successFee = Math.round(total * FEE_RATE);
  const totalFee = FEE_INITIAL + successFee;
  const netAmount = total - totalFee;

  if (total > 0) {
    // 合計受給額
    contents.push({
      type: 'box', layout: 'vertical', paddingAll: '12px', margin: 'lg',
      backgroundColor: '#1e3a8a', cornerRadius: '8px',
      contents: [
        { type: 'text', text: '合計 最大受給額', color: '#93c5fd', size: 'xs' },
        { type: 'text', text: `最大 ${total}万円`, color: '#bfdbfe', size: 'xxl', weight: 'bold' },
      ],
    });

    // 弊社手数料
    contents.push({
      type: 'box', layout: 'vertical', paddingAll: '12px', margin: 'sm',
      backgroundColor: '#1e293b', cornerRadius: '8px',
      contents: [
        { type: 'text', text: '弊社手数料', color: '#94a3b8', size: 'xs', weight: 'bold' },
        { type: 'box', layout: 'horizontal', margin: 'sm', contents: [
          { type: 'text', text: '着手金', color: '#94a3b8', size: 'xs', flex: 3 },
          { type: 'text', text: `${FEE_INITIAL}万円`, color: '#e2e8f0', size: 'xs', flex: 2, align: 'end' },
        ]},
        { type: 'box', layout: 'horizontal', margin: 'xs', contents: [
          { type: 'text', text: `成果報酬（${Math.round(FEE_RATE * 100)}%）`, color: '#94a3b8', size: 'xs', flex: 3 },
          { type: 'text', text: `${successFee}万円`, color: '#e2e8f0', size: 'xs', flex: 2, align: 'end' },
        ]},
        { type: 'box', layout: 'horizontal', margin: 'sm', paddingTop: 'sm', contents: [
          { type: 'text', text: '手数料合計', color: '#cbd5e1', size: 'sm', weight: 'bold', flex: 3 },
          { type: 'text', text: `${totalFee}万円`, color: '#cbd5e1', size: 'sm', weight: 'bold', flex: 2, align: 'end' },
        ]},
      ],
    });

    // お手元に残る金額
    contents.push({
      type: 'box', layout: 'vertical', paddingAll: '14px', margin: 'sm',
      backgroundColor: '#065f46', cornerRadius: '10px',
      contents: [
        { type: 'text', text: 'お手元に残る金額', color: '#6ee7b7', size: 'xs', weight: 'bold' },
        { type: 'text', text: `最大 ${netAmount}万円`, color: '#34d399', size: 'xxl', weight: 'bold' },
      ],
    });
  }

  return {
    type: 'flex', altText: `診断結果: 手残り最大${netAmount || '?'}万円`,
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

async function extractStructuredInfo(messages) {
  try {
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'ユーザー' : 'ボット'}: ${m.content.replace(/---SIMULATION_START---[\s\S]*?---SIMULATION_END---/g, '[シミュレーション結果]')}`)
      .join('\n');

    const extractPrompt = `以下の会話から事業者情報を抽出してJSON形式のみで返してください。説明文や\`\`\`は一切付けないこと。
不明な項目はnullにしてください。

抽出フィールド：
- company_name: 会社名または屋号名
- representative: 代表者名
- business_type: 業種（製造業/サービス業/小売業など）
- entity_type: 法人 or 個人事業主
- established: 設立日（例: 2020年4月）
- location: 所在地（都道府県・市区町村）
- employees_full: 正社員数（数字のみ）
- employees_part: アルバイト・パート数（数字のみ）
- invoice_registered: インボイス登録（登録済み/未登録/不明）
- subsidy_experience: 補助金申請経験（あり/なし、ありの場合は補助金名）
- business_content: 事業内容（具体的に）
- desired_use: やりたいこと（補助金で何をしたいか）

会話：
${conversationText}

JSON:`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: '会話から事業者情報を抽出するアシスタント。必ず指定されたJSONのみを返し、前後に説明や```などを一切含めない。',
        messages: [{ role: 'user', content: extractPrompt }],
      }),
    });
    const data = await res.json();
    const text = data.content ? data.content.map(c => c.text || '').join('') : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return {};
  }
}

async function saveToLog(userId, displayName, sim, messages) {
  const extracted = await extractStructuredInfo(messages);

  const logData = {
    line_user_id: userId,
    line_display_name: displayName,
    simulation_results: sim,
    full_conversation: messages,
    company_name: extracted.company_name ?? null,
    representative: extracted.representative ?? null,
    business_type: extracted.business_type ?? null,
    entity_type: extracted.entity_type ?? null,
    established: extracted.established ?? null,
    location: extracted.location ?? null,
    employees_full: extracted.employees_full != null ? String(extracted.employees_full) : null,
    employees_part: extracted.employees_part != null ? String(extracted.employees_part) : null,
    invoice_registered: extracted.invoice_registered ?? null,
    subsidy_experience: extracted.subsidy_experience ?? null,
    business_content: extracted.business_content ?? null,
    desired_use: extracted.desired_use ?? null,
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
      body: JSON.stringify({
        ...logData,
        simulationResults: sim,
        fullConversation: messages,
        companyName: extracted.company_name,
        businessContent: extracted.business_content,
        desiredUse: extracted.desired_use,
        employeesFull: extracted.employees_full,
        employeesPart: extracted.employees_part,
      }),
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

    // ユーザーの会話から都道府県を簡易抽出
    const allUserText = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
    const prefMatch = allUserText.match(/(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都?|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/);
    const prefecture = prefMatch ? prefMatch[1] : null;

    // 関連する補助金データを取得
    const relevantSubsidies = await getRelevantSubsidies(prefecture);
    const subsidyContext = buildSubsidyContext(relevantSubsidies);

    const claudeResponse = await callClaude(messages, subsidyContext);

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
