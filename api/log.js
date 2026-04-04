const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GOOGLE_SHEET_WEBHOOK = process.env.GOOGLE_SHEET_WEBHOOK;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const data = req.body;

  const results = { supabase: null, sheet: null };

  // Supabase
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/conversation_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          mode: data.mode || null,
          company_name: data.companyName || null,
          representative: data.representative || null,
          business_type: data.businessType || null,
          entity_type: data.entityType || null,
          established: data.established || null,
          location: data.location || null,
          employees_full: data.employeesFull || null,
          employees_part: data.employeesPart || null,
          invoice_registered: data.invoiceRegistered || null,
          subsidy_experience: data.subsidyExperience || null,
          business_content: data.businessContent || null,
          desired_use: data.desiredUse || null,
          simulation_results: data.simulationResults || null,
          full_conversation: data.fullConversation || null,
          zoom_booked: data.zoomBooked || false,
        }),
      });
      results.supabase = sbRes.ok ? 'ok' : 'error';
    } catch (e) {
      results.supabase = 'error';
    }
  }

  // Google Sheets
  if (GOOGLE_SHEET_WEBHOOK) {
    try {
      const sheetRes = await fetch(GOOGLE_SHEET_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      results.sheet = sheetRes.ok ? 'ok' : 'error';
    } catch (e) {
      results.sheet = 'error';
    }
  }

  return res.status(200).json(results);
}
