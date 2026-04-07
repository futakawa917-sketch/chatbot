const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// 友だち追加後のステップ配信（診断未完了向け）
const FOLLOW_STEPS = [
  {
    delayHours: 24,
    text: 'こんにちは！\n昨日は友だち追加ありがとうございました。\n\n補助金・助成金の無料診断はもうお試しいただけましたか？\n3分ほどの簡単な質問に答えるだけで、御社が受け取れる可能性のある制度がわかります。\n\n「診断」とメッセージをいただければスタートできます！',
  },
  {
    delayHours: 72,
    text: 'お忙しいところ失礼します。\n\nご存知でしたか？\n実は補助金は「やりたいこと」が決まっていなくても、雇用状況だけで該当する助成金（最大80万円〜）があったりします。\n\nご興味あれば「診断」とメッセージくださいね！',
  },
  {
    delayHours: 168, // 7日後
    text: 'いつもありがとうございます。\n\n弊社では事業計画書から申請書まで全て代行するサービスを提供しています。\n申請の手間がかからず、補助金を受給できます。\n\nまずは無料診断からいかがですか？\n「診断」と送るだけでスタートできます。',
  },
];

// 診断完了後のZoom誘導ステップ配信
const COMPLETED_STEPS = [
  {
    delayHours: 24,
    text: '昨日は補助金診断ありがとうございました！\n\n診断結果はご確認いただけましたか？\n\n実は診断結果はあくまで簡易版で、実際にはもっと該当する制度が見つかったり、最適な申請順序のご提案ができたりします。\n\n30分の無料Zoom面談で、あなたの事業に最適な補助金戦略を一緒に考えませんか？\n\n「Zoom希望」とメッセージいただければ予約方法をご案内します！',
  },
  {
    delayHours: 72,
    text: 'こんにちは！\n先日の診断結果について、ご検討いただけていますでしょうか？\n\n補助金には申請期限があり、特に人気の制度は早めに動かないと締切に間に合わないことも…\n\n弊社では：\n✓ 事業計画書の作成代行\n✓ 申請書類の作成代行\n✓ 採択後のフォロー\n\nまで全てサポートしているので、お客様の手間はほぼゼロです。\n\nまずは無料Zoomで詳しく聞いてみませんか？',
  },
  {
    delayHours: 168, // 7日後
    text: 'お久しぶりです！\n\n先日ご診断いただいた補助金の件、その後いかがでしょうか？\n\n「他社と比較したい」「もう少し詳しく知りたい」「自分でも申請できるか相談したい」など、どんなご相談でも大丈夫です。\n\nZoom面談は完全無料・30分・押し売りなしですので、お気軽にどうぞ！\n\n「Zoom希望」とメッセージくださいね。',
  },
  {
    delayHours: 336, // 14日後
    text: 'ご無沙汰しております。\n\n先月の補助金診断、覚えていらっしゃいますか？\n\n実は、ちょうど今が次回の公募締切に向けた準備のベストタイミングです。今からなら余裕を持って準備できます。\n\n「ちょっと話だけ聞いてみたい」でも全然OKですので、ぜひ無料Zoomでお話ししませんか？',
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

async function pushMessage(userId, text) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text }],
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

export default async function handler(req, res) {
  // Cron認証（Vercel Cronから呼ばれる場合は自動で認証）
  if (CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const now = Date.now();
  let sent = 0;

  try {
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
          await pushMessage(user.line_user_id, nextStep.text);
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
