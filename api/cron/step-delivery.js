const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// 友だち追加後のステップ配信（診断未完了向け）
// Day 1-3 は1日3通、Day 4-7 は1日1通
const FOLLOW_STEPS = [
  // ===== Day 1 =====
  {
    delayHours: 24, // 翌日朝
    text: 'おはようございます！\n昨日は友だち追加ありがとうございました。\n\n補助金・助成金の無料診断はもうお試しいただけましたか？\n3分の簡単な質問に答えるだけで、御社が受け取れる可能性のある制度がわかります。\n\n「診断」とメッセージくださいね！',
  },
  {
    delayHours: 28, // 翌日昼
    text: '【豆知識】\n補助金と助成金の違いをご存知ですか？\n\n・補助金: 経産省系。審査あり。100万〜数千万円\n・助成金: 厚労省系。要件を満たせばほぼ受給可能。30万〜100万円\n\n実は助成金は「雇用しているだけ」で対象になるものが多いんです。\n3分診断で確認できますよ！',
  },
  {
    delayHours: 32, // 翌日夕方
    text: 'お疲れ様です！\n\n本日中に診断のお時間取れそうでしょうか？\n3分で終わるので、移動中やランチ後の少しの時間でも大丈夫です。\n\n「診断」と送ってお試しください！',
  },

  // ===== Day 2 =====
  {
    delayHours: 48,
    text: 'おはようございます！\n\n【先週の診断事例】\n・飲食店（従業員5名）→ 約180万円該当\n・美容室（従業員3名）→ 約120万円該当\n・建設業（従業員10名）→ 約450万円該当\n\nあなたの事業はいかがでしょうか？\n「診断」と送れば3分で結果が出ます！',
  },
  {
    delayHours: 52,
    text: 'お昼休みお疲れ様です！\n\n「補助金は業績が良い会社しか貰えない」と思っていませんか？\n\n実はそれは誤解で、赤字でも対象になる制度がたくさんあります。\nむしろ「これから設備投資したい」「人を雇いたい」という前向きな会社を国は応援しています。\n\nぜひ「診断」してみてください！',
  },
  {
    delayHours: 56,
    text: '本日もお疲れ様でした。\n\nもし診断のお時間が取れていなければ、明日の朝のスキマ時間にでもぜひ。\n3分で終わります。\n\n「診断」とメッセージいただければスタートできます！',
  },

  // ===== Day 3 =====
  {
    delayHours: 72,
    text: 'おはようございます！\n\n突然ですが、こんな悩みありませんか？\n・補助金は手続きが面倒そう\n・自分で書類作成するのは無理\n・どの補助金が良いかわからない\n\n弊社は事業計画書から申請まで全て代行するので、お客様の手間はほぼゼロです。\nまずは3分の無料診断から！',
  },
  {
    delayHours: 76,
    text: '【知らないと損する話】\n\n補助金・助成金は「申請しないと貰えない」制度です。\n受給する権利があるのに、95%の事業者は知らずに使っていません。\n\n3分で「あなたの権利」を確認できます。\n「診断」と送るだけです！',
  },
  {
    delayHours: 80,
    text: 'お疲れ様です！\n\n実は補助金には申請期限があります。\n直近の公募締切は今月末のものもあり、準備期間を考えると今から動く必要があります。\n\nまずは3分診断で、あなたが該当するかを確認しませんか？\n「診断」と送ってください！',
  },

  // ===== Day 4-7 =====
  {
    delayHours: 96, // Day 4
    text: 'おはようございます！\n\n4日前に友だち追加いただきありがとうございました。\n\nもしまだ診断されていなければ、ぜひお試しください。\nやりたいことが未定でも、雇用状況だけで判定できる助成金もあります。\n\n「診断」と送るだけでOKです！',
  },
  {
    delayHours: 120, // Day 5
    text: '【お客様の声】\n\n「想定の倍以上の補助金が見つかりました」\n「自分では絶対に見つけられなかった」\n「申請も全部やってもらえて楽でした」\n\nあなたも同じように、想定外の制度に該当するかもしれません。\n3分診断でご確認ください！',
  },
  {
    delayHours: 144, // Day 6
    text: '残念なお知らせです。\n\nもし今、補助金の活用を検討されていないなら、それは大きな機会損失かもしれません。\n\n年間1兆円以上の補助金・助成金が予算化されていますが、その多くが使われずに国に戻っています。\n\n権利があるなら使いましょう。「診断」と送るだけです！',
  },
  {
    delayHours: 168, // Day 7
    text: 'お忙しいところすみません。\n\n友だち追加から1週間が経ちました。\nこれが最後のお声がけです。\n\n3分だけお時間いただければ、御社が受け取れる補助金・助成金がわかります。\n「診断」と送ってみてくださいね。\n\n御社のさらなる発展を応援しています！',
  },
];

// 診断完了後のZoom誘導ステップ配信
// Day 1-3 は1日3通、Day 4-7 は1日1通、その後は2週/1ヶ月クールダウン
const COMPLETED_STEPS = [
  // ===== Day 1 =====
  {
    delayHours: 24,
    text: '昨日は補助金診断ありがとうございました！\n\n診断結果はご確認いただけましたか？\n気になる補助金や、もっと詳しく聞きたいことはありませんか？\n\nLINEで気軽に質問いただいても大丈夫ですし、30分の無料Zoom面談でじっくりお話しすることもできます！',
  },
  {
    delayHours: 28,
    text: '【Zoom面談で具体的にお伝えできること】\n\n✓ 最適な申請順序（同時申請できる制度の組合せ）\n✓ 採択率を上げるコツ\n✓ 実際の受給スケジュール\n✓ 弊社の代行範囲と費用\n✓ あなたの業種の最新事例\n\n「Zoom希望」とメッセージくださいね！',
  },
  {
    delayHours: 32,
    text: 'お疲れ様です！\n\nもし診断結果について「もう少し詳しく聞きたいな」と思われたら、お気軽にメッセージください。\n\nLINEでの質問もOKですし、Zoomでじっくり話すこともできます。\nどちらも完全無料です！',
  },

  // ===== Day 2 =====
  {
    delayHours: 48,
    text: 'おはようございます！\n\n補助金診断から2日目ですね。\n\nもし何かご検討中でしたら、ぜひLINEでお気軽にお声がけください。\n「○○補助金について詳しく」「申請までの流れは？」など、どんな質問でも大丈夫です！',
  },
  {
    delayHours: 52,
    text: '【お客様の声】\n\n「Zoomで話したら、診断結果以上の補助金が見つかりました」（製造業 50代男性）\n「30分でこんなにわかるとは思わなかった」（飲食店 40代女性）\n「押し売り感ゼロで安心できました」（IT業 30代男性）\n\nあなたもぜひZoomでご相談ください！',
  },
  {
    delayHours: 56,
    text: '本日もお疲れ様でした。\n\nZoom面談は完全無料・30分・押し売りなしです。\nお気軽に「Zoom希望」とメッセージください。\n\n候補日時をいくつかご提示しますね！',
  },

  // ===== Day 3 =====
  {
    delayHours: 72,
    text: 'おはようございます！\n\nもしかしたら「Zoomは少しハードル高い…」と感じていらっしゃいますか？\nそれでしたら、まずはLINEでの質問だけでも大丈夫です！\n\n・どの補助金が一番おすすめ？\n・申請にかかる期間は？\n・費用はどのくらい？\n\nなんでも聞いてくださいね！',
  },
  {
    delayHours: 76,
    text: '【弊社の強み】\n\n✓ 事業計画書の作成は全て代行\n✓ 申請書類の作成も全て代行\n✓ 採択後のフォローも代行\n✓ 不採択時の再申請サポート\n✓ お客様の手間はほぼゼロ\n\nまずは無料Zoomで詳細をお伝えできます！',
  },
  {
    delayHours: 80,
    text: 'お疲れ様です！\n\n実は補助金には申請期限があり、直近の公募締切は今月末のものもあります。\n\n採択されるには事業計画書の作成に2〜3週間かかるため、今から動かないと間に合わない可能性も…\n\nまずは無料Zoomで状況をお聞かせください！',
  },

  // ===== Day 4-7 =====
  {
    delayHours: 96, // Day 4
    text: 'こんにちは！\n\n診断から4日経ちましたね。\nもし気になることがあれば、いつでもLINEでお声がけください。\n\nZoom面談のご予約は「Zoom希望」とメッセージいただければ、候補日時をお送りします！',
  },
  {
    delayHours: 120, // Day 5
    text: '【あるあるな悩み】\n\n「補助金は欲しいけど、自分で書類作るのは無理」\n「商工会議所に相談する時間がない」\n「失敗したくないから専門家に頼みたい」\n\nまさに弊社のサービスはこういう方のためのものです。\nぜひ無料Zoomでご相談ください！',
  },
  {
    delayHours: 144, // Day 6
    text: '残念なお話ですが…\n\n年間1兆円以上の補助金・助成金が、申請されないまま予算が余って国に戻っています。\n\nあなたが該当する制度を知らずに使わないのは、本当にもったいないです。\n\nまずは30分のZoomで、最適な活用法を一緒に考えませんか？',
  },
  {
    delayHours: 168, // Day 7
    text: 'お忙しいところ失礼します。\n\n診断から1週間が経ちました。\n\nもしご検討中でしたら、ぜひ無料Zoomでお話しさせてください。\nお客様の事業に最適な補助金戦略をご提案します。\n\n「Zoom希望」とメッセージください！',
  },

  // ===== クールダウン =====
  {
    delayHours: 336, // Day 14
    text: 'ご無沙汰しております。\n\n2週間前の診断結果、その後ご検討いただけましたでしょうか？\n\n「他社と比較したい」「もう少し情報が欲しい」「条件次第で進めたい」など、どんな段階のご相談でも大丈夫です。\n\nお気軽にメッセージくださいね！',
  },
  {
    delayHours: 720, // Day 30
    text: 'お久しぶりです！\n\nちょうど次回の公募締切に向けた準備のベストタイミングです。\n今からなら余裕を持って準備できます。\n\n「ちょっと話だけ聞いてみたい」でも全然OKですので、ぜひ無料Zoomでお話ししませんか？',
  },
];

async function hasBookedZoom(userId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/conversation_logs?line_user_id=eq.${userId}&status=in.("Zoom予約済","Zoom実施済","契約","検討中","失注")&select=id&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

function buildQuickReplyForFollow() {
  return {
    items: [
      { type: 'action', action: { type: 'message', label: '簡易診断（3分）', text: '簡易診断を始めたい' } },
      { type: 'action', action: { type: 'message', label: '詳細診断（5分）', text: '詳細診断を始めたい' } },
      { type: 'action', action: { type: 'message', label: '質問する', text: '補助金について質問したい' } },
    ],
  };
}

function buildQuickReplyForCompleted() {
  return {
    items: [
      { type: 'action', action: { type: 'message', label: 'Zoom面談を予約する', text: 'Zoom面談を予約したい' } },
      { type: 'action', action: { type: 'message', label: '別の補助金も知りたい', text: '別の補助金も知りたい' } },
      { type: 'action', action: { type: 'message', label: '質問する', text: '質問があります' } },
    ],
  };
}

async function pushMessage(userId, text, quickReply = null) {
  const message = { type: 'text', text };
  if (quickReply) message.quickReply = quickReply;
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [message],
    }),
  });
}

async function updateStepIndex(userId, newIndex) {
  await fetch(`${SUPABASE_URL}/rest/v1/line_conversations?line_user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      step_index: newIndex,
      last_step_sent_at: new Date().toISOString(),
    }),
  });
}

async function processScheduledMessages() {
  const nowIso = new Date().toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/scheduled_messages?sent_at=is.null&scheduled_at=lte.${nowIso}&select=*`,
    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const due = await res.json();
  if (!Array.isArray(due)) return 0;

  let sent = 0;
  for (const msg of due) {
    // 診断完了済みなら未送信のDay0は破棄
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/line_conversations?line_user_id=eq.${msg.line_user_id}&select=diagnosis_completed_at&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const userData = await userRes.json();
    const completed = userData[0]?.diagnosis_completed_at;

    // 完了済みなら送信せずsent_atだけ埋めてスキップ
    if (completed) {
      await fetch(`${SUPABASE_URL}/rest/v1/scheduled_messages?id=eq.${msg.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ sent_at: nowIso }),
      });
      continue;
    }

    try {
      await pushMessage(msg.line_user_id, msg.message_text, buildQuickReplyForFollow());
      await fetch(`${SUPABASE_URL}/rest/v1/scheduled_messages?id=eq.${msg.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ sent_at: nowIso }),
      });
      sent++;
    } catch (e) {}
  }
  return sent;
}

export default async function handler(req, res) {
  // Cron認証
  if (CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const now = Date.now();
  let sent = 0;

  try {
    // Day0等のスケジュール済みメッセージを先に処理
    sent += await processScheduledMessages();

    // 全ユーザー取得
    const usersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/line_conversations?select=*`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const users = await usersRes.json();

    for (const user of users) {
      const stepIdx = user.step_index || 0;
      let steps, anchorTime;

      if (user.diagnosis_completed_at) {
        // 診断完了済みユーザー: Zoom予約以降のステータスなら配信停止
        const booked = await hasBookedZoom(user.line_user_id);
        if (booked) continue;

        steps = COMPLETED_STEPS;
        anchorTime = new Date(user.diagnosis_completed_at).getTime();
      } else if (user.followed_at) {
        // 友だち追加のみ・診断未完了のユーザー
        steps = FOLLOW_STEPS;
        anchorTime = new Date(user.followed_at).getTime();
      } else {
        continue;
      }

      // 次のステップが存在するかチェック
      if (stepIdx >= steps.length) continue;

      const nextStep = steps[stepIdx];
      const elapsed = (now - anchorTime) / (1000 * 60 * 60); // hours

      if (elapsed >= nextStep.delayHours) {
        try {
          const quickReply = user.diagnosis_completed_at
            ? buildQuickReplyForCompleted()
            : buildQuickReplyForFollow();
          await pushMessage(user.line_user_id, nextStep.text, quickReply);
          await updateStepIndex(user.line_user_id, stepIdx + 1);
          sent++;
        } catch (e) {
          console.error('Push failed:', e);
        }
      }
    }

    return res.status(200).json({ status: 'ok', sent, total: users.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
