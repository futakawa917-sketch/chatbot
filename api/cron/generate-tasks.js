const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

async function sb(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'GET' && res.ok) return await res.json();
  return res.ok;
}

async function generateTasks() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // 全ログ取得
  const logs = await sb('GET', 'conversation_logs?select=id,company_name,line_display_name,status,lead_temperature,created_at,simulation_results,phone');
  if (!Array.isArray(logs)) return { generated: 0 };

  // 既存タスク取得（重複防止）
  const existingTasks = await sb('GET', 'sales_tasks?select=conversation_log_id,task_type&status=eq.open');
  const existingKeys = new Set(
    (Array.isArray(existingTasks) ? existingTasks : []).map(t => `${t.conversation_log_id}_${t.task_type}`)
  );

  const tasksToCreate = [];

  for (const log of logs) {
    const daysSince = (now - new Date(log.created_at).getTime()) / day;
    const totalAmt = parseInt(log.simulation_results?.totalEstimated) || 0;

    // 1. ホットリードへの即対応タスク
    if (log.lead_temperature === 'Hot' && (!log.status || log.status === '診断完了')) {
      const key = `${log.id}_hot_followup`;
      if (!existingKeys.has(key)) {
        tasksToCreate.push({
          conversation_log_id: log.id,
          task_type: 'hot_followup',
          title: `🔥 ${log.company_name || log.line_display_name || '?'}: 即連絡推奨`,
          description: `ホットリード（最大${totalAmt}万円）。電話 ${log.phone || '電話番号不明'}`,
          due_date: new Date(now).toISOString().split('T')[0],
          priority: 'high',
        });
      }
    }

    // 2. 3日経過フォロー
    if (daysSince >= 3 && daysSince < 4 && (!log.status || log.status === '診断完了')) {
      const key = `${log.id}_3day_followup`;
      if (!existingKeys.has(key)) {
        tasksToCreate.push({
          conversation_log_id: log.id,
          task_type: '3day_followup',
          title: `⏰ ${log.company_name || '?'}: 3日経過フォロー`,
          description: '診断完了から3日経過。再アプローチ推奨。',
          due_date: new Date(now).toISOString().split('T')[0],
          priority: 'medium',
        });
      }
    }

    // 3. Zoom予約済みリマインド
    if (log.status === 'Zoom予約済') {
      const key = `${log.id}_zoom_prep`;
      if (!existingKeys.has(key)) {
        tasksToCreate.push({
          conversation_log_id: log.id,
          task_type: 'zoom_prep',
          title: `📞 ${log.company_name || '?'}: Zoom準備`,
          description: '事前資料の準備とお客様情報の確認',
          due_date: new Date(now + day).toISOString().split('T')[0],
          priority: 'high',
        });
      }
    }

    // 4. 検討中の再アプローチ（7日後）
    if (log.status === '検討中' && daysSince >= 7 && daysSince < 8) {
      const key = `${log.id}_consideration_followup`;
      if (!existingKeys.has(key)) {
        tasksToCreate.push({
          conversation_log_id: log.id,
          task_type: 'consideration_followup',
          title: `💭 ${log.company_name || '?'}: 検討中フォロー`,
          description: '検討状況の確認とクロージング',
          due_date: new Date(now).toISOString().split('T')[0],
          priority: 'medium',
        });
      }
    }
  }

  if (tasksToCreate.length > 0) {
    await sb('POST', 'sales_tasks', tasksToCreate);
  }

  return { generated: tasksToCreate.length, totalLogs: logs.length };
}

export default async function handler(req, res) {
  if (CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const result = await generateTasks();
    return res.status(200).json({ status: 'ok', ...result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
