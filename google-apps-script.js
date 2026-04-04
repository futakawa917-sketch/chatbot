// =====================================================
// このコードをGoogle Apps Scriptに貼り付けてデプロイしてください
// 手順:
// 1. スプレッドシートを開く
// 2. 拡張機能 → Apps Script を開く
// 3. このコードを貼り付ける
// 4. デプロイ → 新しいデプロイ → ウェブアプリ
//    - 実行するユーザー: 自分
//    - アクセスできるユーザー: 全員
// 5. デプロイ → URLをコピー
// 6. VercelにGOOGLE_SHEET_WEBHOOK環境変数として設定
// =====================================================

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // ヘッダーがなければ作成
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        '日時',
        'モード',
        '会社名',
        '代表者名',
        '法人/個人',
        '設立日',
        '所在地',
        '正社員数',
        'アルバイト数',
        'インボイス',
        '補助金経験',
        '事業内容',
        'やりたいこと',
        '診断結果(補助金名)',
        '合計想定受給額',
        'Zoom予約',
        '会話全文'
      ]);
    }

    // シミュレーション結果から補助金名を抽出
    var subsidyNames = '';
    var totalEstimated = '';
    if (data.simulationResults) {
      if (data.simulationResults.results) {
        subsidyNames = data.simulationResults.results.map(function(r) {
          return r.name + '(' + (r.estimatedAmount || '?') + '万円)';
        }).join(', ');
      }
      totalEstimated = data.simulationResults.totalEstimated || '';
    }

    // 会話全文を簡潔にまとめる
    var conversationSummary = '';
    if (data.fullConversation) {
      conversationSummary = data.fullConversation.map(function(m) {
        var role = m.role === 'user' ? 'ユーザー' : 'ボット';
        var text = m.content.replace(/---SIMULATION_START---[\s\S]*?---SIMULATION_END---/g, '[シミュレーション結果]');
        if (text.length > 200) text = text.substring(0, 200) + '...';
        return role + ': ' + text;
      }).join('\n');
    }

    sheet.appendRow([
      new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      data.mode || '',
      data.companyName || '',
      data.representative || '',
      data.entityType || '',
      data.established || '',
      data.location || '',
      data.employeesFull || '',
      data.employeesPart || '',
      data.invoiceRegistered || '',
      data.subsidyExperience || '',
      data.businessContent || '',
      data.desiredUse || '',
      subsidyNames,
      totalEstimated,
      data.zoomBooked ? 'はい' : 'いいえ',
      conversationSummary
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
