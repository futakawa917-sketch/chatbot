export default async function handler(req, res) {
  const check = (name) => {
    const v = process.env[name] || '';
    return {
      length: v.length,
      lastChar: v.charCodeAt(v.length - 1),
      hasNewline: v.endsWith('\n') || v.endsWith('\r'),
    };
  };
  return res.status(200).json({
    LINE_CHANNEL_SECRET: check('LINE_CHANNEL_SECRET'),
    LINE_CHANNEL_ACCESS_TOKEN: check('LINE_CHANNEL_ACCESS_TOKEN'),
    SUPABASE_URL: check('SUPABASE_URL'),
    SUPABASE_ANON_KEY: check('SUPABASE_ANON_KEY'),
    ANTHROPIC_API_KEY: check('ANTHROPIC_API_KEY'),
    GOOGLE_SHEET_WEBHOOK: check('GOOGLE_SHEET_WEBHOOK'),
    CRON_SECRET: check('CRON_SECRET'),
  });
}
