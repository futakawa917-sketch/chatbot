const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SALES_NOTIFY_USER_IDS = (process.env.SALES_NOTIFY_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

async function pushFlex(userId, altText, contents) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'flex', altText, contents }],
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { log_id } = req.body || {};
    if (!log_id) return res.status(400).json({ error: 'log_id required' });

    // ログ取得
    const logRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversation_logs?id=eq.${log_id}&select=*`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const logs = await logRes.json();
    const log = logs[0];
    if (!log) return res.status(404).json({ error: 'Log not found' });

    const total = log.simulation_results?.totalEstimated || '?';

    const flex = {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#5b21b6', paddingAll: '16px',
        contents: [
          { type: 'text', text: '📞 Zoom面談 結果報告', color: '#fff', size: 'sm', weight: 'bold' },
          { type: 'text', text: log.company_name || log.line_display_name || '名前不明', color: '#fff', size: 'lg', weight: 'bold', wrap: true, margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
        contents: [
          { type: 'text', text: `想定受給額: 最大${total}万円`, size: 'sm', color: '#475569' },
          { type: 'text', text: log.phone ? `電話: ${log.phone}` : '', size: 'sm', color: '#475569' },
          { type: 'text', text: log.email ? `メール: ${log.email}` : '', size: 'sm', color: '#475569' },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '結果を選択してください', size: 'xs', color: '#94a3b8', margin: 'md' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary', color: '#10b981',
            action: { type: 'postback', label: '✅ 契約', data: `action=update_status&log_id=${log_id}&status=契約`, displayText: '契約として記録' },
          },
          {
            type: 'button',
            style: 'primary', color: '#f59e0b',
            action: { type: 'postback', label: '💭 検討中', data: `action=update_status&log_id=${log_id}&status=検討中`, displayText: '検討中として記録' },
          },
          {
            type: 'button',
            style: 'primary', color: '#94a3b8',
            action: { type: 'postback', label: '❌ 失注', data: `action=update_status&log_id=${log_id}&status=失注`, displayText: '失注として記録' },
          },
        ],
      },
    };

    await Promise.all(
      SALES_NOTIFY_USER_IDS.map(uid => pushFlex(uid, `Zoom面談結果報告: ${log.company_name || '?'}`, flex))
    );

    return res.status(200).json({ status: 'ok', sent: SALES_NOTIFY_USER_IDS.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
