// 情報の泉から補助金情報を取得して Vercel API に送信するスクリプト
// GitHub Actions から実行される

import { chromium } from 'playwright';
import fs from 'fs';

const LOGIN_URL = process.env.IZUMI_LOGIN_URL || 'https://j-izumi.com/login?previous=1';
const USERNAME = process.env.IZUMI_USERNAME;
const PASSWORD = process.env.IZUMI_PASSWORD;
const UPLOAD_ENDPOINT = process.env.UPLOAD_ENDPOINT || 'https://chatbot-tau-five-39.vercel.app/api/upload-izumi-csv';
const CRON_SECRET = process.env.CRON_SECRET;
const SEARCH_URL = 'https://j-izumi.com/search-subsidy';

async function main() {
  if (!USERNAME || !PASSWORD) {
    console.error('IZUMI_USERNAME / IZUMI_PASSWORD が設定されていません');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    // 1. ログインページへ
    console.log('1. ログインページへ移動...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

    // 2. ログイン情報を入力
    console.log('2. ログイン情報を入力...');
    await page.fill('input[name="account"]', USERNAME);
    await page.fill('input[name="password"]', PASSWORD);

    // 3. ログイン実行
    console.log('3. ログイン実行...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('input[type="submit"][value="ログイン"]'),
    ]);

    console.log('   ログイン後のURL:', page.url());

    // 「他の端末でログイン中」プロンプトをチェック
    const forceLoginButton = await page.$('text=ログインする');
    if (forceLoginButton) {
      console.log('3.5. 他の端末をログアウトしてログイン続行...');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        forceLoginButton.click(),
      ]);
      console.log('   強制ログイン後のURL:', page.url());
    }

    if (page.url().includes('/login')) {
      throw new Error('ログインに失敗しました');
    }

    // 4. 検索ページへ
    console.log('4. 検索ページへ移動...');
    await page.goto(SEARCH_URL, { waitUntil: 'networkidle' });

    // 5. CSVダウンロードボタンを探してクリック
    console.log('5. CSVダウンロード...');
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

    // ボタンのセレクタを試す（複数パターン）
    const csvButton = await page.$('text=CSVダウンロード') ||
                      await page.$('a:has-text("CSV")') ||
                      await page.$('button:has-text("CSV")');

    if (!csvButton) {
      // ページのHTMLを保存してデバッグ
      const html = await page.content();
      fs.writeFileSync('/tmp/izumi_search_page.html', html);
      throw new Error('CSVダウンロードボタンが見つかりません。ページHTMLを /tmp/izumi_search_page.html に保存しました');
    }

    await csvButton.click();
    const download = await downloadPromise;

    const csvPath = '/tmp/izumi_subsidies.csv';
    await download.saveAs(csvPath);
    console.log('   CSVを保存:', csvPath);

    // 6. CSV内容を読み込み
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    console.log('   CSVサイズ:', csvContent.length, 'bytes');
    console.log('   先頭500文字:', csvContent.substring(0, 500));

    // 7. ログアウト
    console.log('7. ログアウト...');
    try {
      await page.goto('https://j-izumi.com/logout', { waitUntil: 'networkidle', timeout: 10000 });
    } catch {}

    // 8. Vercel API に送信
    console.log('8. Vercel API に送信...');
    const res = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ csv: csvContent }),
    });

    const result = await res.text();
    console.log('   レスポンス:', res.status, result);

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }

    console.log('✅ 完了');
  } catch (e) {
    console.error('エラー:', e);
    // スクショを保存
    try {
      await page.screenshot({ path: '/tmp/izumi_error.png', fullPage: true });
      console.error('スクショを /tmp/izumi_error.png に保存');
    } catch {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
