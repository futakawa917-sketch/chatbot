import crypto from 'crypto';

export default async function handler(req, res) {
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  const testBody = '{"destination":"test","events":[]}';
  const sig = crypto.createHmac('SHA256', secret).update(testBody).digest('base64');
  return res.status(200).json({
    secretLength: secret.length,
    secretFirstChar: secret.charCodeAt(0),
    secretLastChar: secret.charCodeAt(secret.length - 1),
    expectedSig: sig,
  });
}
