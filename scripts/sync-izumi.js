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

    // ページHTMLを保存（デバッグ用）
    const searchHtml = await page.content();
    fs.writeFileSync('/tmp/izumi_search_page.html', searchHtml);

    // 「CSV」を含むすべての要素を探す
    const csvElements = await page.locator('text=CSV').all();
    console.log('   CSV関連要素数:', csvElements.length);

    if (csvElements.length === 0) {
      throw new Error('CSV関連要素が見つかりません');
    }

    // ボタンの情報を確認
    for (let i = 0; i < csvElements.length; i++) {
      const tag = await csvElements[i].evaluate(el => el.tagName);
      const text = await csvElements[i].textContent();
      console.log(`   要素[${i}]: ${tag} - ${text?.trim()}`);
    }

    // ダウンロード待機 + ボタンクリックを並列実行
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    const popupPromise = page.context().waitForEvent('page', { timeout: 60000 }).catch(() => null);

    // CSVボタンをクリック（最初のものを使う）
    await csvElements[0].scrollIntoViewIfNeeded();
    await csvElements[0].click();

    console.log('   クリック後待機...');
    await page.waitForTimeout(3000);

    // モーダルが出ていればOKボタンを押す
    const confirmBtn = await page.$('button:has-text("OK")') ||
                       await page.$('button:has-text("ダウンロード")') ||
                       await page.$('text=ダウンロードする');
    if (confirmBtn) {
      console.log('   確認ボタンをクリック');
      await confirmBtn.click();
    }

    // ダウンロード or 新しいページを待つ
    const [download, popup] = await Promise.all([downloadPromise, popupPromise]);

    let csvPath = '/tmp/izumi_subsidies.csv';
    if (download) {
      await download.saveAs(csvPath);
      console.log('   CSVを保存（ダウンロードイベント）:', csvPath);
    } else if (popup) {
      console.log('   新しいページのURL:', popup.url());
      const csvText = await popup.evaluate(() => document.body.innerText);
      fs.writeFileSync(csvPath, csvText);
      console.log('   CSVを保存（新しいページから）:', csvPath);
    } else {
      // 最終手段：現在のページの中身がCSVかチェック
      const currentText = await page.evaluate(() => document.body.innerText);
      if (currentText.includes(',') && currentText.length > 1000) {
        fs.writeFileSync(csvPath, currentText);
        console.log('   CSVを保存（現在のページから）:', csvPath);
      } else {
        // 全リンクからCSVのhrefを探す
        const csvLinks = await page.$$eval('a', as =>
          as.map(a => a.href).filter(h => h.toLowerCase().includes('csv') || h.includes('export'))
        );
        console.log('   CSV関連リンク:', csvLinks);
        if (csvLinks.length > 0) {
          // クッキー付きでfetch
          const cookies = await context.cookies();
          const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
          const r = await fetch(csvLinks[0], { headers: { Cookie: cookieStr } });
          const txt = await r.text();
          fs.writeFileSync(csvPath, txt);
          console.log('   CSVを保存（fetch経由）:', csvPath, 'サイズ:', txt.length);
        } else {
          throw new Error('CSVのダウンロードに失敗しました');
        }
      }
    }

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
