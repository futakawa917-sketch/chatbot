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
    text: 'おはようございます、補助金HACKです。\n\n昨日のご登録ありがとうございました！\n\n突然ですが、御社では昨年いくらの補助金・助成金を受給されましたか？\n\n…もし「ゼロ」または「少なめ」だとすると、本来もらえるはずだった金額を逃している可能性があります。\n\n3分の無料診断で、今すぐ確認できます。下のボタンからどうぞ！',
  },
  {
    delayHours: 28, // 翌日昼
    text: '【補助金と助成金の違い、ご存知ですか？】\n\n■ 補助金（経産省系）\n100万〜数千万円。審査あり。\n\n■ 助成金（厚労省系）\n30万〜100万円。要件を満たせばほぼ確実にもらえる。\n\n特に助成金は「従業員を雇っているだけ」で対象になるものが多いんです。\n\n御社の状況で何が使えるか、3分で確認できます！',
  },
  {
    delayHours: 32, // 翌日夕方
    text: 'お疲れ様です。\n\n本日は診断のお時間、取れそうにないですか？\n\n大丈夫です。明日の朝、コーヒーを飲みながらの3分でOKです。\n\n質問は10個。会社名や従業員数など、すぐ答えられる内容ばかりです。下のボタンから始められます！',
  },

  // ===== Day 2 =====
  {
    delayHours: 48,
    text: '【先週の診断事例】\n\n・飲食店（従業員5名）\n→ 該当制度: 4件、最大180万円\n\n・美容室（従業員3名）\n→ 該当制度: 3件、最大120万円\n\n・建設業（従業員10名）\n→ 該当制度: 6件、最大450万円\n\nあなたの会社規模だと…どうでしょう？\n3分で答えが出ます。下のボタンから！',
  },
  {
    delayHours: 52,
    text: '【誤解されがちな話】\n\n「うちは業績が悪いから補助金は無理」\n\n…これ、実は誤解なんです。\n\n国は「これから投資したい」「人を雇いたい」という会社を応援しています。むしろ、これから挑戦する会社の味方です。\n\n御社が該当するかどうか、3分でわかります！',
  },
  {
    delayHours: 56,
    text: '今日もお疲れ様でした。\n\n少し補助金の話をさせてください。\n\n年間1兆円規模の補助金・助成金が予算化されていますが、その多くが申請されずに国に返還されています。\n\nつまり、知っている人だけが受け取れる仕組みなんです。\n\n3分診断で、あなたも「知っている人」に。下のボタンからどうぞ！',
  },

  // ===== Day 3 =====
  {
    delayHours: 72,
    text: 'おはようございます！\n\nこんな悩みありませんか？\n\n☐ 補助金の手続きが面倒\n☐ 自分で書類を書くのは無理\n☐ どの制度が良いかわからない\n☐ 失敗して時間を無駄にしたくない\n\n全部、弊社で代行できます。\nお客様の手間はほぼゼロ。まずは無料診断から！',
  },
  {
    delayHours: 76,
    text: '【ちょっと厳しい話をさせてください】\n\n補助金・助成金は「申請しないと1円ももらえない」制度です。\n\n実は95%の事業者がこの権利を使わず、放置しています。\n\n3分の診断で、あなたの「権利」が見える化できます。\n\nやらない理由がないと思いますので、下のボタンからどうぞ！',
  },
  {
    delayHours: 80,
    text: '【締切のお知らせ】\n\n直近の補助金公募締切は今月末。\n採択されるには事業計画書の作成に2〜3週間かかります。\n\nつまり、今から動かないと間に合いません。\n\nまずは3分診断で、御社が間に合いそうな制度を確認しましょう。下のボタンから！',
  },

  // ===== Day 4-7 =====
  {
    delayHours: 96, // Day 4
    text: 'こんにちは。\n\n友だち追加から4日経ちましたね。\n\nもしお時間が取れずにいらっしゃるなら、ここだけお伝えします。\n\n「やりたいこと」が決まっていなくても、雇用情報だけで該当する助成金があります。\n\n本当に3分で済みます。下のボタンからどうぞ！',
  },
  {
    delayHours: 120, // Day 5
    text: '【先月Zoom面談されたお客様の声】\n\n「想定の倍以上の補助金が見つかりました」\n（製造業 50代）\n\n「自分では絶対に見つけられなかった」\n（飲食店 40代）\n\n「申請も全部やってもらえて楽でした」\n（美容室 30代）\n\nあなたの事業も、想像以上の制度が眠っているかもしれません。\nまずは3分診断から！',
  },
  {
    delayHours: 144, // Day 6
    text: '【とても残念なお話】\n\n年間1兆円以上の補助金・助成金が、申請されずに国に返還されています。\n\nこれは、知らない人がほとんどだから。\n\nあなたが該当する制度を「知らなかった」だけで使えないのは、本当にもったいないです。\n\n3分の診断で、あなたが取りこぼしているお金を可視化します。下のボタンから！',
  },
  {
    delayHours: 168, // Day 7
    text: '【最後のご案内です】\n\n友だち追加から1週間が経ちました。\nしつこくならないよう、これが最後のお声がけです。\n\n3分の診断で、御社が今すぐ活用できる補助金がわかります。\n\nもし忙しくてご対応難しければ、それはそれで構いません。\n御社のさらなる発展を心から応援しています！',
  },
];

// 診断完了後のZoom誘導ステップ配信
// Day 1-3 は1日3通、Day 4-7 は1日1通、その後は2週/1ヶ月クールダウン
const COMPLETED_STEPS = [
  // ===== Day 1 =====
  {
    delayHours: 24,
    text: '昨日は無料診断のご利用、誠にありがとうございました！\n\n診断結果はご覧いただけましたか？\n\n実は、診断結果はあくまで「あなたの状況だけ」で算出した最低ラインです。Zoom面談でもう少し詳しくお話を伺えれば、平均で1.5倍の制度が見つかっています。\n\n気になる点があれば、お気軽にメッセージくださいね！',
  },
  {
    delayHours: 28,
    text: '【Zoom面談で具体的にお伝えできること】\n\n✓ 最適な申請順序の設計\n✓ 同時申請できる制度の組合せ\n✓ 採択率を上げる事業計画書の書き方\n✓ 実際の受給スケジュール\n✓ 弊社の代行範囲と費用の詳細\n\n60分でこれだけお伝えします。完全無料です！\n「Zoom予約」とメッセージください。',
  },
  {
    delayHours: 32,
    text: 'お疲れ様です。\n\n診断結果をご覧いただいて、何か気になる制度はありましたか？\n\n「○○補助金についてもっと詳しく」「申請までの流れは？」など、LINEでお気軽にご質問ください。即お答えします。\n\nもちろん、Zoomでじっくり話すのもおすすめです！',
  },

  // ===== Day 2 =====
  {
    delayHours: 48,
    text: 'おはようございます！\n\n診断から2日目ですね。御社のシミュレーション結果、改めて確認していただけましたか？\n\nもし「自分にもチャンスがあるかも」と感じていただけたなら、次は無料Zoom面談で具体的なアクションプランを一緒に作りましょう。\n\n下のボタンからご予約いただけます！',
  },
  {
    delayHours: 52,
    text: '【先月Zoom面談された方の感想】\n\n「診断結果より100万円も多い制度が見つかった」（製造業 50代）\n\n「30分でこんなに具体的になるとは」（飲食店 40代）\n\n「押し売り感ゼロで安心できた」（IT業 30代）\n\nあなたも同じ体験をしてみませんか？',
  },
  {
    delayHours: 56,
    text: '本日もお疲れ様でした。\n\n念のためお伝えすると、Zoom面談は\n・完全無料\n・60分\n・押し売りなし\n\n「ちょっと話を聞きたい」レベルでもOKです。\n下のボタンからお気軽にどうぞ！',
  },

  // ===== Day 3 =====
  {
    delayHours: 72,
    text: 'おはようございます！\n\n「Zoomは少しハードル高いかも…」と感じられているかもしれません。\n\nそれなら、まずはLINEでの質問だけでも大丈夫です。\n\n・どの補助金が一番おすすめ？\n・申請までどのくらい時間がかかる？\n・費用はどのくらい？\n\nなんでも聞いてください！',
  },
  {
    delayHours: 76,
    text: '【弊社の強み、改めてお伝えします】\n\n✓ 事業計画書の作成 → 完全代行\n✓ 申請書類の作成 → 完全代行\n✓ 採択後のフォロー → 完全代行\n✓ 不採択時の再申請サポート → 込み\n\nお客様の手間は最小限。本業に集中していただけます。\n\nまずは無料Zoomで、御社専用のプランをご提案します！',
  },
  {
    delayHours: 80,
    text: '【締切のお知らせ】\n\n直近で締切が迫っている制度があります。\n\n採択には事業計画書の作成に2〜3週間。逆算すると、今すぐ動き出さないと間に合わないものも…\n\n御社が該当する制度の締切を、Zoomで個別にお伝えします。\n下のボタンからご予約ください！',
  },

  // ===== Day 4-7 =====
  {
    delayHours: 96, // Day 4
    text: 'こんにちは。\n\n診断から4日経ちましたね。\n\n「他社と比較したい」「家族や同僚と相談中」というお客様も多いです。じっくりご検討いただいて大丈夫です。\n\n何か追加で気になることがあれば、お気軽にメッセージくださいね！',
  },
  {
    delayHours: 120, // Day 5
    text: '【あるあるな悩み】\n\n「補助金は欲しいけど書類作りが無理」\n「相談する時間が取れない」\n「失敗したくないから専門家に頼みたい」\n\nこれらは全て、弊社のサービスで解決できます。\n\n60分の無料Zoomで、御社にぴったりのプランを設計します！',
  },
  {
    delayHours: 144, // Day 6
    text: '正直なお話をします。\n\n補助金は「申請すれば誰でももらえる」ものではありません。事業計画書の質、申請のタイミング、必要書類の揃え方で大きく差が出ます。\n\n弊社は採択率92%。プロの目で御社の状況を分析し、最適なルートをご提案します。\n\nまずはZoomで詳しくお話しさせてください！',
  },
  {
    delayHours: 168, // Day 7
    text: '【1週間経ちました】\n\nお時間を取れずにいらっしゃるかもしれません。お忙しい中、本当にすみません。\n\nもし「やっぱり気になる」と少しでも感じていただけたら、いつでもメッセージください。即対応します。\n\n御社のさらなる発展を心から応援しています！',
  },

  // ===== クールダウン =====
  {
    delayHours: 336, // Day 14
    text: 'ご無沙汰しております、補助金HACKです。\n\n2週間前の診断結果、その後いかがでしょうか？\n\n「他社と比較した結果、相談したい」「条件次第で進めたい」など、どんな段階でも構いません。\n\nお気軽にメッセージくださいね！',
  },
  {
    delayHours: 720, // Day 30
    text: 'お久しぶりです！補助金HACKです。\n\n実は今、次回の補助金公募締切に向けた準備のベストタイミングなんです。今からなら余裕を持って書類が作れます。\n\n「とりあえず話だけ聞きたい」でも大丈夫です。下のボタンからお気軽に！',
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
