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

// 診断完了後のステップ配信（Zoom予約向け）
const COMPLETED_STEPS = [
  {
    delayHours: 1,
    text: '先ほどは診断ありがとうございました！\n\n診断結果はご確認いただけましたか？\nご不明な点や、もっと詳しく知りたい補助金があれば、お気軽にメッセージください。\n\n30分の無料Zoom面談では、申請の流れや採択率を上げるコツも具体的にお伝えできます！',
  },
  {
    delayHours: 24,
    text: 'こんにちは！\n昨日の診断結果はいかがでしたか？\n\n補助金には申請期限があり、直近の締切に間に合わせるには早めの準備が大切です。\n\n「Zoomで詳しく聞きたい」「○○補助金について教えて」など、お気軽にメッセージくださいね！',
  },
  {
    delayHours: 72,
    text: '先日は診断ありがとうございました。\n\n改めてお伝えすると、弊社では：\n・事業計画書の作成代行\n・申請書類の作成代行\n・採択後のフォロー\n\nまで全てサポートしています。お客様の手間はほとんどかかりません。\n\nまずは無料Zoomでお話しませんか？',
  },
  {
    delayHours: 168, // 7日後
    text: 'お久しぶりです。\n\n以前ご診断いただいた件、その後いかがでしょうか？\nもしご不明な点や追加でご相談したいことがあれば、いつでもメッセージくださいね。\n\n申請を検討される場合は、Zoom面談で具体的なスケジュールをご案内できます！',
  },
];

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
        // 診断完了済みユーザー
        steps = COMPLETED_STEPS;
        anchorTime = new Date(user.diagnosis_completed_at).getTime();
      } else if (user.followed_at) {
        // 友だち追加のみのユーザー
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
