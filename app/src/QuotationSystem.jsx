import React, { useState, useEffect, useRef } from 'react';
import { Download, Plus, Trash2, Eye, Save, RotateCcw, ChevronDown, Calendar, BookOpen, AlertCircle, CheckCircle, TrendingUp, Lock, ArrowUp, ArrowDown, Menu } from 'lucide-react';

/**
 * 三今設計 報價單系統
 * 功能: 工班選擇 -> 細項編輯 -> Excel生成 -> Google Drive版本管理
 * 後端: Google Sheets + Google Drive + Google Apps Script
 * 更新時間: 2026-04-07 16:42 (Force Redeploy)
 */

const unitOptionsInitial = ['式', '才', '尺', '坪', '組', '個', '樘', '車', '人', '捲', '戶', '片', '門', '處', '點'];

const QuotationSystem = () => {
  const API_BASE = 'https://script.google.com/macros/s/AKfycbw7yqxg_ZMvrIpQyx9j5-Qj0EXtgBN8ULru4zl3Joiy2bNldPnKGeXgcGUyK4PbLefVhw/exec';

  // ============ 狀態管理 ============
  const [step, setStep] = useState(1); // 1:工班選擇 2:細項編輯 3:計算與確認 4:版本預覽
  const [projectName, setProjectName] = useState('');
  const [projectArea, setProjectArea] = useState(48);
  const [profitMargin, setProfitMargin] = useState(''); // 空字串表示未填寫，此時會預設用系統設定
  const [defaultProfitMargin, setDefaultProfitMargin] = useState(0); // 存入從系統抓下來的預設值
  const [managementFeeRate, setManagementFeeRate] = useState(0.30); // 項目管理費率%
  const [taxRate, setTaxRate] = useState(0.05);
  const [includeTax, setIncludeTax] = useState(false);
  const [availableWorkClasses, setAvailableWorkClasses] = useState([]);
  const [selectedWorkClasses, setSelectedWorkClasses] = useState(new Set());
  const [customWorkClass, setCustomWorkClass] = useState('');
  const [customWorkItems, setCustomWorkItems] = useState('');
  const [workClassDetails, setWorkClassDetails] = useState({});

  // 細項編輯
  const [editingWorkClass, setEditingWorkClass] = useState(null);
  const [editingItems, setEditingItems] = useState([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', quantity: '', unit: '式', price: '', margin: profitMargin });
  const [unitOptions, setUnitOptions] = useState(['式', '才', '尺', '坪', '組', '個', '樘', '車', '人', '捲', '戶', '片', '門', '處', '點']);
  const [draggedItemIdx, setDraggedItemIdx] = useState(null);
  const [dragEnabledIdx, setDragEnabledIdx] = useState(null);

  // 版本管理
  const [versions, setVersions] = useState([]);
  const [versionNotes, setVersionNotes] = useState('');
  const [selectedVersion, setSelectedVersion] = useState(null);

  // UI狀態
  const [loading, setLoading] = useState(false);
  const [appLoading, setAppLoading] = useState(true); // 用於初次載入設定檔
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  // 登入狀態
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needPassword, setNeedPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // ============ 初始化 - 從 Google Sheet 讀取工班與設定 ============
  useEffect(() => {
    const fetchWorkClasses = async () => {
      setLoading(true);
      try {
        // 呼叫 Google Apps Script API
        const res = await fetch(`${API_BASE}?action=getWorkClasses`, {
          method: 'GET',
          redirect: 'follow',
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'API 回傳失敗');

        const workClasses = json.data;

        setAvailableWorkClasses(workClasses);

        // 自動選中必選工班
        const required = new Set(
          workClasses.filter(w => w.必選).map(w => w.code)
        );
        setSelectedWorkClasses(required);

        // 初始化工班細項副本
        const details = {};
        workClasses.forEach(wc => {
          details[wc.code] = [...wc.細項];
        });
        setWorkClassDetails(details);

      } catch (err) {
        console.warn('API 讀取失敗，使用本地測試資料:', err.message);

        // Fallback：本地測試資料
        const mockData = [
          {
            code: 'DEMO_001', 名稱: '保護/拆除工程', 排序: 1, 必選: false,
            細項: [
              { 序號: 1, 名稱: '保護', 量: 1, 單位: '式', 工資: 2400, 單價: 8500 },
              { 序號: 2, 名稱: '垃圾搬運', 量: 2, 單位: '人', 工資: 2400, 單價: 3000 },
              { 序號: 3, 名稱: '廢棄物抽裝清運', 量: 2, 單位: '式', 工資: 14000, 單價: 14500 },
            ]
          },
          {
            code: 'WOOD_001', 名稱: '輕隔間及木作工程', 排序: 2, 必選: false,
            細項: [
              { 序號: 1, 名稱: '玄關隔間', 量: 5, 單位: '尺', 工資: 2700, 單價: 2500 },
              { 序號: 2, 名稱: '玄關隔間-層板木貼皮', 量: 2, 單位: '片', 工資: 3600, 單價: 3800 },
            ]
          },
          {
            code: 'PAINT_001', 名稱: '油漆工程', 排序: 6, 必選: false,
            細項: [
              { 序號: 1, 名稱: '全室牆面整平', 量: 48, 單位: '坪', 工資: 850, 單價: 1200 },
              { 序號: 2, 名稱: '全室牆面刷漆', 量: 48, 單位: '坪', 工資: 950, 單價: 600 },
            ]
          },
          {
            code: 'DESIGN_001', 名稱: '設計及透視圖項目', 排序: 11, 必選: true,
            細項: [
              { 序號: 1, 名稱: '設計費', 量: 15, 單位: '坪', 工資: 5000, 單價: 5000 },
            ]
          }
        ];

        setAvailableWorkClasses(mockData);
        const required = new Set(mockData.filter(w => w.必選).map(w => w.code));
        setSelectedWorkClasses(required);
        const details = {};
        mockData.forEach(wc => { details[wc.code] = [...wc.細項]; });
        setWorkClassDetails(details);
        setError('⚠️ 使用本地測試資料（API 未連線）');
        setTimeout(() => setError(''), 5000);
      } finally {
        setLoading(false);
      }
    };

    const fetchVersionHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}?action=getVersionHistory`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setVersions(json.data);
        }
      } catch (err) { }
    };

    const fetchConfig = async () => {
      try {
        // Step 1: 先知道需不需要密碼（密碼本身不會酒露）
        const checkRes = await fetch(`${API_BASE}?action=checkNeedPassword`);
        const checkJson = await checkRes.json();

        if (!checkJson.needPassword) {
          // 沒設密碼，直接放行
          setIsAuthenticated(true);
          setNeedPassword(false);
        } else {
          setNeedPassword(true);
          // 檢查 sessionStorage 是否已有有效 token
          const savedToken = sessionStorage.getItem('CheckupQuote_Auth');
          if (savedToken) {
            // 用 token 驗證永遠不需要再登入（简化：存在就透）
            setIsAuthenticated(true);
          }
        }

        // Step 2: 再去對公司設定（密碼已在後端過濾，不會回傳）
        const configRes = await fetch(`${API_BASE}?action=getCompanyConfig`);
        if (configRes.ok) {
          const json = await configRes.json();
          if (json.success && json.data) {
            // 抓取全域預設，若前台清空未填寫會採用這個值
            if (json.data.profit_margin) setDefaultProfitMargin(parseFloat(json.data.profit_margin));
            if (json.data.tax_rate) setTaxRate(parseFloat(json.data.tax_rate));
            if (json.data.management_fee_rate) setManagementFeeRate(parseFloat(json.data.management_fee_rate));
          }
        }
      } catch (e) {
        setIsAuthenticated(true); // 網路失敗不阻擋
      } finally {
        setAppLoading(false);
      }
    };

    const fetchUniqueUnits = async () => {
      try {
        const res = await fetch(`${API_BASE}?action=getUniqueUnits`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) setUnitOptions(json.data);
        }
      } catch (err) {
        console.warn('動態單位抓取失敗，使用預設值');
      }
    };

    fetchConfig();
    fetchWorkClasses();
    fetchVersionHistory();
    fetchUniqueUnits();

    // 檢查是否有未完成的草稿
    const draftStr = localStorage.getItem('CheckupQuote_Draft');
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        if (draft.projectName || (draft.selectedWorkClasses && draft.selectedWorkClasses.length > 0)) {
          setHasDraft(true);
        }
      } catch (e) { }
    }
  }, []);

  // ============ 本地自動儲存 (防斷線) ============
  useEffect(() => {
    // 只有當填寫了案名，或勾選了工班時，才開始自動儲存
    if (!projectName && selectedWorkClasses.size === 0) return;

    const draft = {
      projectName,
      projectArea,
      profitMargin,
      managementFeeRate,
      taxRate,
      includeTax,
      selectedWorkClasses: Array.from(selectedWorkClasses),
      workClassDetails,
      timestamp: new Date().getTime()
    };
    localStorage.setItem('CheckupQuote_Draft', JSON.stringify(draft));
  }, [projectName, projectArea, profitMargin, managementFeeRate, taxRate, includeTax, selectedWorkClasses, workClassDetails]);

  // ============ 操作草稿 ============
  const handleRestoreDraft = () => {
    try {
      const draftStr = localStorage.getItem('CheckupQuote_Draft');
      if (!draftStr) return;
      const draft = JSON.parse(draftStr);

      setProjectName(draft.projectName || '');
      setProjectArea(draft.projectArea || 48);
      setProfitMargin(draft.profitMargin !== undefined ? draft.profitMargin : '');
      setManagementFeeRate(draft.managementFeeRate || 0.30);
      setTaxRate(draft.taxRate || 0.05);
      setIncludeTax(draft.includeTax || false);
      setSelectedWorkClasses(new Set(draft.selectedWorkClasses || []));
      if (draft.workClassDetails) {
        setWorkClassDetails(draft.workClassDetails);
      }

      setHasDraft(false);
      setSuccess('✅ 成功恢復未完成的草稿！');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError('草稿恢復失敗');
      setTimeout(() => setError(''), 3000);
    }
  };

  // ============ 登入處理 ============
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}?action=login&password=${encodeURIComponent(passwordInput.trim())}`);
      const json = await res.json();
      if (json.success && json.token) {
        sessionStorage.setItem('CheckupQuote_Auth', json.token);
        setIsAuthenticated(true);
      } else {
        setError('密碼錯誤，請重新輸入');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError('網路連線失敗，請稍候再試');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleClearDraft = () => {
    localStorage.removeItem('CheckupQuote_Draft');
    setHasDraft(false);
  };

  // ============ 驗證自訂工班 ============
  const validateCustomWorkClass = () => {
    const errors = [];

    if (!customWorkClass.trim()) {
      errors.push('工班名稱不能為空');
    }
    if (customWorkClass.length > 50) {
      errors.push('工班名稱不超過50字');
    }
    if (/[\/\\*?"<>|]/.test(customWorkClass)) {
      errors.push('工班名稱含有不允許的特殊符號');
    }
    if (availableWorkClasses.some(w => w.名稱 === customWorkClass)) {
      errors.push('該工班名稱已存在');
    }

    if (!customWorkItems.trim()) {
      errors.push('至少需新增1個細項');
    }

    return errors;
  };

  // ============ 新增自訂工班 ============
  const handleAddCustomWorkClass = () => {
    const errors = validateCustomWorkClass();
    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }

    // 生成工班代碼
    const timestamp = Date.now();
    const code = `CUSTOM_${timestamp}`;

    // 解析細項（簡單CSV格式）
    const items = customWorkItems.split('\n')
      .filter(line => line.trim())
      .map((line, idx) => {
        const parts = line.split(',').map(p => p.trim());
        return {
          序號: idx + 1,
          名稱: parts[0],
          量: parseFloat(parts[1]) || 1,
          單位: parts[2] || '式',
          工資: parseFloat(parts[3]) || 0,
          單價: parseFloat(parts[4]) || 0
        };
      });

    const newWorkClass = {
      code,
      名稱: customWorkClass,
      排序: availableWorkClasses.length + 1,
      細項: items,
      是自訂: true
    };

    setAvailableWorkClasses([...availableWorkClasses, newWorkClass]);
    setSelectedWorkClasses(new Set([...selectedWorkClasses, code]));
    setWorkClassDetails({
      ...workClassDetails,
      [code]: items
    });

    // 上傳到 Google Sheet（異步）
    uploadCustomWorkClass(newWorkClass);

    // 重設表單
    setCustomWorkClass('');
    setCustomWorkItems('');
    setSuccess('自訂工班已新增！');
    setTimeout(() => setSuccess(''), 3000);
  };

  // ============ 上傳自訂工班到 Google Sheet ============
  const uploadCustomWorkClass = async (workClass) => {
    try {
      const response = await fetch(`${API_BASE}?action=addCustomWorkClass`, {
        method: 'POST',
        body: JSON.stringify(workClass)
      });
      console.log('自訂工班已記錄到 Google Sheet');
    } catch (err) {
      console.warn('Google Sheet 上傳失敗（離線模式）:', err);
    }
  };

  // ============ 編輯工班細項 ============
  const handleEditWorkClass = (code) => {
    setEditingWorkClass(code);
    setEditingItems([...workClassDetails[code]]);
  };

  const handleSaveWorkClass = (code) => {
    setWorkClassDetails({
      ...workClassDetails,
      [code]: editingItems
    });
    setEditingWorkClass(null);
    setSuccess('細項已保存！');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDeleteItem = (code, idx) => {
    const updated = editingItems.filter((_, i) => i !== idx);
    updated.forEach((item, i) => { item.序號 = i + 1; });
    setEditingItems(updated);
  };

  const handleAddNewItem = () => {
    if (!newItem.name.trim() || !newItem.quantity || !newItem.price) {
      setError('請填寫完整的新細項信息');
      return;
    }

    const item = {
      序號: editingItems.length + 1,
      名稱: newItem.name,
      量: parseFloat(newItem.quantity),
      單位: newItem.unit,
      工資: 0,
      單價: parseFloat(newItem.price)
    };

    setEditingItems([...editingItems, item]);
    setNewItem({ name: '', quantity: '', unit: '式', price: '', margin: profitMargin });
    setIsAddingItem(false);
    setSuccess('細項已新增！');
    setTimeout(() => setSuccess(''), 3000);
  };

  // ============ 計算報價 ============
  const calculateQuotation = () => {
    const items = [];
    let subtotal = 0;

    for (const [code, details] of Object.entries(workClassDetails)) {
      if (!selectedWorkClasses.has(code)) continue;

      const workClass = availableWorkClasses.find(w => w.code === code);
      const categoryItems = details.map(item => {
        const subPrice = item.量 * item.單價;
        subtotal += subPrice;
        return {
          ...item,
          複價: subPrice,
          工班: workClass.名稱
        };
      });

      items.push(...categoryItems);
    }

    const currentProfitMargin = profitMargin === '' ? defaultProfitMargin : parseFloat(profitMargin);
    const profitAmount = subtotal * currentProfitMargin;       // 材料利潤 = 工程費小計 * ％
    const afterMaterial = subtotal + profitAmount;      // 項目小計 = 工程費小計 + 材料利潤

    const managementFee = afterMaterial * managementFeeRate; // 監工管理費
    const subtotalWithProfit = afterMaterial + managementFee;
    const tax = subtotalWithProfit * taxRate;
    const total = subtotalWithProfit + tax;

    const breakdown = [
      { label: '工程費小計', value: subtotal },
      { label: '材料利潤 (' + (currentProfitMargin * 100).toFixed(0) + '%) ', value: profitAmount },
      { label: ' 項目小計', value: afterMaterial },
      { label: '管理監工費 (' + (managementFeeRate * 100).toFixed(0) + '%)', value: managementFee },
      { label: '稅前小計', value: subtotalWithProfit }
    ];

    if (includeTax) {
      breakdown.push({ label: '營業稅 (5%)', value: tax });
    }

    breakdown.push({ label: '合計', value: includeTax ? total : subtotalWithProfit });

    return {
      items,
      subtotal,
      profitAmount,
      afterMaterial,
      managementFeeRate,
      managementFee,
      subtotalWithProfit,
      tax,
      total: includeTax ? total : subtotalWithProfit,
      breakdown
    };
  };

  const quotation = step >= 3 ? calculateQuotation() : null;

  // ============ 生成 Excel 檔案 ============
  const handleGenerateExcel = async () => {
    if (!projectName.trim()) {
      setError('請輸入案件名稱');
      return;
    }

    setLoading(true);
    try {
      // 使用 XLSX.js 生成 Excel（需引入）
      const excelData = {
        projectName,
        projectArea,
        profitMargin: profitMargin === '' ? null : parseFloat(profitMargin),
        managementFeeRate,
        taxRate,
        quotation,
        timestamp: new Date().toLocaleString('zh-TW')
      };

      // 上傳到 Google Drive 並記錄版本
      const today = new Date();
      const dateStr = today.getFullYear().toString() +
        String(today.getMonth() + 1).padStart(2, '0') +
        String(today.getDate()).padStart(2, '0');
      const fileName = `${projectName}_${dateStr}.xlsx`;
      const fileId = await uploadToGoogleDrive(excelData, fileName);

      // 記錄版本歷史
      const versionRecord = {
        報價單ID: `QUOT_${Date.now()}`,
        案件名稱: projectName,
        版本號: `v${versions.length + 1}`,
        版本日期: new Date().toISOString().split('T')[0],
        修改時間: new Date().toLocaleTimeString('zh-TW'),
        修改項目摘要: versionNotes || '系統最新產出',
        Google_Drive檔案名稱: fileName,
        Google_Drive檔案ID: fileId,
        rawJson: JSON.stringify(excelData) // 將完整狀態打包存入 J 欄
      };

      const newVersions = [versionRecord, ...versions];
      setVersions(newVersions);

      await uploadVersionHistory(versionRecord);

      // 上傳成功，結案並清空草稿
      localStorage.removeItem('CheckupQuote_Draft');
      setHasDraft(false);

      setSuccess(`報價單已生成！文件: ${fileName}`);
      setVersionNotes('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('生成 Excel 失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadToGoogleDrive = async (data, fileName) => {
    try {
      const response = await fetch(`${API_BASE}?action=uploadExcel`, {
        method: 'POST',
        body: JSON.stringify({ data, fileName })
      });
      const result = await response.json();
      return result.fileId;
    } catch (err) {
      return `FILE_${Date.now()}`;
    }
  };

  const uploadVersionHistory = async (record) => {
    try {
      await fetch(`${API_BASE}?action=recordVersion`, {
        method: 'POST',
        body: JSON.stringify(record)
      });
    } catch (err) {
      console.warn('版本記錄上傳失敗', err);
    }
  };

  // ============ 載入歷史版本 (疊代編輯) ============
  const handleEditVersion = (versionData) => {
    try {
      if (!versionData.rawJson) {
        throw new Error("此版本沒有原始資料紀錄，無法還原");
      }
      const raw = JSON.parse(versionData.rawJson);

      // 還原狀態
      setProjectName(raw.projectName || versionData.案件名稱 || '');
      setProjectArea(raw.projectArea || 48);
      setProfitMargin(raw.profitMargin || 0);
      setManagementFeeRate(raw.managementFeeRate || 0.30);
      setTaxRate(raw.taxRate || 0.05);

      if (raw.quotation && raw.quotation.breakdown) {
        setIncludeTax(raw.quotation.breakdown.some(b => b.label.includes('營業稅')));
      }

      if (raw.quotation && raw.quotation.items) {
        const selected = new Set();
        const details = { ...workClassDetails }; // 保留原本取得的全部，再覆寫勾選的

        // 整理 raw 裡面的 items 回到對應的工班陣列
        raw.quotation.items.forEach(item => {
          // 在這個迴圈找出工班的 code
          const wc = availableWorkClasses.find(w => w.名稱 === item.工班);
          if (wc) {
            selected.add(wc.code);
            if (!details[wc.code] || !Array.isArray(details[wc.code])) {
              details[wc.code] = [];
            }
            // 避免疊加重複寫入，我們如果是第一個碰到的工班元素就清空舊的副本
            // 但為求簡單，就直接把這版本裡有出現的 items 推入
            // 改進：先把 selected 的 details 清空
          }
        });

        // 重構 details
        selected.forEach(code => {
          details[code] = [];
        });

        raw.quotation.items.forEach((item, index) => {
          const wc = availableWorkClasses.find(w => w.名稱 === item.工班);
          if (wc) {
            details[wc.code].push({
              序號: details[wc.code].length + 1,
              名稱: item.名稱,
              量: item.量,
              單位: item.單位,
              工資: item.工資,
              單價: item.單價
            });
          }
        });

        setSelectedWorkClasses(selected);
        setWorkClassDetails(details);
      }

      setStep(1); // 跳轉回步驟一
      setSuccess("成功載入版本：「" + versionData.版本號 + "」，可以開始編輯！");
      setTimeout(() => setSuccess(""), 3000);

    } catch (e) {
      setError("還原失敗：" + e.message);
      setTimeout(() => setError(""), 3000);
    }
  };

  // ============ 排序邏輯 ============
  const handleMoveWorkClass = (code, direction) => {
    const list = Array.from(selectedWorkClasses);
    const idx = list.indexOf(code);
    if (direction === 'up' && idx > 0) {
      const temp = list[idx - 1];
      list[idx - 1] = list[idx];
      list[idx] = temp;
    } else if (direction === 'down' && idx < list.length - 1) {
      const temp = list[idx + 1];
      list[idx + 1] = list[idx];
      list[idx] = temp;
    }
    setSelectedWorkClasses(new Set(list));
  };

  const handleMoveItem = (idx, direction) => {
    const updated = [...editingItems];
    if (direction === 'up' && idx > 0) {
      const temp = updated[idx - 1];
      updated[idx - 1] = updated[idx];
      updated[idx] = temp;
    } else if (direction === 'down' && idx < updated.length - 1) {
      const temp = updated[idx + 1];
      updated[idx + 1] = updated[idx];
      updated[idx] = temp;
    }
    updated.forEach((item, i) => { item.序號 = i + 1; });
    setEditingItems(updated);
  };

  // ============ UI 元件 ============

  // 步驟 1: 工班選擇
  const renderStep1 = () => {
    // 找出所有獨立的專案（只留每案最新一筆）
    const uniqueProjects = [];
    const handledNames = new Set();

    versions.forEach(v => {
      if (v.案件名稱 && v.rawJson && !handledNames.has(v.案件名稱)) {
        handledNames.add(v.案件名稱);
        uniqueProjects.push(v);
      }
    });

    return (
      <div className="space-y-6">

        {/* 斷線草稿救援區塊 */}
        {hasDraft && (
          <div className="rounded-xl p-4 border flex flex-col md:flex-row items-center justify-between shadow-sm" style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
            <div className="flex items-center gap-3 mb-3 md:mb-0">
              <RotateCcw className="text-yellow-600 flex-shrink-0" size={24} />
              <div>
                <h4 className="text-sm font-bold text-yellow-800">發現未完成的草稿</h4>
                <p className="text-xs text-yellow-700 font-medium">我們為您保留了上次編輯到一半的資料，以防網路斷線或不小心關閉網頁。</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleClearDraft} className="px-4 py-2 border border-yellow-400 text-xs font-semibold text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition">放棄並清空</button>
              <button onClick={handleRestoreDraft} className="px-4 py-2 text-xs font-bold text-white rounded-lg bg-yellow-600 hover:bg-yellow-700 shadow-sm transition">還原草稿</button>
            </div>
          </div>
        )}

        {/* 基本信息 */}
        <div className="rounded-xl p-6 border" style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #e0edf8 100%)', borderColor: '#7fb4e0' }}>
          <div className="flex justify-between flex-wrap items-center mb-4">
            <div>
              <h3 className="text-base font-bold mb-1" style={{ color: '#002b5c' }}>基本信息</h3>
              <p className="text-xs" style={{ color: '#005e99' }}>請填寫以下欄位，系統將自動計算報價</p>
            </div>

            {uniqueProjects.length > 0 && (
              <div className="mt-2 md:mt-0">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      if (window.confirm("載入專案將覆蓋目前填寫的狀態，確定要載入嗎？")) {
                        const v = uniqueProjects.find(p => p.案件名稱 === e.target.value);
                        if (v) handleEditVersion(v);
                      }
                      e.target.value = ""; // 觸發後重置回預設選項
                    }
                  }}
                  className="px-3 py-1.5 border-2 rounded-lg text-sm bg-white font-bold cursor-pointer transition shadow-sm outline-none"
                  style={{ borderColor: '#007bb8', color: '#005e99' }}
                >
                  <option value="">📂 從雲端載入既有專案...</option>
                  {uniqueProjects.map(p => (
                    <option key={p.案件名稱} value={p.案件名稱}>
                      {p.案件名稱} (最新版 {p.版本號})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#003f7f' }}>
                案件名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="例：地址/姓氏/公館商空"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition"
                style={{ borderColor: '#7fb4e0', background: 'white' }}
                onFocus={e => e.target.style.borderColor = '#007bb8'}
                onBlur={e => e.target.style.borderColor = '#7fb4e0'}
              />
              <p className="text-xs mt-1" style={{ color: '#4a9cd4' }}>輸入客戶名稱或案件代稱</p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#003f7f' }}>
                室內坪數 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="48"
                  value={projectArea}
                  onChange={(e) => setProjectArea(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition pr-10"
                  style={{ borderColor: '#7fb4e0', background: 'white' }}
                  onFocus={e => e.target.style.borderColor = '#007bb8'}
                  onBlur={e => e.target.style.borderColor = '#7fb4e0'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: '#005e99' }}>坪</span>
              </div>
              <p className="text-xs mt-1" style={{ color: '#4a9cd4' }}>室內實際面積（不含公設）</p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#003f7f' }}>
                材料利潤率
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0"
                  value={profitMargin}
                  step="0.01"
                  min="0"
                  max="1"
                  onChange={(e) => setProfitMargin(e.target.value === '' ? '' : e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition pr-10"
                  style={{ borderColor: '#7fb4e0', background: 'white' }}
                  onFocus={e => e.target.style.borderColor = '#007bb8'}
                  onBlur={e => e.target.style.borderColor = '#7fb4e0'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: '#005e99' }}>
                  {((profitMargin === '' ? defaultProfitMargin : parseFloat(profitMargin)) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="includeTax"
              checked={includeTax}
              onChange={(e) => setIncludeTax(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="includeTax" className="text-sm font-semibold" style={{ color: '#003f7f' }}>
              顯示 5% 營業稅
            </label>
          </div>
        </div>

        {/* 工班勾選 */}
        <div className="rounded-xl p-6 border border-gray-100 bg-white shadow-sm mt-6">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="text-base font-bold mb-1" style={{ color: '#002b5c' }}>選擇工班</h3>
              <p className="text-xs" style={{ color: '#005e99' }}>勾選本次報價涵蓋的工班，設計費為必選項目</p>
            </div>
            {/* 管理費設定 */}
            <div className="w-32">
              <label className="block text-xs font-semibold mb-1" style={{ color: '#003f7f' }}>
                監工管理費率
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.30"
                  value={managementFeeRate}
                  step="0.01"
                  min="0"
                  max="1"
                  onChange={(e) => setManagementFeeRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none pr-10"
                  style={{ borderColor: '#007bb8' }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: '#005e99' }}>
                  {(managementFeeRate * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableWorkClasses.map(wc => (
              <label
                key={wc.code}
                className="flex items-center p-3.5 border-2 rounded-xl cursor-pointer transition-all"
                style={{
                  borderColor: selectedWorkClasses.has(wc.code) ? '#007bb8' : '#e2e8f0',
                  background: selectedWorkClasses.has(wc.code) ? '#f0f7ff' : 'white',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedWorkClasses.has(wc.code)}
                  onChange={(e) => {
                    if (!wc.必選) {
                      const updated = new Set(selectedWorkClasses);
                      if (e.target.checked) updated.add(wc.code);
                      else updated.delete(wc.code);
                      setSelectedWorkClasses(updated);
                    }
                  }}
                  disabled={wc.必選}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#007bb8' }}
                />
                <span className="ml-3 text-sm font-medium" style={{ color: '#002b5c' }}>{wc.名稱}</span>
                {wc.必選 && (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#005e99' }}>必選</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* 新增自訂工班 */}
        <div className="rounded-xl p-6 border-2" style={{ borderColor: '#4a9cd4', background: 'linear-gradient(135deg, #f5faff 0%, #eaf4fc 100%)' }}>
          <h3 className="text-base font-bold mb-1 flex items-center gap-2" style={{ color: '#002b5c' }}>
            <Plus size={18} />
            新增自訂工班
          </h3>
          <p className="text-xs mb-4" style={{ color: '#005e99' }}>自訂工班將自動保存為範本，下次可直接選用</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#003f7f' }}>工班名稱</label>
              <input
                type="text"
                placeholder="例：智能家居控制系統安裝"
                value={customWorkClass}
                onChange={(e) => setCustomWorkClass(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none"
                style={{ borderColor: '#4a9cd4', background: 'white' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#003f7f' }}>細項列表</label>
              <p className="text-xs mb-2" style={{ color: '#2490bf' }}>格式：細項名稱, 數量, 單位, 工資, 單價（每行一個）</p>
              <textarea
                placeholder={`風管安裝, 20, 米, 300, 500\nAI主機安裝, 1, 式, 5000, 15000`}
                value={customWorkItems}
                onChange={(e) => setCustomWorkItems(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none font-mono"
                style={{ borderColor: '#4a9cd4', background: 'white' }}
              />
            </div>
            <button
              onClick={handleAddCustomWorkClass}
              className="w-full text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 hover:opacity-90"
              style={{ background: 'linear-gradient(90deg, #007bb8, #005e99)' }}
            >
              <Plus size={16} />
              新增自訂工班（自動保存範本）
            </button>
          </div>
        </div>

        {/* 訊息提示 */}
        {error && (
          <div className="rounded-lg p-4 flex gap-3 border" style={{ background: '#fff8f8', borderColor: '#fca5a5' }}>
            <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-lg p-4 flex gap-3 border" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
            <CheckCircle className="text-green-600 flex-shrink-0" size={18} />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* 下一步 */}
        <button
          onClick={() => { setError(''); setStep(2); }}
          className="w-full text-white font-bold py-3.5 rounded-xl transition hover:opacity-90 shadow-lg"
          style={{ background: 'linear-gradient(90deg, #007bb8 0%, #005e99 100%)' }}
        >
          下一步：編輯細項 →
        </button>
      </div>
    );
  };

  // 步驟 2: 細項編輯
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setStep(1)}
          className="px-4 py-2 border-2 rounded-lg text-sm font-semibold transition hover:opacity-80"
          style={{ borderColor: '#007bb8', color: '#007bb8' }}
        >
          ← 上一步
        </button>
        <button
          onClick={() => { setError(''); setStep(3); }}
          className="flex-1 text-white font-bold py-2 rounded-lg transition hover:opacity-90"
          style={{ background: 'linear-gradient(90deg, #007bb8, #005e99)' }}
        >
          下一步：預覽確認 →
        </button>
      </div>

      {selectedWorkClasses.size === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>請先選擇至少一個工班</p>
        </div>
      ) : (
        Array.from(selectedWorkClasses).map(code => {
          const workClass = availableWorkClasses.find(w => w.code === code);
          const isEditing = editingWorkClass === code;
          const items = isEditing ? editingItems : workClassDetails[code];

          return (
            <div key={code} className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#4a9cd4' }}>
              <div className="px-6 py-4 flex justify-between items-center" style={{ background: 'linear-gradient(90deg, #002b5c, #005e99)' }}>
                <h3 className="font-bold text-base" style={{ color: '#a7c6ed' }}>{workClass.名稱}</h3>
                {!isEditing && (
                  <div className="flex gap-2">
                    <button onClick={() => handleMoveWorkClass(code, 'up')} className="text-white hover:text-blue-300 p-1 transition" title="上移工班"><ArrowUp size={16} /></button>
                    <button onClick={() => handleMoveWorkClass(code, 'down')} className="text-white hover:text-blue-300 p-1 transition" title="下移工班"><ArrowDown size={16} /></button>
                  </div>
                )}
              </div>

              <div className="p-6">
                {/* 細項表格 */}
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead style={{ background: '#f0f7ff' }}>
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: '#003f7f' }}>序號</th>
                        <th className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: '#003f7f' }}>細項名稱</th>
                        <th className="px-4 py-2.5 text-right text-xs font-bold" style={{ color: '#003f7f' }}>數量</th>
                        <th className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: '#003f7f' }}>單位</th>
                        <th className="px-4 py-2.5 text-right text-xs font-bold" style={{ color: '#003f7f' }}>單價</th>
                        <th className="px-4 py-2.5 text-right text-xs font-bold" style={{ color: '#003f7f' }}>複價</th>
                        {isEditing && <th className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: '#003f7f' }}>操作</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`border-t hover:bg-gray-50 transition-colors ${draggedItemIdx === idx ? 'bg-blue-50 opacity-50' : ''}`}
                          draggable={dragEnabledIdx === idx}
                          onDragStart={(e) => {
                            setDraggedItemIdx(idx);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (draggedItemIdx === null || draggedItemIdx === idx) return;
                            const updated = [...editingItems];
                            const draggedItem = updated[draggedItemIdx];
                            updated.splice(draggedItemIdx, 1);
                            updated.splice(idx, 0, draggedItem);
                            updated.forEach((item, i) => { item.序號 = i + 1; });
                            setDraggedItemIdx(idx);
                            setEditingItems(updated);
                          }}
                          onDragEnd={() => {
                            setDraggedItemIdx(null);
                            setDragEnabledIdx(null);
                          }}
                        >
                          <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <div
                                  className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-gray-200 transition"
                                  onMouseDown={() => setDragEnabledIdx(idx)}
                                  onMouseUp={() => setDragEnabledIdx(null)}
                                  onMouseLeave={() => setDragEnabledIdx(null)}
                                  title="長按拖動"
                                >
                                  <Menu size={16} />
                                </div>
                                <span className="w-4 text-center inline-block">{item.序號}</span>
                              </div>
                            ) : (
                              item.序號
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.名稱}
                                onChange={(e) => {
                                  const updated = [...editingItems];
                                  updated[idx].名稱 = e.target.value;
                                  setEditingItems(updated);
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              item.名稱
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                value={item.量}
                                onChange={(e) => {
                                  const updated = [...editingItems];
                                  updated[idx].量 = parseFloat(e.target.value) || 0;
                                  setEditingItems(updated);
                                }}
                                className="w-full text-right px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              item.量
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {isEditing ? (
                              <select
                                value={item.單位}
                                onChange={(e) => {
                                  const updated = [...editingItems];
                                  updated[idx].單位 = e.target.value;
                                  setEditingItems(updated);
                                }}
                                className="w-full text-center px-1 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium text-sm"
                              >
                                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                {!unitOptions.includes(item.單位) && <option value={item.單位}>{item.單位}</option>}
                              </select>
                            ) : (
                              <span className="font-medium">{item.單位}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                value={item.單價}
                                onChange={(e) => {
                                  const updated = [...editingItems];
                                  updated[idx].單價 = parseFloat(e.target.value) || 0;
                                  setEditingItems(updated);
                                }}
                                className="w-full text-right px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              `$${item.單價.toLocaleString()}`
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">
                            ${(item.量 * item.單價).toLocaleString()}
                          </td>
                          {isEditing && (
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => handleDeleteItem(code, idx)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 新增細項表單 */}
                {isEditing && isAddingItem && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <input
                        type="text"
                        placeholder="細項名稱"
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="number"
                        placeholder="數量"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <select
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input
                        type="number"
                        placeholder="單價"
                        value={newItem.price}
                        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <button
                        onClick={handleAddNewItem}
                        className="bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                      >
                        新增
                      </button>
                    </div>
                  </div>
                )}

                {/* 編輯按鈕組 */}
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => handleSaveWorkClass(code)}
                        className="flex-1 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2 hover:opacity-90"
                        style={{ background: 'linear-gradient(90deg, #2490bf, #007bb8)' }}
                      >
                        <Save size={16} />
                        保存細項
                      </button>
                      <button
                        onClick={() => setIsAddingItem(!isAddingItem)}
                        className="flex-1 font-bold py-2 rounded-lg transition flex items-center justify-center gap-2 border-2 hover:opacity-80"
                        style={{ borderColor: '#007bb8', color: '#007bb8' }}
                      >
                        <Plus size={16} />
                        {isAddingItem ? '取消' : '新增細項'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleEditWorkClass(code)}
                      className="w-full font-bold py-2 rounded-lg border-2 transition hover:opacity-80"
                      style={{ borderColor: '#007bb8', color: '#007bb8' }}
                    >
                      編輯細項
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // 步驟 3: 預覽和確認
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setStep(2)}
          className="px-4 py-2 border-2 rounded-lg text-sm font-semibold transition hover:opacity-80"
          style={{ borderColor: '#007bb8', color: '#007bb8' }}
        >
          ← 編輯細項
        </button>
        <button
          onClick={() => setStep(4)}
          className="flex-1 text-white font-bold py-2 rounded-lg transition hover:opacity-90"
          style={{ background: 'linear-gradient(90deg, #007bb8, #005e99)' }}
        >
          查看版本記錄 →
        </button>
      </div>

      {quotation && (
        <div className="space-y-4">
          {/* 案件信息 */}
          <div className="rounded-xl p-5 border-2" style={{ background: 'linear-gradient(135deg, #f0f7ff, #e0edf8)', borderColor: '#7fb4e0' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#002b5c' }}>案件信息</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-xs" style={{ color: '#005e99' }}>案件名稱</span><p className="font-bold mt-0.5" style={{ color: '#001a3e' }}>{projectName}</p></div>
              <div><span className="text-xs" style={{ color: '#005e99' }}>坪數</span><p className="font-bold mt-0.5" style={{ color: '#001a3e' }}>{projectArea} 坪</p></div>
              <div><span className="text-xs" style={{ color: '#005e99' }}>利潤加成</span><p className="font-bold mt-0.5" style={{ color: '#001a3e' }}>{(profitMargin * 100).toFixed(0)}%</p></div>
              <div><span className="text-xs" style={{ color: '#005e99' }}>稅率</span><p className="font-bold mt-0.5" style={{ color: '#001a3e' }}>{(taxRate * 100).toFixed(0)}%</p></div>
            </div>
          </div>

          {/* 細項總覽 */}
          <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: '#7fb4e0' }}>
            <div className="px-6 py-3 font-bold text-sm" style={{ background: '#002b5c', color: '#a7c6ed' }}>
              細項預覽
            </div>
            <div className="p-6">
              {quotation.items.length === 0 ? (
                <p className="text-gray-500 text-center py-4">無細項</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {quotation.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200">
                      <div>
                        <p className="font-semibold text-gray-800">{item.名稱}</p>
                        <p className="text-xs text-gray-500">{item.工班}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-700">{item.量} {item.單位} × ${item.單價.toLocaleString()}</p>
                        <p className="font-semibold text-gray-900">${item.複價.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 費用計算 */}
          <div className="rounded-xl p-6 border-2" style={{ background: 'linear-gradient(135deg, #f0f7ff, #e0edf8)', borderColor: '#4a9cd4' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#002b5c' }}>費用計算明細</h3>
            <div className="space-y-2">
              {quotation.breakdown.map((line, idx) => {
                const isTotal = line.label === '合計';
                const isSubtotal = ['小計', '稅前小計'].includes(line.label);
                return (
                  <div
                    key={idx}
                    className={`flex justify-between ${isTotal
                      ? 'text-base font-bold pt-3 mt-1 border-t-2'
                      : isSubtotal
                        ? 'text-sm font-semibold pt-2 border-t'
                        : 'text-sm'
                      }`}
                    style={{
                      color: isTotal ? '#001a3e' : isSubtotal ? '#002b5c' : '#005e99',
                      borderColor: isTotal ? '#2490bf' : '#7fb4e0',
                    }}
                  >
                    <span>{line.label}</span>
                    <span className={isTotal ? 'text-lg' : ''}>
                      ${line.value.toLocaleString('zh-TW', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 版本備註 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">版本備註（可選）</label>
            <textarea
              value={versionNotes}
              onChange={(e) => setVersionNotes(e.target.value)}
              placeholder="如: 按客戶要求調整木作工程、新增窗簾規格..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {/* 生成按鈕 */}
          <button
            onClick={handleGenerateExcel}
            disabled={loading || !projectName.trim()}
            className="w-full text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg"
            style={{
              background: loading || !projectName.trim()
                ? '#94a3b8'
                : 'linear-gradient(90deg, #007bb8 0%, #005e99 100%)',
              opacity: loading || !projectName.trim() ? 0.6 : 1,
            }}
          >
            {loading ? (
              <>處理中...</>
            ) : (
              <>
                <Download size={20} />
                製作/上傳估價單
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  // 步驟 4: 版本記錄
  const DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/1X6I8Yg1QHWeoKW6ocoxzy8cOwb1U2rgs`;

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="flex gap-3 mb-4 items-center">
        <button
          onClick={() => setStep(3)}
          className="px-4 py-2 border-2 rounded-lg text-sm font-semibold transition hover:opacity-80"
          style={{ borderColor: '#007bb8', color: '#007bb8' }}
        >
          ← 返回
        </button>
        <a
          href={DRIVE_FOLDER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-2 text-white text-sm font-bold px-4 py-2 rounded-lg transition hover:opacity-90"
          style={{ background: 'linear-gradient(90deg, #007bb8, #005e99)' }}
        >
          <svg width="16" height="16" viewBox="0 0 87.3 78" fill="currentColor">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
          </svg>
          在 Google Drive 中開啟
        </a>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
          <p>目前沒有版本記錄</p>
          <p className="text-sm mt-1 text-gray-400">回到步驟 3 製作估價單後，記錄會出現在這裡</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v, idx) => (
            <div
              key={idx}
              className="rounded-xl border-2 p-4 transition hover:shadow-md"
              style={{ borderColor: '#7fb4e0', background: 'linear-gradient(135deg, #f8fbff, #f0f7ff)' }}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm flex items-center gap-2" style={{ color: '#002b5c' }}>
                    <Calendar size={15} style={{ color: '#007bb8' }} />
                    {v.案件名稱}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#005e99' }}>
                    {v.版本號} · {v.版本日期} {v.修改時間}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#4a9cd4' }}>{v.修改項目摘要}</p>
                </div>
                <div className="flex gap-2">
                  {v.Google_Drive檔案ID && (
                    <a
                      href={`https://drive.google.com/file/d/${v.Google_Drive檔案ID}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                      style={{ background: '#007bb8' }}
                      title="開啟檔案"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  {v.rawJson && (
                    <button
                      onClick={() => handleEditVersion(v)}
                      className="text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition hover:opacity-80"
                      style={{ background: '#005e99' }}
                      title="載入此版本進行編輯"
                    >
                      <RotateCcw size={14} />
                      編輯
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );


  // ============ 登入畫面 ============
  if (appLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-blue-800 font-bold tracking-wider">系統載入中...</p>
      </div>
    );
  }

  if (!isAuthenticated && needPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #001a3e 0%, #003f7f 100%)' }}>
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border-t-4 border-blue-500">
          <div className="mx-auto bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Lock size={32} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">系統已鎖定</h2>
          <p className="text-sm text-gray-500 mb-6">請輸入密碼以存取報價單系統</p>

          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border-2 text-center text-lg tracking-wider mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
            placeholder="請輸入密碼"
            autoFocus
            disabled={loginLoading}
          />

          {error && <p className="text-red-500 text-sm mb-4 font-bold animate-pulse">{error}</p>}

          <button
            type="submit"
            disabled={loginLoading || !passwordInput}
            className="w-full text-white font-bold py-3 rounded-lg shadow-md transition hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(90deg, #007bb8, #005e99)' }}
          >
            {loginLoading ? '驗證中...' : '登入系統'}
          </button>
        </form>
      </div>
    );
  }


  // ============ 主渲染 ============
  return (
    <div className="min-h-screen p-0" style={{ background: 'linear-gradient(160deg, #001a3e 0%, #003f7f 40%, #e8f2fb 100%)' }}>
      {/* 頂部 Header */}
      <div style={{ background: 'linear-gradient(90deg, #001a3e 0%, #002b5c 60%, #003f7f 100%)' }} className="px-8 py-5 shadow-xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">三今設計 報價單系統</h1>
            <p className="text-brand-100 text-sm mt-0.5">智能化報價單生成與版本管理</p>
          </div>
          <img
            src="https://sanjindesign.com/wp-content/uploads/2026/01/SanjindesignLOGOfull.svg"
            alt="Logo"
            className="h-10 w-auto"
            style={{ filter: 'brightness(0) invert(1) opacity(0.9)' }}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 步驟指示器 */}
        <div className="flex items-center justify-between mb-8 px-2">
          {[
            { num: 1, label: '選擇工班' },
            { num: 2, label: '編輯細項' },
            { num: 3, label: '預覽確認' },
            { num: 4, label: '版本記錄' }
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <button
                onClick={() => s.num <= step && setStep(s.num)}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-md ${step === s.num
                  ? 'text-white scale-110'
                  : step > s.num
                    ? 'text-white'
                    : 'text-brand-300'
                  }`}
                style={{
                  background: step === s.num ? '#007bb8' : step > s.num ? '#2490bf' : 'rgba(255,255,255,0.15)',
                  border: step === s.num ? '2px solid #a7c6ed' : step > s.num ? '2px solid #4a9cd4' : '2px solid rgba(167,198,237,0.3)',
                }}
              >
                {step > s.num ? '✓' : s.num}
              </button>
              <span className={`ml-2 text-sm font-semibold ${step >= s.num ? 'text-white' : 'text-brand-100 opacity-60'
                }`}>
                {s.label}
              </span>
              {idx < 3 && (
                <div
                  className="w-10 h-0.5 mx-3"
                  style={{ background: step > s.num ? '#4a9cd4' : 'rgba(167,198,237,0.25)' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* 內容區 */}
        <div className="bg-white rounded-2xl shadow-2xl p-8" style={{ boxShadow: '0 25px 60px rgba(0,26,62,0.3)' }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* 底部提示 */}
        <div className="mt-6 text-center text-sm text-brand-100 opacity-70">
          <p>💡 所有報價單自動保存到 Google Drive，可隨時查閱版本歷史</p>
        </div>
      </div>
    </div>
  );
};

export default QuotationSystem;
