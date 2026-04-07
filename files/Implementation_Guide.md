# 三今設計報價單系統 - 完整實施指南

## 📋 目錄
1. [系統概述](#系統概述)
2. [必要條件](#必要條件)
3. [第一步：建立 Google Sheet 後台](#第一步建立-google-sheet-後台)
4. [第二步：部署 Google Apps Script](#第二步部署-google-apps-script)
5. [第三步：部署前台 React 應用](#第三步部署前台-react-應用)
6. [第四步：配置和測試](#第四步配置和測試)
7. [常見問題](#常見問題)

---

## 系統概述

### 架構圖
```
┌─────────────────────────────────────────────────────────────┐
│                    前台 Web 應用 (React)                      │
│  • 工班選擇  • 細項編輯  • 計算預覽  • 版本管理             │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
    Google Apps Script           Google Sheet
    (後端邏輯)                    (資料存儲)
         │                            │
    ├─ 驗證                     ├─ 公司配置
    ├─ 生成 Excel              ├─ 工班模板
    ├─ 上傳 Drive              ├─ 自訂工班
    └─ 版本控制                └─ 版本歷史
                       │
                       ▼
            Google Drive (檔案儲存)
         └─ 年份 > 月份 > 報價單
```

### 功能流程
```
1️⃣  選擇工班
    ├─ 從 Google Sheet 讀取工班模板
    ├─ 必選工班自動勾選
    └─ 支持新增自訂工班

2️⃣  編輯細項
    ├─ 修改數量和單價
    ├─ 新增 / 刪除細項
    └─ 參考市場行情提示

3️⃣  計算與預覽
    ├─ 自動計算複價
    ├─ 加入 30% 管理費
    ├─ 可變利潤加成
    └─ 展示最終報價

4️⃣  生成 Excel
    ├─ 生成標準報價單
    ├─ 上傳 Google Drive
    ├─ 記錄版本信息
    └─ 保存至 yyyy/mm/ 資料夾

5️⃣  版本管理
    ├─ 查看修改歷史
    ├─ 下載舊版本
    └─ 對比版本差異
```

---

## 必要條件

### 所需帳號和工具
- ✅ Google 帳號（已購買 Google One，有 3TB 空間）
- ✅ 瀏覽器（Chrome / Safari / Firefox）
- ✅ 基本的 Google Sheet 知識

### 不需要
- ❌ 編程知識
- ❌ 伺服器
- ❌ 付費服務

---

## 第一步：建立 Google Sheet 後台

### 1.1 建立新 Google Sheet

1. 前往 [Google Drive](https://drive.google.com)
2. 點擊「新增」→「Google Sheet」
3. 重命名為 **`三今設計_報價單系統_後台管理`**

### 1.2 建立所需工作表

右鍵點擊工作表標籤，選擇「插入工作表」，建立以下 6 個工作表：

| 序號 | 工作表名稱 | 用途 |
|------|-----------|------|
| 1 | 公司配置 | 儲存公司基本資訊、計算規則 |
| 2 | 工班模板庫 | 儲存所有預設工班 |
| 3 | 工班細項模板 | 儲存每個工班的預設細項 |
| 4 | 自訂工班庫 | 儲存自訂工班（系統自動填寫） |
| 5 | 自訂工班細項庫 | 儲存自訂工班細項（系統自動填寫） |
| 6 | 版本歷史記錄 | 儲存報價單版本紀錄（系統自動填寫） |

### 1.3 填入「公司配置」工作表

| 設置名稱 | 值 |
|---------|-----|
| company_name | 三今設計有限公司 |
| company_logo_url | https://sanjindesign.com/wp-content/uploads/2026/01/SanjindesignLOGOfull.svg |
| tax_id | 94032785 |
| address | 台北市松山區三民路91號 |
| contact_person | 連子沂 |
| contact_phone | 09-3305-2049 |
| profit_margin | 0.35 |
| management_fee_rate | 0.30 |
| tax_rate | 0.05 |
| default_currency | TWD |
| signature_required | true |

### 1.4 填入「工班模板庫」工作表

**表頭（第1行）:**
```
工班代碼 | 工班名稱 | 排序 | 是否必選 | 狀態 | 建立日期 | 最後修改日期
```

**數據（複製以下內容）:**
```
DEMO_001 | 保護/拆除工程 | 1 | FALSE | 啟用 | 2026-04-06 | 2026-04-06
WOOD_001 | 輕隔間及木作工程 | 2 | FALSE | 啟用 | 2026-04-06 | 2026-04-06
DOOR_001 | 硫化銅門工程 | 3 | FALSE | 啟用 | 2026-04-06 | 2026-04-06
SYSF_001 | 系統櫃工程 | 4 | FALSE | 啟用 | 2026-04-06 | 2026-04-06
KITCH_001 | 不鏽鋼廚具工程 | 5 | FALSE | 啟用 | 2026-04-06 | 2026-04-06
PAINT_001 | 油漆工程 | 6 | FALSE | 啟用 | 2026-04-06 | 2026-04-06
ELEC_001 | 水電工程 | 7 | FALSE | 啟用 | 2026-04-06 | 2026-04-06
FLOOR_001 | 木地板工程 | 8 | FALSE | 啟用 | 2026-04-06 | 2026-04-06
CURTAIN_001 | 窗簾工程 | 9 | FALSE | 啟用 | 2026-04-06 | 2026-04-06
MUDI_001 | 泥作工程 | 10 | FALSE | 啟用 | 2026-04-06 | 2026-04-06
DESIGN_001 | 設計及透視圖項目 | 11 | TRUE | 啟用 | 2026-04-06 | 2026-04-06
```

### 1.5 填入「工班細項模板」工作表

**表頭（第1行）:**
```
工班代碼 | 序號 | 細項名稱 | 預設數量 | 單位 | 參考工資 | 參考單價 | 市場行情範圍 | 建議單價 | 工法說明 | 價格評估
```

**以 DEMO_001 為例:**

| 工班代碼 | 序號 | 細項名稱 | 數量 | 單位 | 工資 | 單價 | 市場行情 | 建議 | 工法 | 評估 |
|---------|------|---------|------|------|------|------|---------|------|------|------|
| DEMO_001 | 1 | 保護 | 1 | 式 | 2400 | 8500 | 8000-9000 | 8500 | 工地保護工程 | ⭐⭐⭐ |
| DEMO_001 | 2 | 垃圾搬運 | 2 | 人 | 2400 | 3000 | 2800-3500 | 3000 | 垃圾清運 | ⭐⭐⭐ |
| DEMO_001 | 3 | 拆保護 | 2 | 人 | 2400 | 3000 | 2800-3500 | 3000 | 拆除保護 | ⭐⭐⭐ |
| DEMO_001 | 4 | 房門拆除 | 1 | 式 | 2500 | 3000 | 2500-3500 | 3000 | 房門拆除 | ⭐⭐⭐ |
| DEMO_001 | 5 | 廢棄物抽裝清運 | 2 | 式 | 14000 | 14500 | 13000-16000 | 14500 | 廢棄物清運 | ⭐⭐⭐ |
| DEMO_001 | 6 | 廚具拆除 | 1 | 式 | 6000 | 6500 | 6000-7500 | 6500 | 廚具拆除 | ⭐⭐⭐ |

**其他工班請參考提供的 Market_Analysis_Report.md 中的數據**

### 1.6 設置工作表權限

1. 點擊右上角「共用」
2. 新增共用對象：`googleapis-usercontent@googleusercontent.com`（Google Apps Script 服務帳戶）
3. 賦予「編輯」權限

---

## 第二步：部署 Google Apps Script

### 2.1 建立 Google Apps Script 專案

1. 在同一 Google Sheet 中，點擊「擴充功能」→「Apps Script」
2. 新建一個專案，命名為 `三今設計_報價單系統_後端`

### 2.2 複製 Google Apps Script 代碼

1. 清除預設的 `function myFunction()` 代碼
2. 複製 `GoogleAppsScript_Backend.js` 中的所有代碼並貼上
3. **重要：修改第 5-12 行的配置:**

```javascript
const CONFIG = {
  // ⚠️ 將此值替換為你的 Google Sheet ID
  SHEET_ID: '你的Google Sheet ID',  // 從 URL 複製: /spreadsheets/d/[此處]/edit
  
  // ⚠️ 將此值替換為 Google Drive 資料夾ID
  QUOTATION_FOLDER_ID: '你的Google Drive資料夾ID',  // 右鍵資料夾 → 連結 → 複製ID
  
  // 其他配置保持不變
};
```

**如何取得 Google Sheet ID:**
- 打開 Google Sheet，從 URL 複製：`https://docs.google.com/spreadsheets/d/[這個ID]/edit`

**如何取得 Google Drive 資料夾ID:**
1. 建立一個新資料夾：`三今設計_報價單系統`
2. 右鍵點擊資料夾 → 「連結」
3. 從 URL 複製：`https://drive.google.com/drive/folders/[這個ID]`

### 2.3 測試 Google Apps Script

1. 點擊「執行」→ 選擇 `initializeSheets()`
2. 若出現授權提示，點擊「查看權限」→「繼續」→ 授權
3. 執行完成後，回到 Google Sheet 檢查是否自動建立了所有工作表

### 2.4 部署為 Web App

1. 點擊「部署」→「新增部署」
2. 選擇「類型」→ 「Web 應用」
3. 「執行身份」: 選擇你的 Google 帳號
4. 「誰可以存取」: 選擇「任何人」
5. 點擊「部署」
6. **複製生成的部署URL**（格式：`https://script.google.com/macros/d/...`）

### 2.5 更新前台應用配置

在前面的 React 代碼中，找到這一行：
```javascript
const API_BASE = 'https://script.google.com/macros/d/YOUR_GOOGLE_APPS_SCRIPT_ID/usercontent';
```

將 `YOUR_GOOGLE_APPS_SCRIPT_ID` 替換為你部署的 Web App URL

---

## 第三步：部署前台 React 應用

### 選項 A: 使用 Netlify（推薦）

#### A.1 準備 React 應用

1. 建立新的 React 專案：
```bash
npx create-react-app sanjin-quotation-system
cd sanjin-quotation-system
```

2. 替換 `src/App.jsx` 的內容為提供的 `QuotationSystem_Frontend.jsx` 代碼

3. 安裝依賴（確保有 lucide-react）：
```bash
npm install lucide-react
```

#### A.2 部署到 Netlify

1. 推送代碼到 GitHub（或 GitLab）
2. 登入 [Netlify](https://netlify.com)
3. 點擊「Add new site」→「Import an existing project」
4. 連接你的 GitHub 倉庫
5. 建立環境變數：
   - `REACT_APP_API_BASE`: `https://script.google.com/macros/d/.../usercontent`
6. 點擊「Deploy」

**Netlify 會自動分配一個 URL，例如：** `https://sanjin-quotation.netlify.app`

### 選項 B: 本地運行（測試用）

```bash
npm start
```

應用會在 `http://localhost:3000` 運行

---

## 第四步：配置和測試

### 4.1 測試工班獲取

1. 打開前台應用
2. 檢查「選擇工班」是否顯示所有 11 個工班
3. 檢查「設計及透視圖項目」是否被自動勾選（必選）

### 4.2 測試新增自訂工班

1. 在「選擇工班」步驟，填入：
   ```
   工班名稱: 智能家居系統
   
   細項列表:
   風管安裝, 20, 米, 300, 500
   AI主機安裝, 1, 式, 5000, 15000
   ```
2. 點擊「新增自訂工班」
3. 檢查 Google Sheet 的「自訂工班庫」是否出現新工班

### 4.3 測試報價單生成

1. 填入案件信息：
   - 案件名稱：「安和吳公館」
   - 坪數：48
   - 利潤加成：0.35

2. 選擇工班（保持所有默認勾選）

3. 進入「編輯細項」，試著修改某個工班的細項

4. 進入「預覽確認」，檢查計算是否正確：
   - ✓ 複價 = 數量 × 單價
   - ✓ 管理費 = 小計 × 30%
   - ✓ 利潤 = (小計 + 管理費) × 利潤率
   - ✓ 稅金 = (小計 + 管理費 + 利潤) × 5%

5. 點擊「生成並上傳 Excel 報價單」

6. 檢查 Google Drive 資料夾是否出現新文件

### 4.4 檢查版本記錄

1. 進入「版本記錄」步驟
2. 應該能看到剛剛生成的報價單版本信息
3. 可點擊「下載」獲取 Excel 文件

---

## 常見問題

### Q1: 如何修改工班細項？
**A:** 
1. 在 Google Sheet「工班細項模板」中修改數據
2. 前台應用下次載入時會自動讀取最新數據
3. 已生成的報價單不會受影響

### Q2: 如何刪除自訂工班？
**A:** 
在 Google Sheet「自訂工班庫」中，找到該工班，修改「狀態」為「停用」

### Q3: 報價單生成失敗怎麼辦？
**A:** 
1. 檢查 Google Apps Script 是否正確部署
2. 檢查 Google Drive 資料夾是否存在且可寫
3. 查看瀏覽器控制台（F12）的錯誤訊息
4. 檢查 Google Sheet 是否有共用權限

### Q4: 如何修改計算規則（管理費比例、利潤率等）？
**A:** 
1. 修改 Google Sheet「公司配置」中的對應值
2. 或在前台應用輸入框直接修改（即時變更）

### Q5: 能否導出 PDF 版本？
**A:** 
當前系統只支援 Excel 導出。如需 PDF，可：
1. 在 Google Sheet 中右鍵選項打開該 Excel
2. 下載為 PDF 格式

### Q6: 報價單資料會保留多久？
**A:** 
所有報價單永久儲存在 Google Drive（您有 3TB 空間），版本記錄保存在 Google Sheet

---

## 📞 技術支援

如遇問題：
1. 查看「常見問題」部分
2. 檢查 Google Sheet 和 Apps Script 的日誌
3. 確認所有配置值是否正確

---

## 🎯 後續優化方向

以下功能可在未來迭代：
1. ✨ 報價單模板客製化（字體、顏色、logo）
2. 📊 報價單對比功能（v1 vs v2）
3. 📧 自動郵件發送報價單
4. 📱 行動裝置應用（React Native）
5. 💾 離線模式支持
6. 🔐 使用者登入與權限管理

---

## 📄 附件清單

本套系統包含以下檔案：

1. **Google_Sheet_Backend_Design.md** - Google Sheet 後台設計規格
2. **Market_Analysis_Report.md** - 市場行情分析與報價補齊
3. **QuotationSystem_Frontend.jsx** - React 前台應用（完整代碼）
4. **GoogleAppsScript_Backend.js** - Google Apps Script 後端代碼
5. **Implementation_Guide.md** - 本實施指南

---

**最後更新：2026-04-06**
**系統版本：v1.0**

