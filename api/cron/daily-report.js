const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SALES_NOTIFY_USER_IDS = (process.env.SALES_NOTIFY_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const CRON_SECRET = process.env.CRON_SECRET;

async function pushToLine(userId, text) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
  });
}

async function fetchLogs() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/conversation_logs?select=*&order=created_at.desc&limit=500`,
    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  return res.ok ? await res.json() : [];
}

function buildReport(logs) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // 24時間以内の新規診断
  const newToday = logs.filter(l => now - new Date(l.created_at).getTime() < day);

  // ホットリード（Hot温度かつZoom未予約）
  const hotLeads = logs.filter(l =>
    l.lead_temperature === 'Hot' &&
    (!l.status || l.status === '診断完了')
  );

  // 要フォロー（診断完了から3日経過、かつZoom未予約）
  const needsFollowup = logs.filter(l => {
    const daysSince = (now - new Date(l.created_at).getTime()) / day;
    return daysSince >= 3 && daysSince <= 7 &&
      (!l.status || l.status === '診断完了');
  });

  // 検討中のフォロー
  const considering = logs.filter(l => l.status === '検討中');

  // 合計受給額（パイプライン総額）
  const totalPipeline = logs
    .filter(l => l.status !== '失注' && l.status !== '契約')
    .reduce((s, l) => s + (parseInt(l.simulation_results?.totalEstimated) || 0), 0);

  const lines = [
    '☀️ デイリー営業レポート',
    new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
    '',
    '━━━━━━━━━━━━━━━',
    '【サマリー】',
    `・昨日の新規診断: ${newToday.length}件`,
    `・🔥 ホットリード: ${hotLeads.length}件`,
    `・⏰ 要フォロー: ${needsFollowup.length}件`,
    `・💭 検討中: ${considering.length}件`,
    `・💰 パイプライン総額: ${totalPipeline.toLocaleString()}万円`,
    '',
  ];

  if (hotLeads.length > 0) {
    lines.push('━━━━━━━━━━━━━━━');
    lines.push('🔥 本日対応すべきホットリード');
    lines.push('');
    hotLeads.slice(0, 5).forEach((l, i) => {
      const amt = l.simulation_results?.totalEstimated || '?';
      lines.push(`${i + 1}. ${l.company_name || l.line_display_name || '名前不明'}`);
      lines.push(`   最大${amt}万円 / スコア${l.lead_score || '?'}`);
      if (l.phone) lines.push(`   📞 ${l.phone}`);
      lines.push('');
    });
  }

  if (needsFollowup.length > 0) {
    lines.push('━━━━━━━━━━━━━━━');
    lines.push('⏰ 3日以上フォロー無し');
    lines.push('');
    needsFollowup.slice(0, 5).forEach((l, i) => {
      const days = Math.floor((now - new Date(l.created_at).getTime()) / day);
      lines.push(`${i + 1}. ${l.company_name || '?'} (${days}日経過)`);
    });
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━');
  lines.push('▼ ダッシュボードで詳細');
  lines.push('https://chatbot-tau-five-39.vercel.app/dashboard.html');

  return lines.join('\n');
}

export default async function handler(req, res) {
  if (CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (SALES_NOTIFY_USER_IDS.length === 0) {
    return res.status(200).json({ status: 'skipped', reason: 'no notify targets' });
  }

  try {
    const logs = await fetchLogs();
    const report = buildReport(logs);

    await Promise.all(SALES_NOTIFY_USER_IDS.map(uid => pushToLine(uid, report)));

    return res.status(200).json({ status: 'ok', sent: SALES_NOTIFY_USER_IDS.length, logs: logs.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
