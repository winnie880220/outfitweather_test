# 衣氣象｜UI Flow

> **版本**：v1.1  
> **對應程式**：`src/App.tsx`（Screen 狀態機）  
> **最後更新**：2026-05-18  
> **使用方式**：全選本檔內容 → 複製 → 貼到 Notion 空白頁（會自動轉成標題、表格、清單）

---

## 0. 文件說明

| 項目 | 內容 |
| --- | --- |
| 產品名稱 | 衣氣象（Outfit Weather） |
| 產品定位 | 依天氣記錄穿搭、瀏覽相似天氣的他人穿搭靈感、收藏喜歡的穿搭、晚間回饋穿著體感 |
| 導航模型 | 單頁 Web App；`welcome` 無底欄，其餘五個主畫面由底部 Tab 切換 |
| Screen 型別 | `welcome` · `home` · `inspiration` · `favorites` · `record` · `feedback` |

---

## 1. 產品目標與使用者假設

**核心目標**

- 早上：記錄今日穿搭並綁定**上傳當下**氣象
- 白天：瀏覽相似溫度區間的穿搭靈感、收藏喜歡的卡片
- 晚上：回饋透氣度、包裹感、悶熱感（可透過提醒或深連結回來填寫）

**使用者假設**

- 願意提供名字、性別與地點（手動搜尋或 GPS 定位）
- 使用手機瀏覽器，可授權相機／定位／通知（選用）
- 同意穿搭照片可能出現在他人靈感牆（需勾選說明後才能完成記錄）

---

## 2. 畫面地圖（Site Map）

```
welcome（歡迎／身分設定）
    │
    └── 開始 ──► home（首頁）
                    │
        ┌───────────┼───────────┬───────────┬───────────┐
        ▼           ▼           ▼           ▼           ▼
   inspiration   favorites   record     feedback    （底欄 Tab 可任意切換）
    （靈感）       （收藏）     （記錄）     （回饋）
```

**底部 Tab（`welcome` 以外皆顯示）**

| Tab ID | 標籤 | 圖示語意 |
| --- | --- | --- |
| `home` | 首頁 | 家 |
| `inspiration` | 靈感 | 火花 |
| `favorites` | 收藏 | 愛心 |
| `record` | 記錄 | 相機 |
| `feedback` | 回饋 | 笑臉 |

**全域元件（跨畫面）**

| 元件 | 說明 |
| --- | --- |
| 底部 Tab 列 | 五個主畫面切換 |
| Toast | 操作結果提示，約 2 秒自動消失 |
| 離開按鈕 | 各主畫面右上角「離開」→ 依狀態顯示不同 Dialog（見 Flow G） |
| `ExitConfirmDialog` | 無待回饋時：確認清除身分與本機資料 |
| `PendingExitBlockDialog` | 有待回饋時：引導先完成體感，不可直接離開 |

---

## 3. 畫面清單（Screen Inventory）

| Screen ID | 中文名稱 | 進入方式 | 主要 UI 區塊 |
| --- | --- | --- | --- |
| `welcome` | 歡迎／身分設定 | 首次開啟、確認離開 App、無有效 session | 名字、**性別**、地點搜尋／定位、「開始」 |
| `home` | 首頁 | 完成設定後、回饋提交後、Tab | 問候、地點 pill、天氣卡、穿搭統計、待回饋橫幅、CTA |
| `inspiration` | 靈感 | Tab、首頁 CTA | 溫度區間、**全部｜女生｜男生** Tab、垂直卡片列表、愛心收藏、底部 CTA |
| `favorites` | 收藏 | Tab | 已收藏穿搭列表（不依當前氣溫過濾）、可取消收藏 |
| `record` | 記錄 | Tab、靈感 CTA、空狀態 CTA | 天氣摘要、拍照區、分享同意 checkbox、晚間提醒、完成記錄 |
| `feedback` | 回饋 | 待回饋橫幅、記錄頁「前往回饋」、深連結、Tab | 穿搭預覽卡（**上傳時快照**）、三滑桿、提交 |

---

## 4. 主流程總覽

### 4.1 應用程式啟動

| 步驟 | 條件 | 結果畫面 |
| --- | --- | --- |
| 1 | 無完整 session（缺名字、性別或地點） | `welcome` |
| 2 | 有 session，URL 含 `?record=pageId` | 寫入 `pendingRecord` → `feedback` |
| 3 | 有 session，有今日 `pendingRecord` 且未回饋 | 載入天氣 → `home`（橫幅提示） |
| 4 | 有 session，無待回饋 | 載入天氣 → `home` |
| 5 | 昨日 pending 已過期 | 清除 pending，Toast「昨日的紀錄已過期，請重新拍照」 |

啟動時若 pending 有效，會呼叫 `hydratePendingRecordFromNotion` 補齊預覽圖／天氣快照（localStorage 無圖或 Notion URL 過期時）。

### 4.2 每日主路徑（Happy Path）

| # | 使用者動作 | 畫面 | 系統行為 | 下一畫面 |
| --- | --- | --- | --- | --- |
| 1 | 開啟 App（已設定過） | `home` | 讀取 session、拉天氣、同步 active 列、拉 insights | `home` |
| 2 | 點「看大家的穿搭」 | `home` | — | `inspiration` |
| 3 | 瀏覽列表、點愛心收藏 | `inspiration` | 寫入 Notion `Favorite`（見 §7.4） | 同畫面 |
| 4 | 點「我穿好了，來記錄」 | `inspiration` | — | `record` |
| 5 | 拍照／相簿選圖 | `record` | 壓縮、預覽、記錄時間；**不顯示「上傳成功」Toast** | `record`（有預覽） |
| 6 | 勾選照片分享說明 | `record` | 必填才能按完成記錄 | `record` |
| 7 | （可選）設定晚間提醒 | `record` | 儲存 `reminder` | `record` |
| 8 | 點「完成記錄」 | `record` | AI 標籤 → **`createRecord` 新建穿搭列** → `pendingRecord` | `record`（鎖定，顯示「前往回饋」） |
| 9 | 點「前往回饋」或橫幅 | `record` / `home` | — | `feedback` |
| 10 | 調整三滑桿 → 提交 | `feedback` | `updateRecord` 寫入體感 → 清除 pending | `home`（約 1 秒後） |

---

## 5. 詳細 User Flow

### Flow A｜首次使用（Onboarding）

**進入**：`welcome`

| 步驟 | 使用者 | UI / 互動 | 驗證／結果 |
| --- | --- | --- | --- |
| A1 | 輸入名字 | 文字欄位，autofocus | 必填，trim 後非空 |
| A2 | 選擇性別 | 女生／男生（單選） | 必填 |
| A3 | 輸入地點 | 打字搜尋（≥2 字，debounce 350ms） | 下拉建議；選一項後鎖定 `userLocation` |
| A3' | 或：使用目前定位 | 「使用我目前定位」 | 需定位權限；成功則 reverse geocode |
| A4 | 點「開始」 | 主按鈕 | 需名字 + 性別 + 地點；否則 disabled |
| A5 | — | — | 儲存 session、載入天氣、同步 active 列 → **`home`** |

**例外與 Toast**：同 v1.0（地點搜尋、定位失敗等）。

---

### Flow B｜首頁（Home）

**進入**：Tab「首頁」、Onboarding 完成、回饋提交後

| 區塊 | 內容 | 互動 |
| --- | --- | --- |
| Header | 「嗨，{名字}！」+ 地點 pill + 離開 | `requestExit()` |
| 待回饋橫幅 | 有今日未填體感時顯示 | 點擊 → **`feedback`** |
| 天氣卡 | 溫度、天氣、濕度／降雨／體感／UV | 唯讀（**即時天氣**） |
| 穿搭統計 | `OutfitStatsPanel` | 唯讀 |
| 主 CTA | 「看大家的穿搭」 | → **`inspiration`** |

---

### Flow C｜靈感（Inspiration Feed）

**進入**：Tab「靈感」、首頁 CTA

**有卡牌時**

| 區塊 | 內容 | 互動 |
| --- | --- | --- |
| Header | 「今日靈感」+ 相似天氣溫度區間 | 離開 |
| 性別 Tab | 全部｜女生｜男生 | 篩選列表（依卡片 `gender`） |
| 卡片列表 | 垂直滾動；每卡右上角 ♥ | 點 ♥ → 收藏／取消（見 §7.4） |
| 底部 CTA | 「我穿好了，來記錄」 | → **`record`** |

**Toast（收藏）**

| 操作 | 訊息 |
| --- | --- |
| 加入收藏 | 「已加入收藏 ♡」 |
| 取消收藏 | 「已取消收藏」 |
| 缺 pageId | 「此穿搭缺少 Notion 紀錄，無法收藏」 |
| 收藏自己 | 「無法收藏自己的穿搭」 |

**空狀態**

| 變體 | 說明 | CTA |
| --- | --- | --- |
| 全區間無卡 | 「此溫度區間還沒有穿搭靈感」 | 「成為第一筆穿搭記錄」→ **`record`** |
| 篩選後無卡 | 「目前沒有{女生/男生}穿搭靈感」 | 提示切換「全部」 |

> 靈感牆僅顯示有 `photoUrl` 的穿搭；資料來源為 `fetchOutfitInsights`（相似溫區間 API）。

---

### Flow C2｜收藏（Favorites）

**進入**：Tab「收藏」

| 區塊 | 內容 | 互動 |
| --- | --- | --- |
| Header | 「收藏」 | 離開 |
| 列表 | 使用者所有 Notion 列上 `Favorite` 欄位彙整的卡片 | 點 ♥ 取消收藏 |
| 空狀態 | 「還沒有收藏」 | 引導至靈感頁點愛心 |

收藏列表**不依當前氣溫過濾**；與靈感牆的溫區篩選無關。

---

### Flow D｜記錄（Record）

**進入**：Tab「記錄」、靈感／收藏相關 CTA

#### D1｜選擇照片（尚未完成記錄）

| 步驟 | 使用者 | UI / 互動 | 結果 |
| --- | --- | --- | --- |
| D1 | 點虛線拍照區 | Action Sheet | 自拍／相簿 |
| D2 | 拍照或選圖 | 預覽 + 文案「照片已選取 · 氣象已綁定」 | **僅本機預覽，尚未寫入 Notion** |
| D3 | （可選）重新拍攝 | 清除本機圖 | — |
| D4 | （可選）晚間提醒 | 僅在有本機照片時顯示 | 更新 `reminder` |
| D5 | 勾選分享說明 | checkbox 必填 | 未勾選按完成 → Toast「請先勾選照片分享說明…」 |
| D6 | 點「完成記錄」 | loading「AI 分析並寫入中…」 | 見 D-API |

**刻意不提供**：選圖後的「照片上傳成功」Toast（避免使用者誤以為已完成，仍需按「完成記錄」）。

#### D2｜已完成記錄、待回饋（`hasUploadedToday = true`）

| 區塊 | 行為 |
| --- | --- |
| 拍照區 | 鎖定，顯示「照片已上傳」，不可重拍 |
| 主按鈕 | 「前往回饋」→ **`feedback`** |
| 說明 | 「你需要完成體感回饋才可以上傳新穿搭」 |

一次只能有一筆今日待回饋；須先回饋完才能再記錄新穿搭。

#### Flow D-API（完成記錄後端流程）

| 順序 | 動作 | 說明 |
| --- | --- | --- |
| 1 | `analyzeOutfit`（Gemini） | 失敗仍可繼續；Toast 說明額度／辨識結果 |
| 2 | **`createRecord`** | **每次完成記錄都新建一列穿搭**（含 Photo）；不覆寫 active 列 |
| 3 | `setPendingRecord` | 綁定該列 `pageId` + **上傳當下**天氣／時間快照 |
| 4 | `scheduleEveningReminder` | 若 reminder 已開 |
| 5 | 複製深連結 | `buildRecordUrl(pageId)` → 剪貼簿（若可） |
| 6 | Toast | 「已記錄，你可以前往回饋穿搭體感」 |
| 7 | 停留 | **留在 `record`**，不切換畫面 |

**阻擋條件**

| 條件 | 行為 |
| --- | --- |
| 無本機照片 | 「完成記錄」disabled |
| 未勾選分享說明 | Toast，不執行儲存 |
| 已有待回饋 | 無法再拍新照；僅可「前往回饋」 |
| 儲存中 | 禁用拍照區 |
| 無天氣資料 | 不執行儲存 |

---

### Flow E｜回饋（Feedback）

**進入**：待回饋橫幅、記錄頁「前往回饋」、URL `?record=xxx`、Tab「回饋」

**有 pending（`needsFeedback = true`）**

| 區塊 | 內容 | 互動 |
| --- | --- | --- |
| 穿搭卡 | 照片、地點、溫度、天氣、記錄時間 | **唯讀；顯示 `pendingRecord` 上傳快照，非即時天氣** |
| 滑桿 ×3 | 透氣度、包裹感、悶熱感 | 拖動後產生感受標籤 |
| 提交 | 「貢獻這份體感數據」 | `updateRecord(pending.pageId, …)` → 清除 pending → **`home`** |

> 例：早上 21°C 上傳、晚上 19°C 回饋，回饋頁仍顯示 21°C 與上傳時間。

**無 pending（空狀態）**

| 元素 | 文案 |
| --- | --- |
| 標題 | 今日沒有需要回饋的穿搭了 |
| 說明 | 今天的體感已記錄完成，或尚未建立今日穿搭。可先至「記錄」拍照上傳。 |

**提交失敗**：找不到 `pageId`、Notion 更新失敗等 Toast（同前）。

---

### Flow F｜晚間回饋（Deferred Feedback）

| 觸發 | 行為 |
| --- | --- |
| 完成記錄後未填體感 | `hasPendingFeedback = true`，`pendingRecord` 寫入 localStorage |
| 首頁橫幅 | 「你有今日穿搭尚未填寫體感」→ **`feedback`** |
| 深連結 `?record=xxx` | 還原 pending，清除 query → **`feedback`** |
| 提醒已開 + 回到前景 | 可能顯示待回饋通知 |
| 隔日 | pending 過期清除，Toast 提示重新拍照 |
| 換日或氣溫區間變更 | **active 列**可換新列；**pending 仍綁定原上傳列** |

---

### Flow G｜離開 App

離開入口：各主畫面右上角「離開」→ `requestExit()`。

#### G-A｜有待回饋（`pendingRecord` 有效且未回饋）

| 目前畫面 | 行為 |
| --- | --- |
| `feedback` | Toast：「請先完成今日穿搭的體感回饋，再離開 App」 |
| 其他主畫面 | 開啟 **`PendingExitBlockDialog`** |

**PendingExitBlockDialog**

| 按鈕 | 行為 |
| --- | --- |
| 稍後再說 | 關閉 Dialog，停留原畫面 |
| 前往回饋 | → **`feedback`**（`continuePendingFeedback`） |

> **不可**在有待回饋時確認離開；須先完成體感回饋。

#### G-B｜無待回饋

| 步驟 | 動作 | 結果 |
| --- | --- | --- |
| G1 | 點「離開」 | 開啟 **`ExitConfirmDialog`** |
| G2 | 「取消」 | 關閉，停留 |
| G3 | 「確定離開」 | `performExitApp()` → **`welcome`** |

**`performExitApp` 清除範圍**

| 類型 | 內容 |
| --- | --- |
| localStorage | `outfitweather_session`、`outfitweather_favorites_*`、`outfitweather_inspiration_swipe` |
| URL | 清除 `?record=` |
| 排程 | 取消晚間提醒 |
| React 狀態 | 名字、性別、地點、天氣、pending、收藏快取、本機照片等全部重置 |
| Toast | 「已返回初始頁面」 |

> Notion 雲端已建立的列**不會刪除**；僅本機不再還原。重新進入需從 `welcome` 重設身分。

**ExitConfirmDialog 文案**：離開後名稱與地點等身分資料無法保留，需重新設定。

---

## 6. Overlay 與次級互動

| 元件 | 觸發 | 關閉方式 | 備註 |
| --- | --- | --- | --- |
| 地點搜尋下拉 | welcome 輸入 ≥2 字 | 點外部、選建議 | debounce 350ms |
| Record Action Sheet | 點虛線拍照區（無待回饋、無照片、非儲存中） | 點遮罩 | 自拍／相簿 |
| 相機全螢幕 | Action Sheet「開啟自拍」 | 拍照或取消 | `getUserMedia` |
| `ExitConfirmDialog` | 離開（無 pending） | 取消／確定離開 | stone 色調 |
| `PendingExitBlockDialog` | 離開（有 pending，非 feedback 頁） | 稍後再說／前往回饋 | stone 色調，與離開 Dialog 一致 |
| Toast | API、操作結果 | 約 2 秒 | 固定底部偏上 |

---

## 7. 狀態與資料持久化

### 7.1 畫面狀態機

| Screen | 關鍵 React 狀態 | 阻擋／空狀態 |
| --- | --- | --- |
| `welcome` | `userName`, `userGender`, `userLocation` | 三項皆必填才能開始 |
| `home` | `weather`, `hasPendingFeedback` | 天氣 loading |
| `inspiration` | `outfitInsights.inspiration`, `inspirationFavorites` | 無卡 → 空狀態；篩選無卡 → 提示 |
| `favorites` | `favoriteCards`（自 Notion 彙整） | 無收藏 → 空狀態 |
| `record` | `outfitImage`, `hasPendingFeedback`, `recordSaving` | 有待回饋時鎖拍照；無圖／未勾選同意不能完成 |
| `feedback` | `hasPendingFeedback`, `feelSet`, `pendingRevision` | 無 pending → 空狀態；回饋卡用 pending 快照 |

### 7.2 Notion 列模型（重要）

系統維護兩類 Notion 列，勿混淆：

| 概念 | 用途 | 建立／更新時機 |
| --- | --- | --- |
| **active 列** | 當日＋氣溫區間（`round(temp)` 相差 ≤1°C）的使用者 session 列；**收藏**寫入此列的 `Favorite` 欄位 | `ensureActiveUserRecord`：換日或跨溫區間時**新建** |
| **穿搭列** | 每次「完成記錄」含照片的完整紀錄 | **`createRecord` 每次新建**；體感回饋 `updateRecord` 寫入**此列** |

**`pendingRecord`** 鎖定的是**穿搭列**的 `pageId`（上傳照片那一列），不是 active 列。  
active 列換日／換溫區間時，**不會**清除 pending。

| 規則 | 說明 |
| --- | --- |
| 同 userName + 同氣溫多次上傳 | 多筆穿搭列（各自有 Photo） |
| 同時待回饋 | **僅一筆**；須回饋完才能再記錄 |
| 回饋目標 | 永遠是 `pendingRecord.pageId` |

### 7.3 localStorage（`outfitweather_session`）

| 欄位 | 用途 |
| --- | --- |
| `userName` | 使用者名稱 |
| `gender` | `女生` / `男生` |
| `userLocation` | `{ name, lat, lon }` |
| `pendingRecord` | 今日待回饋：`pageId`、`date`、照片預覽、**上傳時**溫度／天氣／時間等 |
| `activeUserRecord` | `{ pageId, date, tempBand }` 當日 active 列 |
| `reminder` | `{ enabled, hour, minute }` 晚間提醒 |

`resetAppSession()`（離開 App）會一併清除 session、所有 `outfitweather_favorites_*`、靈感 swipe 快取。

### 7.4 收藏（Favorite）

| 項目 | 說明 |
| --- | --- |
| Notion 欄位 | `Favorite`（Multi-select） |
| 儲存值 | 被收藏**穿搭列**的 `ID` 欄位值（非 page id、非 userName） |
| 寫入列 | 使用者的 **active 列** |
| 本機快取 | `outfitweather_favorites_{userName}`：卡片快照，加速收藏頁 |
| 同步 | 進入 App 後 `fetchUserFavorites` 與 Notion 對齊 |

### 7.5 其他本地／URL

| Key / 模組 | 用途 |
| --- | --- |
| `outfitweather_inspiration_swipe` | 舊版滑卡狀態（若仍寫入）；離開 App 時清除 |
| URL `?record=` | 深連結：寫入 pending 後 `clearRecordFromUrl` |
| `hydratePendingRecordFromNotion` | 從 Notion 補齊 pending 預覽與快照 |

---

## 8. 外部 API 依賴（流程相關）

| API / 功能 | 使用時機 | 失敗時 UX |
| --- | --- | --- |
| 地點搜尋 / 反向地理 | welcome | Toast |
| `fetchCurrentWeather` | 開始 App、首頁 | Toast「天氣數據獲取失敗」 |
| `fetchOutfitInsights` | 有天氣後 | 靈感列表可能為空 |
| `fetchUserFavorites` | 有 userName 後 | console warn，收藏列表可能空 |
| `analyzeOutfit` | 完成記錄 | 仍可 `createRecord`，無 AI 標籤 |
| `createRecord` | 完成記錄 | Toast Notion 錯誤 |
| `updateRecord` | 提交體感 | Toast Notion 錯誤 |
| `ensureActiveUserRecord` | 天氣／換日／換溫區間 | console warn |
| `toggleOutfitFavorite` | 靈感／收藏頁點愛心 | Toast |
| 晚間提醒 | 記錄成功 + reminder.enabled | 通知／排程 |

---

## 9. QA 測試檢查清單

**Onboarding**

- [ ] 未填名字、性別或地點時「開始」不可點
- [ ] 重新整理後有完整 session 則跳過 welcome、進 home

**記錄 → 回饋**

- [ ] 選圖後**無**「照片上傳成功」Toast
- [ ] 未勾選分享說明時無法完成記錄
- [ ] 完成記錄後停留 record，顯示「前往回饋」
- [ ] 有待回饋時無法再拍新照
- [ ] 回饋頁顯示上傳時天氣／時間（非晚上即時天氣）
- [ ] 提交體感後回首頁，橫幅消失

**靈感／收藏**

- [ ] 性別 Tab 篩選正確
- [ ] 收藏寫入 Notion、收藏頁可見
- [ ] 無法收藏自己的穿搭

**離開**

- [ ] 有待回饋時：其他頁離開 → 阻擋 Dialog；feedback 頁 → Toast
- [ ] 有待回饋時**無法**直接確認離開
- [ ] 完成回饋後可正常離開，welcome 且本機資料清空

**晚間／深連結**

- [ ] 深連結 `?record=` 進入回饋頁
- [ ] 隔日 pending 過期提示

---

## 10. 待釐清（Open Questions）

| # | 問題 | 影響 |
| --- | --- | --- |
| 1 | 完成記錄後是否應自動切到 `feedback`（目前需手動「前往回饋」） | 轉換率 vs 使用者節奏 |
| 2 | 首頁 `OutfitStatsPanel` 全 API 化時程 | home 資訊架構 |
| 3 | 離開 App 是否要在後端標記／刪除未回饋的 Notion 穿搭列 | 資料庫整潔度 |

---

## 附錄｜程式對照

| 概念 | 程式位置 |
| --- | --- |
| Screen 型別 | `src/App.tsx` → `type Screen` |
| Tab 定義 | `src/App.tsx` → 底部 nav 五項 |
| 離開邏輯 | `requestExit`, `performExitApp`, `PendingExitBlockDialog` |
| Session | `src/lib/session-storage.ts` |
| Active 列 API | `api/lib/notion/user-active-record.ts` |
| 穿搭建立 | `api/lib/notion/records.ts` → `createRecord` |
| 收藏 API | `api/lib/notion/favorites.ts` |
| 深連結 | `src/lib/record-url.ts` |
| Pending 還原 | `src/lib/pending-record-hydrate.ts` |
| 靈感列表 | `src/screens/InspirationFeedScreen.tsx` |
| 收藏頁 | `src/screens/FavoritesScreen.tsx` |
| 待回饋橫幅 | `src/components/PendingFeedbackBanner.tsx` |
