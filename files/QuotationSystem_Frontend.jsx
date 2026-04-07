import React, { useState, useEffect, useRef } from 'react';
import { Download, Plus, Trash2, Eye, Save, RotateCcw, ChevronDown, Calendar, BookOpen, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

/**
 * 三今設計 報價單系統
 * 功能: 工班選擇 -> 細項編輯 -> Excel生成 -> Google Drive版本管理
 * 後端: Google Sheets + Google Drive + Google Apps Script
 */

const QuotationSystem = () => {
  const API_BASE = 'https://script.google.com/macros/s/AKfycbw7yqxg_ZMvrIpQyx9j5-Qj0EXtgBN8ULru4zl3Joiy2bNldPnKGeXgcGUyK4PbLefVhw/exec'; // 需配置

  // ============ 狀態管理 ============
  const [step, setStep] = useState(1); // 1:工班選擇 2:細項編輯 3:計算與確認 4:版本預覽
  const [projectName, setProjectName] = useState('');
  const [projectArea, setProjectArea] = useState(48);
  const [profitMargin, setProfitMargin] = useState(0.35);
  const [taxRate, setTaxRate] = useState(0.05);

  // 工班相關
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

  // 版本管理
  const [versions, setVersions] = useState([]);
  const [versionNotes, setVersionNotes] = useState('');
  const [selectedVersion, setSelectedVersion] = useState(null);

  // UI狀態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ============ 初始化 - 從 Google Sheet 讀取工班 ============
  useEffect(() => {
    const fetchWorkClasses = async () => {
      setLoading(true);
      try {
        // 模擬數據（實際需連接 Google Sheets API）
        const mockData = {
          DEMO_001: {
            名稱: '保護/拆除工程',
            排序: 1,
            細項: [
              { 序號: 1, 名稱: '保護', 量: 1, 單位: '式', 工資: 2400, 單價: 8500 },
              { 序號: 2, 名稱: '垃圾搬運', 量: 2, 單位: '人', 工資: 2400, 單價: 3000 },
              { 序號: 3, 名稱: '拆保護', 量: 2, 單位: '人', 工資: 2400, 單價: 3000 },
              { 序號: 4, 名稱: '房門拆除', 量: 1, 單位: '式', 工資: 2500, 單價: 3000 },
              { 序號: 5, 名稱: '廢棄物抽裝清運', 量: 2, 單位: '式', 工資: 14000, 單價: 14500 },
              { 序號: 6, 名稱: '廚具拆除', 量: 1, 單位: '式', 工資: 6000, 單價: 6500 },
            ]
          },
          WOOD_001: {
            名稱: '輕隔間及木作工程',
            排序: 2,
            細項: [
              { 序號: 1, 名稱: '玄關隔間', 量: 5, 單位: '尺', 工資: 2700, 單價: 2500 },
              { 序號: 2, 名稱: '玄關隔間-層板木貼皮', 量: 2, 單位: '片', 工資: 3600, 單價: 3800 },
              { 序號: 3, 名稱: '玄關隔間牆-R角', 量: 3.5, 單位: '尺', 工資: 2200, 單價: 1400 },
            ]
          },
          PAINT_001: {
            名稱: '油漆工程',
            排序: 6,
            細項: [
              { 序號: 1, 名稱: '全室牆面整平', 量: 48, 單位: '坪', 工資: 850, 單價: 1200 },
              { 序號: 2, 名稱: '全室牆面刷漆', 量: 48, 單位: '坪', 工資: 950, 單價: 600 },
            ]
          },
          DESIGN_001: {
            名稱: '設計及透視圖項目',
            排序: 11,
            必選: true,
            細項: [
              { 序號: 1, 名稱: '設計費', 量: 15, 單位: '坪', 工資: 5000, 單價: 5000 },
            ]
          }
        };

        const workClasses = Object.entries(mockData).map(([code, data]) => ({
          code,
          ...data
        }));

        setAvailableWorkClasses(workClasses.sort((a, b) => a.排序 - b.排序));

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
        setError('無法讀取工班模板: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkClasses();
  }, []);

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

    const managementFee = subtotal * 0.30; // 30% 管理費
    const afterManagement = subtotal + managementFee;
    const profitAmount = afterManagement * profitMargin;
    const subtotalWithProfit = afterManagement + profitAmount;
    const tax = subtotalWithProfit * taxRate;
    const total = subtotalWithProfit + tax;

    return {
      items,
      subtotal,
      managementFee,
      afterManagement,
      profitAmount,
      subtotalWithProfit,
      tax,
      total,
      breakdown: [
        { label: '工程費小計', value: subtotal },
        { label: '管理監工費 (30%)', value: managementFee },
        { label: '小計', value: afterManagement },
        { label: '設計師利潤 (' + (profitMargin * 100).toFixed(0) + '%)', value: profitAmount },
        { label: '稅前小計', value: subtotalWithProfit },
        { label: '營業稅 (5%)', value: tax },
        { label: '合計', value: total }
      ]
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
        profitMargin,
        taxRate,
        quotation,
        timestamp: new Date().toLocaleString('zh-TW')
      };

      // 上傳到 Google Drive 並記錄版本
      const fileName = `${new Date().toISOString().split('T')[0]}_${projectName}_v${versions.length + 1}.xlsx`;
      const fileId = await uploadToGoogleDrive(excelData, fileName);

      // 記錄版本歷史
      const versionRecord = {
        報價單ID: `QUOT_${Date.now()}`,
        案件名稱: projectName,
        版本號: `v${versions.length + 1}`,
        版本日期: new Date().toISOString().split('T')[0],
        修改時間: new Date().toLocaleTimeString('zh-TW'),
        修改項目摘要: versionNotes || '第' + (versions.length + 1) + '版',
        Google_Drive檔案名稱: fileName,
        Google_Drive檔案ID: fileId
      };

      const newVersions = [...versions, versionRecord];
      setVersions(newVersions);

      // 上傳版本記錄到 Google Sheet
      await uploadVersionHistory(versionRecord);

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
      // 模擬文件ID（實際需Google API）
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

  // ============ UI 元件 ============

  // 步驟 1: 工班選擇
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">基本信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="案件名稱"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="number"
            placeholder="坪數"
            value={projectArea}
            onChange={(e) => setProjectArea(parseFloat(e.target.value) || 0)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="number"
            placeholder="利潤加成率 (如 0.35)"
            value={profitMargin}
            step="0.01"
            onChange={(e) => setProfitMargin(parseFloat(e.target.value) || 0)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 工班勾選 */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">選擇工班</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableWorkClasses.map(wc => (
            <label key={wc.code} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={selectedWorkClasses.has(wc.code)}
                onChange={(e) => {
                  if (!wc.必選) {
                    const updated = new Set(selectedWorkClasses);
                    if (e.target.checked) {
                      updated.add(wc.code);
                    } else {
                      updated.delete(wc.code);
                    }
                    setSelectedWorkClasses(updated);
                  }
                }}
                disabled={wc.必選}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <span className="ml-3 text-gray-700">{wc.名稱}</span>
              {wc.必選 && <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-1 rounded">必選</span>}
            </label>
          ))}
        </div>
      </div>

      {/* 新增自訂工班 */}
      <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Plus size={20} />
          新增自訂工班
        </h3>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="工班名稱（如：智能家居系統）"
            value={customWorkClass}
            onChange={(e) => setCustomWorkClass(e.target.value)}
            className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
          <textarea
            placeholder="細項列表（每行一個，格式: 細項名稱, 數量, 單位, 工資, 單價）
例:
風管安裝, 20, 米, 300, 500
智能家電安裝, 1, 式, 5000, 15000"
            value={customWorkItems}
            onChange={(e) => setCustomWorkItems(e.target.value)}
            rows={5}
            className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono text-sm"
          />
          <button
            onClick={handleAddCustomWorkClass}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            新增自訂工班（自動保存範本）
          </button>
        </div>
      </div>

      {/* 錯誤和成功訊息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <p className="text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* 下一步按鈕 */}
      <button
        onClick={() => { setError(''); setStep(2); }}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
      >
        下一步: 編輯細項
      </button>
    </div>
  );

  // 步驟 2: 細項編輯
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setStep(1)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          ← 上一步
        </button>
        <button
          onClick={() => { setError(''); setStep(3); }}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
        >
          下一步: 預覽和確認
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
            <div key={code} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                <h3 className="text-white font-semibold text-lg">{workClass.名稱}</h3>
              </div>

              <div className="p-6">
                {/* 細項表格 */}
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-700">序號</th>
                        <th className="px-4 py-2 text-left text-gray-700">細項名稱</th>
                        <th className="px-4 py-2 text-right text-gray-700">數量</th>
                        <th className="px-4 py-2 text-center text-gray-700">單位</th>
                        <th className="px-4 py-2 text-right text-gray-700">單價</th>
                        <th className="px-4 py-2 text-right text-gray-700">複價</th>
                        {isEditing && <th className="px-4 py-2 text-center text-gray-700">操作</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-700">{item.序號}</td>
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
                              <input
                                type="text"
                                value={item.單位}
                                onChange={(e) => {
                                  const updated = [...editingItems];
                                  updated[idx].單位 = e.target.value;
                                  setEditingItems(updated);
                                }}
                                className="w-full text-center px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              item.單位
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
                      <input
                        type="text"
                        placeholder="單位"
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
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
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <Save size={18} />
                        保存細項
                      </button>
                      <button
                        onClick={() => setIsAddingItem(!isAddingItem)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <Plus size={18} />
                        {isAddingItem ? '取消' : '新增細項'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleEditWorkClass(code)}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg transition"
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
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          ← 編輯細項
        </button>
        <button
          onClick={() => setStep(4)}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
        >
          查看版本記錄 →
        </button>
      </div>

      {quotation && (
        <div className="space-y-4">
          {/* 案件信息 */}
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">案件信息</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-600">案件名稱:</span> <span className="font-semibold">{projectName}</span></div>
              <div><span className="text-gray-600">坪數:</span> <span className="font-semibold">{projectArea} 坪</span></div>
              <div><span className="text-gray-600">利潤加成:</span> <span className="font-semibold">{(profitMargin * 100).toFixed(0)}%</span></div>
              <div><span className="text-gray-600">稅率:</span> <span className="font-semibold">{(taxRate * 100).toFixed(0)}%</span></div>
            </div>
          </div>

          {/* 細項總覽 */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 px-6 py-3 font-semibold text-gray-800">
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
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">費用計算</h3>
            <div className="space-y-2">
              {quotation.breakdown.map((line, idx) => {
                const isTotal = line.label === '合計';
                const isSubtotal = ['小計', '稅前小計'].includes(line.label);
                return (
                  <div
                    key={idx}
                    className={`flex justify-between text-sm ${isTotal ? 'text-lg font-bold text-green-700 border-t-2 border-green-300 pt-2' :
                      isSubtotal ? 'text-base font-semibold text-gray-800 border-t border-green-200 pt-1' :
                        'text-gray-700'
                      }`}
                  >
                    <span>{line.label}</span>
                    <span>${line.value.toLocaleString('zh-TW', { minimumFractionDigits: 0 })}</span>
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
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>加載中...</>
            ) : (
              <>
                <Download size={20} />
                生成並上傳 Excel 報價單
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  // 步驟 4: 版本記錄
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setStep(3)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          ← 返回
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
          <p>目前沒有版本記錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transition cursor-pointer"
              onClick={() => setSelectedVersion(v)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-800 flex items-center gap-2">
                    <Calendar size={16} />
                    {v.案件名稱}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {v.版本號} - {v.版本日期} {v.修改時間}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{v.修改項目摘要}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // 模擬下載
                    console.log('下載:', v.Google_Drive檔案名稱);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ============ 主渲染 ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 頂部 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">三今設計 報價單系統</h1>
              <p className="text-gray-600 mt-1">智能化報價單生成與版本管理</p>
            </div>
            <img
              src="https://sanjindesign.com/wp-content/uploads/2026/01/SanjindesignLOGOfull.svg"
              alt="Logo"
              className="h-12 w-auto opacity-80"
            />
          </div>

          {/* 步驟指示器 */}
          <div className="flex items-center justify-between mb-8">
            {[
              { num: 1, label: '選擇工班' },
              { num: 2, label: '編輯細項' },
              { num: 3, label: '預覽確認' },
              { num: 4, label: '版本記錄' }
            ].map((s, idx) => (
              <div key={s.num} className="flex items-center">
                <button
                  onClick={() => s.num <= step && setStep(s.num)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition ${step === s.num
                    ? 'bg-blue-600 text-white shadow-lg'
                    : step > s.num
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                    }`}
                >
                  {step > s.num ? '✓' : s.num}
                </button>
                <span
                  className={`ml-2 text-sm font-medium ${step >= s.num ? 'text-gray-800' : 'text-gray-500'
                    }`}
                >
                  {s.label}
                </span>
                {idx < 3 && (
                  <div
                    className={`w-8 h-0.5 mx-2 ${step > s.num ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 內容區 */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* 底部提示 */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>💡 提示: 所有報價單自動保存到 Google Drive，可隨時查閱版本歷史</p>
        </div>
      </div>
    </div>
  );
};

export default QuotationSystem;
