/**
 * 三今設計 報價單系統 - Google Apps Script 後端
 * 功能: 管理 Google Sheet、生成Excel、上傳Google Drive、版本控制
 * 部署: Google Apps Script (做為 Web App)
 */

// ============ 全局配置 ============
const CONFIG = {
  SHEET_ID: '1F6C9hbqQsCvuHo0Xy7bYXnXamiDzQnHH9IjPjb4Fb3I',

  // ⚠️ 之後改成你的 Google Drive 資料夾 ID，現在先用 'root'（存在我的雲端硬碟根目錄）
  QUOTATION_FOLDER_ID: '1X6I8Yg1QHWeoKW6ocoxzy8cOwb1U2rgs',
  TEMPLATE_ID: '1uVwH0yhzpUG_RKmKXl54Xth4BSE1HTR3v6xQr_V8NDU',

  // Google Sheet 工作表名稱（與實際 Tab 名稱一致）
  SHEETS: {
    COMPANY_CONFIG: 'CompanyConfig',
    WORK_CLASS_TEMPLATES: 'WorkClassTemplates',
    WORK_ITEM_TEMPLATES: 'WorkItemTemplates',
    CUSTOM_WORK_CLASSES: 'CustomWorkClasses',
    CUSTOM_WORK_ITEMS: 'CustomWorkItems',
    VERSION_HISTORY: 'VersionHistory'
  }
};

// ============ CORS Headers Helper ============
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ Web App 入口點 - GET ============
// 用於讀取資料（工班列表、版本歷史等）
function doGet(e) {
  try {
    const action = e.parameter.action || 'getWorkClasses';
    const projectName = e.parameter.projectName || '';
    const password = e.parameter.password || '';

    let response;

    switch (action) {
      case 'getWorkClasses':
        response = getWorkClasses();
        break;
      case 'getVersionHistory':
        response = getVersionHistory(projectName);
        break;
      case 'getCompanyConfig':
        response = getCompanyConfig();
        break;
      case 'login':
        response = login(password);
        break;
      case 'checkNeedPassword':
        response = checkNeedPassword();
        break;
      default:
        response = { success: false, error: '未知的操作: ' + action };
    }

    return jsonResponse(response);
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ============ Web App 入口點 - POST ============
// 用於寫入資料（新增工班、記錄版本、上傳Excel）
function doPost(e) {
  try {
    const action = e.parameter.action;
    const data = JSON.parse(e.postData.contents || '{}');

    let response;

    switch (action) {
      case 'addCustomWorkClass':
        response = addCustomWorkClass(data);
        break;
      case 'uploadExcel':
        response = uploadExcel(data);
        break;
      case 'recordVersion':
        response = recordVersion(data);
        break;
      default:
        response = { success: false, error: '未知的操作: ' + action };
    }

    return jsonResponse(response);
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ============ 獲取公司配置（過濾掉密碼） ============
function getCompanyConfig() {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID)
    .getSheetByName(CONFIG.SHEETS.COMPANY_CONFIG);

  if (!sheet) return { success: false, error: 'CompanyConfig 工作表不存在' };

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  const config = {};
  data.forEach(row => {
    if (row[0] && row[0] !== 'system_password') { // 密碼永遠不回傳給前端
      config[row[0]] = row[1];
    }
  });

  return { success: true, data: config };
}

// ============ 檢查是否需要密碼 ============
function checkNeedPassword() {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID)
    .getSheetByName(CONFIG.SHEETS.COMPANY_CONFIG);
  if (!sheet) return { success: true, needPassword: false };

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  const row = data.find(r => r[0] === 'system_password');
  const hasPassword = row && row[1] && row[1].toString().trim() !== '';
  return { success: true, needPassword: hasPassword };
}

// ============ 登入驗證 ============
function login(inputPassword) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID)
    .getSheetByName(CONFIG.SHEETS.COMPANY_CONFIG);
  if (!sheet) return { success: false, error: '無法連接設定檔' };

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  const row = data.find(r => r[0] === 'system_password');

  // 沒有設密碼，直接复用
  if (!row || !row[1] || row[1].toString().trim() === '') {
    return { success: true, token: _generateToken('no_password') };
  }

  const validPasswords = row[1].toString().split(',').map(p => p.trim());
  if (validPasswords.includes(inputPassword.trim())) {
    // 密碼正確，產生今日的 token（對應輸入的密碼，每天新一个）
    const token = _generateToken(inputPassword.trim());
    return { success: true, token };
  }

  return { success: false, error: '密碼錯誤' };
}

// 內部函數：產生今日旋轉的 token
function _generateToken(password) {
  const today = new Date();
  const dateStr = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
  const raw = password + '|' + dateStr + '|CheckupQuote';
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('').substring(0, 32);
}

// ============ 獲取所有工班模板 ============
function getWorkClasses() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  const classSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.WORK_CLASS_TEMPLATES);
  if (!classSheet) return { success: false, error: 'WorkClassTemplates 工作表不存在' };

  const itemSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.WORK_ITEM_TEMPLATES);
  if (!itemSheet) return { success: false, error: 'WorkItemTemplates 工作表不存在' };

  const lastClassRow = classSheet.getLastRow();
  if (lastClassRow < 2) return { success: true, data: [] };

  const classData = classSheet.getRange(2, 1, lastClassRow - 1, 7).getValues();

  const lastItemRow = itemSheet.getLastRow();
  const itemData = lastItemRow >= 2
    ? itemSheet.getRange(2, 1, lastItemRow - 1, 10).getValues()
    : [];

  // 也讀取自訂工班
  const customClassSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CUSTOM_WORK_CLASSES);
  const customItemSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CUSTOM_WORK_ITEMS);

  let customClassData = [];
  let customItemData = [];

  if (customClassSheet && customClassSheet.getLastRow() >= 2) {
    customClassData = customClassSheet.getRange(2, 1, customClassSheet.getLastRow() - 1, 7).getValues();
  }
  if (customItemSheet && customItemSheet.getLastRow() >= 2) {
    customItemData = customItemSheet.getRange(2, 1, customItemSheet.getLastRow() - 1, 8).getValues();
  }

  const allClassData = [...classData, ...customClassData];
  const allItemData = [...itemData, ...customItemData];

  const workClasses = allClassData
    .filter(row => row[0]) // 工班代碼不為空
    .map(row => {
      const code = row[0];
      const items = allItemData
        .filter(r => r[0] === code && r[2]) // 同代碼且有細項名稱
        .map(r => ({
          序號: r[1],
          名稱: r[2],
          量: r[3],
          單位: r[4],
          工資: r[5],
          單價: r[6]
        }));

      return {
        code,
        名稱: row[1],
        排序: row[2] || 99,
        必選: row[3] === true || row[3] === 'TRUE' || row[3] === true,
        狀態: row[4] || '啟用',
        細項: items
      };
    })
    .filter(wc => wc.狀態 !== '停用');

  return {
    success: true,
    data: workClasses.sort((a, b) => a.排序 - b.排序)
  };
}

// ============ 新增自訂工班 ============
function addCustomWorkClass(workClass) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  const customClassSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CUSTOM_WORK_CLASSES);
  if (!customClassSheet) return { success: false, error: 'CustomWorkClasses 工作表不存在' };

  customClassSheet.appendRow([
    workClass.code,
    workClass.名稱,
    workClass.排序 || 99,
    false,
    '啟用',
    new Date().toLocaleDateString('zh-TW'),
    '前台系統'
  ]);

  const customItemSheet = spreadsheet.getSheetByName(CONFIG.SHEETS.CUSTOM_WORK_ITEMS);
  if (!customItemSheet) return { success: false, error: 'CustomWorkItems 工作表不存在' };

  (workClass.細項 || []).forEach(item => {
    customItemSheet.appendRow([
      workClass.code,
      item.序號,
      item.名稱,
      item.量,
      item.單位,
      item.工資 || 0,
      item.單價,
      new Date().toLocaleDateString('zh-TW')
    ]);
  });

  return {
    success: true,
    message: `自訂工班 ${workClass.名稱} 已保存`,
    code: workClass.code
  };
}

// ============ 記錄版本歷史 ============
function recordVersion(record) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID)
    .getSheetByName(CONFIG.SHEETS.VERSION_HISTORY);

  if (!sheet) return { success: false, error: 'VersionHistory 工作表不存在' };

  sheet.appendRow([
    record.報價單ID,
    record.案件名稱,
    record.版本號,
    record.版本日期,
    record.修改時間,
    record.修改項目摘要,
    record.Google_Drive檔案名稱 || '',
    record.Google_Drive檔案ID || '',
    record.修改者備註 || '',
    record.rawJson || '' // 新增 J 欄: 原始設定 JSON
  ]);

  return { success: true, message: '版本已記錄' };
}

// ============ 獲取版本歷史 ============
function getVersionHistory(projectName) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID)
    .getSheetByName(CONFIG.SHEETS.VERSION_HISTORY);

  if (!sheet) return { success: false, error: 'VersionHistory 工作表不存在' };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, data: [] };

  const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues(); // 讀取到 J 欄
  const versions = data
    .filter(row => row[0]) // 就算不過濾 projectName，前端全部取出可以自己處理
    .map(row => ({
      報價單ID: row[0],
      案件名稱: row[1],
      版本號: row[2],
      版本日期: row[3],
      修改時間: row[4],
      修改項目摘要: row[5],
      Google_Drive檔案名稱: row[6],
      Google_Drive檔案ID: row[7],
      備註: row[8],
      rawJson: row[9] || ''
    }))
    .sort((a, b) => new Date(b.版本日期) - new Date(a.版本日期));

  return { success: true, data: versions };
}

// ============ 生成並上傳 Excel 報價單 ============
function uploadExcel(data) {
  const { data: excelData, fileName } = data;

  // 1. 複製用戶的「自訂範本」，這樣就保留了所有顏色/邊框/刪除行的樣式
  const templateFile = DriveApp.getFileById(CONFIG.TEMPLATE_ID);
  const tempFile = templateFile.makeCopy('temp_' + fileName);
  const tempSS = SpreadsheetApp.openById(tempFile.getId());
  const sheet = tempSS.getSheets()[0]; // 寫入到範本的第一個分頁

  try {
    // 2. 填寫資料（只填值，不寫死樣式）
    fillQuotationData(sheet, excelData, excelData.quotation);

    // 3. 強制寫入並等待生效
    SpreadsheetApp.flush();
    Utilities.sleep(1000);

    // 4. 用 UrlFetchApp 匯出為 xlsx
    const ssId = tempSS.getId();
    const exportUrl = `https://docs.google.com/spreadsheets/d/${ssId}/export?format=xlsx`;
    const blob = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }).getBlob();
    blob.setName(fileName);

    // 5. 上傳到指定 Drive 資料夾
    const folderId = createDriveFolderStructure();
    const file = DriveApp.getFolderById(folderId).createFile(blob);

    return {
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      downloadUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view'
    };
  } finally {
    // 6. 清理這份暫存的 Google Sheet 檔案
    try { tempFile.setTrashed(true); } catch (e) { }
  }
}

// ============ 填入報價單數據（依照範本填寫）============
function fillQuotationData(sheet, excelData, quotation) {
  // 1. 尋找範本的「結尾列 (footerRow)」：從 Row 7 往下找，第一個有任何資料的列就會認定為 Footer 的開頭 (例如「以下空白」)。
  let footerRow = -1;
  const maxRows = sheet.getMaxRows();
  if (maxRows >= 7) {
    const searchValues = sheet.getRange(7, 1, maxRows - 6, 8).getValues();
    for (let r = 0; r < searchValues.length; r++) {
      if (searchValues[r].join('').trim() !== '') {
        footerRow = 7 + r;
        break;
      }
    }
  }

  // Row 4: 報價單日期
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  sheet.getRange('A4').setValue(`${dateStr}報價單`);

  // Row 5: 案名
  sheet.getRange('A5').setValue('案名');
  sheet.getRange('B5').setValue(excelData.projectName);

  // Row 6: 動態更新利潤率表頭 (E6)
  const profitHeader = excelData.profitMargin ? Number(excelData.profitMargin) : 0.35;
  sheet.getRange('E6').setValue(profitHeader);

  // 整理資料：將資料依工班分組
  const categories = {};
  const orderInfo = {};
  let catIndex = 0;

  (quotation.items || []).forEach(item => {
    const groupName = item.工班 || '未分類工班';
    if (!categories[groupName]) {
      categories[groupName] = [];
      orderInfo[groupName] = catIndex++;
    }
    categories[groupName].push(item);
  });

  const sortedGroups = Object.keys(categories).sort((a, b) => orderInfo[a] - orderInfo[b]);

  let row = 7;
  let overallTotal = 0;

  // 動態確保目標列是空的，如果撞到 footerRow 就向下推擠新增一列
  const ensureRow = () => {
    if (footerRow !== -1 && row >= footerRow) {
      sheet.insertRowBefore(row);
      footerRow++; // 將 footer 跟著往下推
    }
  };

  for (const catName of sortedGroups) {
    const items = categories[catName];

    ensureRow();
    // 寫入工班名稱 (合併 A~H 欄, 置中, 深藍色, 字級 18)
    sheet.getRange(row, 1, 1, 8).merge()
      .setValue(catName)
      .setFontWeight('bold')
      .setFontColor('#002B5C') // 三今專屬深藍色
      .setFontSize(18) // 改用字級 18
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    row++;

    let catTotal = 0;
    // 輸出細項
    items.forEach((item, index) => {
      ensureRow();
      
      const rowData = [
        index + 1,                       // A: 項次
        item.名稱 || item.name || '',      // B: 名稱
        item.量 || item.quantity || '',    // C: 數量
        item.單位 || item.unit || '',      // D: 單位
        item.工資 || '',                  // E: 0.35/工資
        item.單價 || item.price || '',     // F: 單價
        item.複價 || '',                  // G: 複價
        item.備註 || ''                   // H: 備註
      ];
      sheet.getRange(row, 1, 1, 8).setValues([rowData])
           .setFontColor('#000000') 
           .setFontWeight('normal')
           .setFontSize(14)
           .setVerticalAlignment('middle');
           
      sheet.getRange(row, 1).setHorizontalAlignment('center'); // 項次置中
      sheet.getRange(row, 2).setHorizontalAlignment('left'); // 品名靠左
      sheet.getRange(row, 3, 1, 6).setHorizontalAlignment('right'); // 數字金額靠右
      
      // 金額加上千分位
      sheet.getRange(row, 5, 1, 3).setNumberFormat('#,##0');

      const sub = Number(item.複價) || (Number(item.量) * Number(item.單價)) || 0;
      catTotal += sub;
      row++;
    });

    // 項目小計剛好就在這個工班細項的下一列
    ensureRow();
    sheet.getRange(row, 1, 1, 8).setFontWeight('normal').setFontSize(14);
    sheet.getRange(row, 2).setValue('項目小計').setHorizontalAlignment('right');
    sheet.getRange(row, 7).setValue(catTotal).setFontWeight('bold').setNumberFormat('#,##0').setHorizontalAlignment('right');
    overallTotal += catTotal;
    row++;
  }

  // 因為使用者已經在範本最下方預設好相同的「備註、簽署」等說明，
  // 這裡不再由程式重複新增，以免和範本疊加。
  
  // 清理可能多餘的預留空白列 (使生成的細項與 footer 完美貼合)
  if (footerRow !== -1 && footerRow > row) {
    sheet.deleteRows(row, footerRow - row);
  }

  // 統一為生成的項目區域補上格線，解決外加行數沒有邊框的問題
  if (row > 7) {
    sheet.getRange(7, 1, row - 7, 8).setBorder(true, true, true, true, true, true, null, SpreadsheetApp.BorderStyle.SOLID);
  }

  // 尋找範本最底部的「總計」並更新數值 (如果範本沒有公式，自動填入)
  const remainingRows = sheet.getMaxRows() - row + 1;
  if (remainingRows > 0) {
    const bottomValues = sheet.getRange(row, 1, remainingRows, 8).getValues();
    for (let r = 0; r < bottomValues.length; r++) {
      if (String(bottomValues[r][1]).includes('總計')) { 
        sheet.getRange(row + r, 7).setValue(overallTotal).setNumberFormat('"NT$"#,##0').setFontWeight('bold');
        break; 
      }
    }
  }
}

// ============ 建立 Google Drive 資料夾結構 ============
function createDriveFolderStructure() {
  const rootFolder = DriveApp.getFolderById(CONFIG.QUOTATION_FOLDER_ID);
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');

  let yearFolder;
  const yearFolders = rootFolder.getFoldersByName(year);
  yearFolder = yearFolders.hasNext() ? yearFolders.next() : rootFolder.createFolder(year);

  let monthFolder;
  const monthFolders = yearFolder.getFoldersByName(month);
  monthFolder = monthFolders.hasNext() ? monthFolders.next() : yearFolder.createFolder(month);

  return monthFolder.getId();
}

// ============ 測試函數（在 Apps Script 編輯器執行） ============
function testGetWorkClasses() {
  const result = getWorkClasses();
  Logger.log(JSON.stringify(result, null, 2));
}

function testGetCompanyConfig() {
  const result = getCompanyConfig();
  Logger.log(JSON.stringify(result, null, 2));
}
