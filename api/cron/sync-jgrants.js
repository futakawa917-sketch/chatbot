const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const JGRANTS_API = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';

const KEYWORDS = [
  '小規模事業者', 'IT導入', 'ものづくり', '事業再構築', '事業承継',
  '省エネ', '創業', '雇用', '人材', '研究開発', 'DX',
  '販路開拓', '新事業', '海外展開', '医療', '介護', '農業',
  '観光', '飲食', '製造', '商業', '建設',
];

const USE_PURPOSES = [
  '新たな事業を行いたい',
  '販路拡大・海外展開をしたい',
  '設備整備・IT導入をしたい',
  '従業員の育成・確保をしたい',
  '新製品・新技術を開発したい',
  '地域活性化に貢献したい',
  '事業を引き継ぎたい',
  '創業したい',
];

async function fetchJgrants(params) {
  const url = new URL(JGRANTS_API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  return data.result || [];
}

async function fetchDetail(id) {
  try {
    const res = await fetch(`${JGRANTS_API}/id/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.result?.[0] || null;
  } catch {
    return null;
  }
}

async function upsertToSupabase(records) {
  if (records.length === 0) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/jgrants_subsidies?on_conflict=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(records),
  });
  return res.ok ? records.length : 0;
}

export default async function handler(req, res) {
  if (CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  let totalFetched = 0;
  let totalSaved = 0;
  const seenIds = new Set();

  try {
    // 複数の use_purpose で検索して幅広く取得
    for (const purpose of USE_PURPOSES) {
      for (const sort of ['acceptance_end_datetime']) {
        const list = await fetchJgrants({
          keyword: '補助金',
          sort,
          order: 'ASC',
          acceptance: 1,
          use_purpose: purpose,
        });

        for (const item of list) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);
          totalFetched++;
        }
      }
    }

    // キーワードベースの検索で補完
    for (const kw of KEYWORDS) {
      const list = await fetchJgrants({
        keyword: kw,
        sort: 'acceptance_end_datetime',
        order: 'ASC',
        acceptance: 1,
      });
      for (const item of list) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        totalFetched++;
      }
    }

    // 詳細を取得して保存
    const ids = Array.from(seenIds);
    const batchSize = 20;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const details = await Promise.all(batch.map(id => fetchDetail(id)));
      const records = details
        .filter(d => d)
        .map(d => ({
          id: d.id,
          name: d.name || null,
          title: d.title || null,
          detail: typeof d.detail === 'string' ? d.detail.replace(/<[^>]+>/g, '').slice(0, 5000) : null,
          target_area_search: d.target_area_search || null,
          target_area_detail: d.target_area_detail || null,
          industry: d.industry || null,
          use_purpose: d.use_purpose || null,
          target_number_of_employees: d.target_number_of_employees || null,
          subsidy_max_limit: d.subsidy_max_limit || null,
          subsidy_rate: d.subsidy_rate || null,
          acceptance_start_datetime: d.acceptance_start_datetime || null,
          acceptance_end_datetime: d.acceptance_end_datetime || null,
          institution_name: d.institution_name || null,
          front_subsidy_detail_page_url: d.front_subsidy_detail_page_url || null,
          raw_data: d,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
      totalSaved += await upsertToSupabase(records);
    }

    return res.status(200).json({ status: 'ok', fetched: totalFetched, saved: totalSaved });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
