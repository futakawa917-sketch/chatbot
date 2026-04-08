const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

async function sb(method, path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal',
    },
  });
  return res.ok;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 簡易認証（管理者パスワード）
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${DASHBOARD_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { line_user_id } = req.body || {};
    if (!line_user_id) {
      return res.status(400).json({ error: 'line_user_id required' });
    }

    // 関連する全テーブルから削除
    const results = {
      line_conversations: await sb('DELETE', `line_conversations?line_user_id=eq.${line_user_id}`),
      conversation_logs: await sb('DELETE', `conversation_logs?line_user_id=eq.${line_user_id}`),
      scheduled_messages: await sb('DELETE', `scheduled_messages?line_user_id=eq.${line_user_id}`),
    };

    return res.status(200).json({
      status: 'ok',
      deleted: results,
      line_user_id,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
