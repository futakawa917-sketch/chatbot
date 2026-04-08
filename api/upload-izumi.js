const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

function makeId(item) {
  // タイトル + URL から安定したID生成
  const base = (item.title || '') + '|' + (item.detail_url || '');
  // シンプルなハッシュ
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash |= 0;
  }
  return `izumi_${Math.abs(hash)}`;
}

async function upsertToSupabase(records) {
  if (records.length === 0) return 0;
  const batchSize = 100;
  let saved = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/izumi_subsidies?on_conflict=id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (res.ok) saved += batch.length;
  }
  return saved;
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items array required' });
    }

    const records = items
      .filter(item => item.title)
      .map(item => ({
        id: makeId(item),
        title: item.title,
        category: item.source_type || null,
        max_amount: item.max_amount || null,
        application_period: item.application_period || null,
        target_area: item.target_area || null,
        source_type: item.source_type || null,
        difficulty: item.difficulty || null,
        publish_date: item.publish_date || null,
        detail_url: item.detail_url || null,
        raw_data: item,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

    const saved = await upsertToSupabase(records);
    return res.status(200).json({ status: 'ok', received: items.length, saved });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
