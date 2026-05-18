# 衣氣象｜UI Flow

> **版本**：v1.0  
> **對應程式**：`src/App.tsx`（Screen 狀態機）  
> **最後更新**：2026-05-18  
> **使用方式**：全選本檔內容 → 複製 → 貼到 Notion 空白頁（會自動轉成標題、表格、清單）

---

## 0. 文件說明

| 項目 | 內容 |
| --- | --- |
| 產品名稱 | 衣氣象（Outfit Weather） |
| 產品定位 | 依天氣記錄穿搭、瀏覽相似天氣的他人穿搭靈感、晚間回饋穿著體感 |
| 導航模型 | 單頁 Web App；`welcome` 無底欄，其餘四個主畫面由底部 Tab 切換 |
| Screen 型別 | `welcome` · `home` · `inspiration` · `record` · `feedback` |

---

## 1. 產品目標與使用者假設

**核心目標**

- 早上：記錄今日穿搭並綁定當下氣象
- 白天：瀏覽相似溫度區間的穿搭靈感
- 晚上：回饋透氣度、包裹感、悶熱感（可透過提醒或深連結回來填寫）

**使用者假設**

- 願意提供名字與地點（手動搜尋或 GPS 定位）
- 使用手機瀏覽器，可授權相機／定位／通知（選用）

---

## 2. 畫面地圖（Site Map）

```
welcome（歡迎／身分設定）
    │
    └── 開始 ──► home（首頁）
                    │
        ┌───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼
   inspiration   record     feedback    （底欄 Tab 可任意切換）
    （靈感）      （記錄）     （回饋）
```

**底部 Tab（`welcome` 以外皆顯示）**

| Tab ID | 標籤 | 圖示語意 |
| --- | --- | --- |
| `home` | 首頁 | 家 |
| `inspiration` | 靈感 | 火花 |
| `record` | 記錄 | 相機 |
| `feedback` | 回饋 | 笑臉 |

**全域元件（跨畫面）**

| 元件 | 說明 |
| --- | --- |
| 底部 Tab 列 | 四個主畫面切換 |
| Toast | 操作結果提示，約 2 秒自動消失 |
| 離開按鈕 + 確認 Dialog | 清除 session，回到 `welcome` |
| 離開確認文案 | 「離開後將回到初始頁面，名稱與地點等身分資料無法保留」 |

---

## 3. 畫面清單（Screen Inventory）

| Screen ID | 中文名稱 | 進入方式 | 主要 UI 區塊 |
| --- | --- | --- | --- |
| `welcome` | 歡迎／身分設定 | 首次開啟、離開 App、無有效 session | 名字輸入、地點搜尋／定位、「開始」按鈕 |
| `home` | 首頁 | 完成設定後、回饋提交後、點 Tab | 問候、地點 pill、天氣卡、穿搭統計、待回饋橫幅、CTA |
| `inspiration` | 靈感 | Tab、首頁「看大家的穿搭」 | 溫度區間標籤、滑卡、略過／收藏、底部 CTA |
| `record` | 記錄 | Tab、靈感「我穿好了」、空狀態 CTA | 天氣摘要、拍照區、晚間提醒、完成記錄 |
| `feedback` | 回饋 | 記錄成功後、待回饋橫幅、深連結、Tab | 穿搭預覽卡、三組滑桿、感受標籤、提交 |

---

## 4. 主流程總覽

### 4.1 應用程式啟動

| 步驟 | 條件 | 結果畫面 |
| --- | --- | --- |
| 1 | 無 session（無名字或無地點） | `welcome` |
| 2 | 有 session，URL 含 `recordId` | 寫入 pending → `feedback` |
| 3 | 有 session，無深連結 | 載入天氣 → `home` |
| 4 | 昨日 pending 已過期 | Toast「請重新拍照」 |

### 4.2 每日主路徑（Happy Path）

| # | 使用者動作 | 畫面 | 系統行為 | 下一畫面 |
| --- | --- | --- | --- | --- |
| 1 | 開啟 App（已設定過） | `home` | 讀取 session、拉取天氣與 insights | `home` |
| 2 | 點「看大家的穿搭」 | `home` | — | `inspiration` |
| 3 | 右滑喜歡／左滑略過 | `inspiration` | 更新 swipe 狀態、Toast | 下一張卡（同畫面） |
| 4 | 點「我穿好了，來記錄」 | `inspiration` | — | `record` |
| 5 | 點拍照區 → 自拍或相簿 | `record` | 壓縮圖片、記錄時間、綁定氣象 | `record`（有預覽） |
| 6 | （可選）設定晚間提醒 | `record` | 儲存 reminder 設定 | `record` |
| 7 | 點「完成記錄」 | `record` | AI 標籤 → 寫入 Notion → 複製連結 → 建立 pending | `feedback`（約 1 秒後） |
| 8 | 調整三滑桿 →「貢獻體感數據」 | `feedback` | 更新 Notion、清除 pending、取消提醒 | `home`（約 1 秒後） |

---

## 5. 詳細 User Flow

### Flow A｜首次使用（Onboarding）

**進入**：`welcome`

| 步驟 | 使用者 | UI / 互動 | 驗證／結果 |
| --- | --- | --- | --- |
| A1 | 輸入名字 | 文字欄位，autofocus | 必填，trim 後非空 |
| A2 | 輸入地點 | 打字搜尋（≥2 字，debounce 350ms） | 下拉建議列表；選一項後鎖定 `userLocation` |
| A2' | 或：使用目前定位 | 「使用我目前定位」按鈕 | 需瀏覽器定位權限；成功則 reverse geocode |
| A3 | 點「開始」 | 主按鈕 | 需同時滿足名字 + 地點；否則 disabled + 提示文案 |
| A4 | — | — | 儲存 session、載入天氣 → **`home`** |

**例外與 Toast**

| 情境 | 提示 |
| --- | --- |
| 搜尋無結果 | 「找不到相符地點，請換關鍵字或按右側定位」 |
| 定位被拒絕 | 「請在瀏覽器允許定位權限後再試」 |
| 定位逾時 | 「定位逾時，請到戶外或改用手動輸入」 |
| 地點服務連線失敗 | 「地點服務連線失敗，請稍後再試」 |

---

### Flow B｜首頁（Home）

**進入**：Tab「首頁」、Onboarding 完成、回饋提交後

| 區塊 | 內容 | 互動 |
| --- | --- | --- |
| Header | 「嗨，{名字}！」+ 地點 pill + 離開 | 地點顯示目前天氣位置；載入中顯示「定位中...」 |
| 待回饋橫幅 | 有今日未填體感時顯示 | 點擊 → **`feedback`** |
| 天氣卡 | 溫度、天氣、濕度／降雨／體感／UV | 唯讀 |
| 穿搭統計 | `OutfitStatsPanel`（依 insights API） | 唯讀 |
| 主 CTA | 「看大家的穿搭」 | → **`inspiration`** |

---

### Flow C｜靈感（Inspiration）

**進入**：Tab「靈感」、首頁 CTA

**有卡牌時**

| 區塊 | 內容 | 互動 |
| --- | --- | --- |
| Header | 「今日靈感」+ 相似天氣溫度區間 pill | — |
| 主卡 | 照片／emoji、匹配%、溫度、誰／哪裡／何時、標籤、體感 chips | 左右拖曳 >100px：右=喜歡、左=略過 |
| 底部左 | ✕ 略過 | `handleNextInspiration(false)` |
| 底部右 | ♥ 喜歡／收藏 | `handleNextInspiration(true)`；已收藏顯示實心紅心 |
| 底部主 CTA | 「我穿好了，來記錄」 | → **`record`** |

**Toast 回饋**

| 操作 | 訊息 |
| --- | --- |
| 喜歡（未收藏過） | 「已收藏，移至堆疊最後 ♡」 |
| 喜歡（已收藏） | 「已在收藏中，已移至堆疊最後 ♡」 |
| 略過（曾收藏） | 「已從收藏移除並略過」 |
| 略過（未收藏） | 「已略過這套穿搭」 |

**空狀態**

| 變體 | 標題 | 說明 | CTA |
| --- | --- | --- | --- |
| `no-data` | 此溫度區間還沒有穿搭靈感 | 成為第一筆相似天氣的穿搭記錄 | 「成為第一筆穿搭記錄」→ **`record`** |
| `exhausted` | 本區間靈感已瀏覽完畢 | 溫度變化後會推薦新穿搭；收藏卡排最後 | 無 |

---

### Flow D｜記錄（Record）

**進入**：Tab「記錄」、靈感 CTA、靈感空狀態 CTA

| 步驟 | 使用者 | UI / 互動 | 結果 |
| --- | --- | --- | --- |
| D1 | 點虛線拍照區 | Action Sheet 浮層 | 選項：開啟自拍／從相簿上傳 |
| D2a | 自拍 | 全區域相機 preview + 快門 | 拍照後關閉 stream → 預覽圖 |
| D2b | 相簿 | 系統檔案選擇器 `image/*` | 壓縮後 → 預覽圖 |
| D3 | （可選）重新拍攝 | 預覽上「重新拍攝」連結 | 清除圖片 |
| D4 | （可選）晚間提醒 | `ReminderSettingsPanel` | 僅在有照片時顯示 |
| D5 | 點「完成記錄」 | 按鈕 loading「AI 分析並寫入中…」 | 見 Flow D-API |

**Flow D-API（完成記錄後端流程）**

| 順序 | 動作 | 失敗處理 |
| --- | --- | --- |
| 1 | Gemini 分析上著／下著標籤 | 額度不足等仍繼續儲存（Toast 說明） |
| 2 | `createRecord` 寫入 Notion + 照片 | Toast 欄位類型錯誤等提示 |
| 3 | 建立 `pendingRecord`、排程晚間提醒 | — |
| 4 | 複製深連結到剪貼簿（若可） | Toast 含提醒／連結文案 |
| 5 | 約 1 秒後切畫面 | → **`feedback`** |

**阻擋條件**

| 條件 | 行為 |
| --- | --- |
| 無照片 | 「完成記錄」disabled |
| 儲存中 | 禁用點擊拍照區 |
| 無天氣資料 | 不執行儲存（需先有 weather） |

---

### Flow E｜回饋（Feedback）

**進入**：記錄成功後自動、待回饋橫幅、URL `?record=xxx`、Tab「回饋」

**有 pending（`needsFeedback = true`）**

| 區塊 | 內容 | 互動 |
| --- | --- | --- |
| Header | 「今日體感回饋」 | — |
| 穿搭卡 | 照片、地點、溫度、天氣、記錄時間 | 唯讀 |
| 滑桿 ×3 | 透氣度、包裹感、悶熱感（0–100） | 拖動後產生「感受標籤」文案 |
| 感受標籤 | 自動生成描述 | 未調滑桿時半透明 + pulse |
| 提交 | 「貢獻這份體感數據」 | 需 `feelSet`；成功 → Toast → **`home`** |

**無 pending（空狀態）**

| 元素 | 文案 |
| --- | --- |
| 標題 | 今日沒有需要回饋的穿搭了 |
| 說明 | 今天的體感已記錄完成，或尚未建立今日穿搭。可先至「記錄」拍照上傳。 |

**提交失敗**

| 情境 | Toast |
| --- | --- |
| 找不到 pageId | 「找不到今日穿搭紀錄，請重新拍照或開啟晚間連結」 |
| Notion 更新失敗 | 「Notion 同步失敗：{訊息}」 |

---

### Flow F｜晚間回饋（Deferred Feedback）

| 觸發 | 行為 |
| --- | --- |
| 記錄後未立刻填體感就離開 | `hasPendingFeedback = true` |
| 首頁橫幅 | 「你有今日穿搭尚未填寫體感」→ 點擊 **`feedback`** |
| 深連結 `?record=xxx` | 還原 pending，直接 **`feedback`** |
| 提醒已開 + App 回到前景 | 可能顯示「該填體感」通知 |
| 隔日 | pending 過期，Toast「昨日的紀錄已過期，請重新拍照」 |

---

### Flow G｜離開 App（Reset Session）

| 步驟 | 動作 | 結果 |
| --- | --- | --- |
| G1 | 點右上角「離開」 | 開啟確認 Dialog |
| G2 | 點「取消」 | 關閉 Dialog，停留原畫面 |
| G3 | 點「確定離開」 | 清除 session、提醒、靈感 swipe、天氣等 → **`welcome`** + Toast「已返回初始頁面」 |

---

## 6. Overlay 與次級互動

| 元件 | 觸發 | 關閉方式 | 備註 |
| --- | --- | --- | --- |
| 地點搜尋下拉 | 輸入 ≥2 字且有結果 | 點外部、選取建議 | debounce 350ms |
| Record Action Sheet | 點虛線拍照區（無照片、非儲存中） | 點半透明遮罩 | 自拍／相簿二選一 |
| 相機全螢幕 | Action Sheet「開啟自拍鏡頭」 | 拍照完成或 Header「取消」 | 需 `getUserMedia` |
| ExitConfirmDialog | 各主畫面「離開」 | 取消／確定 | `role="alertdialog"` |
| Toast | API、操作結果 | 2 秒自動消失 | 固定底部偏上 |

---

## 7. 狀態與資料持久化

### 7.1 畫面狀態機

| Screen | 關鍵 React 狀態 | 阻擋／空狀態 |
| --- | --- | --- |
| `welcome` | `userName`, `userLocation` | 未填完不能「開始」 |
| `home` | `weather`, `hasPendingFeedback` | 天氣 loading skeleton |
| `inspiration` | `visibleInspirationCards` | deck 空 → 空狀態元件 |
| `record` | `outfitImage`, `recordSaving`, `isCameraOpen` | 無圖不能完成；儲存中禁拍照 |
| `feedback` | `hasPendingFeedback`, `feelSet` | 無 pending → 空狀態；未調滑桿不能提交 |

### 7.2 localStorage（`outfitweather_session`）

| 欄位 | 用途 |
| --- | --- |
| `userName` | 使用者名稱 |
| `userLocation` | `{ name, lat, lon }` |
| `pendingRecord` | 今日未回饋的 Notion pageId + 照片預覽等 |
| `reminder` | `{ enabled, hour, minute }` 晚間提醒 |

### 7.3 其他本地儲存

| Key / 模組 | 用途 |
| --- | --- |
| 靈感 swipe 狀態 | 略過／收藏紀錄，依溫度區間 key 分組 |
| URL `recordId` | 深連結進入時寫入 pending 後清除 query |

---

## 8. 外部 API 依賴（流程相關）

| API / 功能 | 使用時機 | 失敗時 UX |
| --- | --- | --- |
| 地點搜尋 `searchLocations` | welcome 打字搜尋 | Toast |
| 反向地理 `reverseGeocode` | GPS 定位後 | Toast |
| 天氣 `fetchCurrentWeather` | 開始 App、首頁 | Toast「天氣數據獲取失敗」 |
| 靈感 `fetchOutfitInsights` | 有天氣後 |  fallback 至 mock 卡牌 |
| AI `analyzeOutfit` | 完成記錄 | 仍可儲存，無標籤 |
| Notion `createRecord` / `updateRecord` | 記錄／回饋 | Toast 錯誤說明 |
| 晚間提醒 | 記錄成功 + reminder.enabled | 通知／排程 |

---

## 9. QA 測試檢查清單

**Onboarding**

- [ ] 未填名字或地點時「開始」不可點
- [ ] 地點搜尋、定位、選建議皆能進入首頁
- [ ] 重新整理後有 session 則跳過 welcome

**記錄 → 回饋**

- [ ] 自拍、相簿上傳皆可預覽並完成記錄
- [ ] 記錄成功後約 1 秒進入回饋頁
- [ ] 提交體感後回首頁，橫幅消失

**靈感**

- [ ] 左右滑與底部按鈕行為一致
- [ ] 收藏後再略過會移除收藏（Toast 正確）
- [ ] 卡牌用完顯示 exhausted 空狀態

**晚間／深連結**

- [ ] 有 pending 時首頁橫幅可點進回饋
- [ ] 深連結可直達回饋頁
- [ ] 隔日 pending 過期提示

**離開**

- [ ] 取消離開留在原畫面
- [ ] 確認離開回到 welcome 且資料清空

---

## 10. 待釐清（Open Questions）

| # | 問題 | 影響 |
| --- | --- | --- |
| 1 | 記錄後是否允許不填體感、僅依提醒晚間再填？ | 目前會自動 1 秒後進 feedback，但可 Tab 切走 |
| 2 | 首頁 `OutfitStatsPanel` 何時改為全 API 資料（非 mock）？ | 影響 home 資訊架構 |
| 3 | `INITIAL_WARDROBE` mock 衣櫃是否仍要露出在 UI？ | 目前僅 state，未必有畫面 |
| 4 | 靈感卡牌來源：insights API vs `INSPIRATION_CARDS` fallback 的產品策略？ | 影響 inspiration 空狀態頻率 |

---

## 附錄｜程式對照

| 概念 | 程式位置 |
| --- | --- |
| Screen 型別 | `src/App.tsx` → `type Screen` |
| Tab 定義 | `src/App.tsx` → 底部 `map` 四項 |
| Session | `src/lib/session-storage.ts` |
| 深連結 | `src/lib/record-url.ts` |
| 靈感滑卡邏輯 | `src/lib/inspiration-swipe.ts` |
| 待回饋橫幅 | `src/components/PendingFeedbackBanner.tsx` |
