// 情報の泉から補助金情報をHTMLスクレイピングして Vercel API に送信
import { chromium } from 'playwright';
import fs from 'fs';

const LOGIN_URL = process.env.IZUMI_LOGIN_URL || 'https://j-izumi.com/login?previous=1';
const USERNAME = process.env.IZUMI_USERNAME;
const PASSWORD = process.env.IZUMI_PASSWORD;
const UPLOAD_ENDPOINT = process.env.UPLOAD_ENDPOINT || 'https://chatbot-tau-five-39.vercel.app/api/upload-izumi';
const CRON_SECRET = process.env.CRON_SECRET;
const SEARCH_URL = 'https://j-izumi.com/search-subsidy';
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '50', 10);

async function login(page) {
  console.log('1. ログインページへ移動...');
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

  console.log('2. ログイン情報入力...');
  await page.fill('input[name="account"]', USERNAME);
  await page.fill('input[name="password"]', PASSWORD);

  console.log('3. ログイン実行...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('input[type="submit"][value="ログイン"]'),
  ]);

  // 他の端末ログイン中プロンプト
  const forceLoginButton = await page.$('text=ログインする');
  if (forceLoginButton) {
    console.log('3.5. 他の端末をログアウト...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      forceLoginButton.click(),
    ]);
  }

  if (page.url().includes('/login')) {
    throw new Error('ログインに失敗しました');
  }
  console.log('   ログイン成功:', page.url());
}

async function scrapeCurrentPage(page) {
  // 各補助金カードを抽出
  return await page.evaluate(() => {
    const items = [];
    // 補助金カードの可能性があるセレクタを試す
    const cards = document.querySelectorAll('[class*="subsidy"], [class*="result"], .item, article, .card, [class*="support"]');

    // セレクタで取れない場合はテキストベースで全要素探索
    const allDivs = document.querySelectorAll('div');
    const candidates = new Set();

    for (const div of allDivs) {
      const text = div.textContent || '';
      // 「上限金額」「公開日」「対象地域」を含むブロックは補助金カードの可能性大
      if (text.includes('上限金額') && text.includes('公開日') && text.length < 3000 && text.length > 100) {
        candidates.add(div);
      }
    }

    // 重複した親子要素を除外（最も小さい要素を残す）
    const finalCards = [];
    for (const c of candidates) {
      let isChild = false;
      for (const other of candidates) {
        if (other !== c && c.contains(other)) {
          isChild = true;
          break;
        }
      }
      if (!isChild) finalCards.push(c);
    }

    finalCards.forEach((card) => {
      const text = card.textContent.replace(/\s+/g, ' ').trim();
      const titleEl = card.querySelector('a, h2, h3, h4, [class*="title"], [class*="name"]');
      const title = titleEl?.textContent?.trim() || '';
      const link = card.querySelector('a')?.href || '';

      const extract = (label) => {
        const idx = text.indexOf(label);
        if (idx === -1) return '';
        const afterLabel = text.substring(idx + label.length, idx + label.length + 80);
        // 次のラベルまで取る
        const nextLabels = ['公開日', '受付期間', '対象地域', '上限金額', '申請難易度', '支援種別', '締切'];
        let endIdx = afterLabel.length;
        for (const nl of nextLabels) {
          const ni = afterLabel.indexOf(nl);
          if (ni > 0 && ni < endIdx) endIdx = ni;
        }
        return afterLabel.substring(0, endIdx).trim();
      };

      if (title) {
        items.push({
          title,
          detail_url: link,
          max_amount: extract('上限金額'),
          difficulty: extract('申請難易度'),
          publish_date: extract('公開日'),
          application_period: extract('受付期間'),
          target_area: extract('対象地域'),
          source_type: extract('支援種別'),
        });
      }
    });

    return items;
  });
}

async function main() {
  if (!USERNAME || !PASSWORD) {
    console.error('IZUMI_USERNAME / IZUMI_PASSWORD が設定されていません');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await login(page);

    console.log('4. 検索ページへ移動...');
    await page.goto(SEARCH_URL, { waitUntil: 'networkidle' });

    const allItems = [];
    const seen = new Set();

    for (let p = 1; p <= MAX_PAGES; p++) {
      console.log(`5. ページ${p}を解析中...`);
      await page.waitForTimeout(1500);

      const items = await scrapeCurrentPage(page);
      console.log(`   ${items.length}件取得`);

      let newCount = 0;
      for (const item of items) {
        const key = item.title + (item.detail_url || '');
        if (seen.has(key)) continue;
        seen.add(key);
        allItems.push(item);
        newCount++;
      }
      console.log(`   新規 ${newCount}件、累計 ${allItems.length}件`);

      // 次ページボタンを探す
      const clicked = await page.evaluate(() => {
        // ページネーション内の全リンクを取得
        const links = Array.from(document.querySelectorAll('a, button'));
        // 「次」「›」「»」を含むリンク
        for (const link of links) {
          const txt = (link.textContent || '').trim();
          if ((txt === '次»' || txt === '次>' || txt === '次' || txt === '›' || txt === '»' || txt === 'next' || txt.includes('次へ')) && !link.classList.contains('disabled')) {
            link.click();
            return true;
          }
        }
        return false;
      });

      if (clicked) {
        await page.waitForTimeout(2000);
        await page.waitForLoadState('networkidle').catch(() => {});
      }

      if (!clicked) {
        console.log('   次ページなし、終了');
        break;
      }

      if (newCount === 0) {
        console.log('   新規データなし、終了');
        break;
      }
    }

    console.log(`6. ログアウト...`);
    try {
      await page.goto('https://j-izumi.com/logout', { waitUntil: 'networkidle', timeout: 10000 });
    } catch {}

    console.log(`7. 取得完了: 合計${allItems.length}件`);
    console.log('   サンプル:', JSON.stringify(allItems.slice(0, 2), null, 2));

    // Vercel APIに送信
    console.log('8. Vercel APIに送信...');
    const res = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ items: allItems }),
    });
    const result = await res.text();
    console.log('   レスポンス:', res.status, result);

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

    console.log('✅ 完了');
  } catch (e) {
    console.error('エラー:', e);
    try {
      await page.screenshot({ path: '/tmp/izumi_error.png', fullPage: true });
      const html = await page.content();
      fs.writeFileSync('/tmp/izumi_error.html', html);
    } catch {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
