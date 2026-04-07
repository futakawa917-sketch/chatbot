const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// シンプルなCSVパーサー（カンマ区切り、ダブルクォート対応）
function parseCSV(text) {
  const lines = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        current.push(field);
        if (current.some(c => c.length > 0)) lines.push(current);
        current = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    if (current.some(c => c.length > 0)) lines.push(current);
  }
  return lines;
}

function csvToRecords(csv) {
  const rows = parseCSV(csv);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());
  const records = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (row[idx] || '').trim(); });

    // 主要フィールドを抽出（ヘッダー名は推測）
    const findField = (...names) => {
      for (const n of names) {
        for (const h of headers) {
          if (h.includes(n)) return obj[h];
        }
      }
      return null;
    };

    const title = findField('支援名', '名称', 'タイトル', '補助金名');
    if (!title) continue;

    const id = findField('ID', '管理番号') || `izumi_${i}_${title.substring(0, 20)}`;

    records.push({
      id,
      title,
      category: findField('カテゴリ', '種別', '支援区分'),
      max_amount: findField('上限', '助成額', '補助額', '金額'),
      application_period: findField('受付', '応募期間', '締切'),
      target_area: findField('地域', '対象地域', '実施地域'),
      source_type: findField('実施機関', '主管', '所管', '出典'),
      difficulty: findField('難易度', '採択'),
      raw_data: obj,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return records;
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
    const { csv } = req.body || {};
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'CSV data missing' });
    }

    const records = csvToRecords(csv);
    const saved = await upsertToSupabase(records);

    return res.status(200).json({
      status: 'ok',
      parsed: records.length,
      saved,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
