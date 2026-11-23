# 我們的小日子

繁體中文、手機版優先的雙人生活網站：記帳、分類預算、每日行程、保健品打卡及願望存款。採用米白紙感、襯線標題與低飽和橄欖綠的生活手帳介面，搭配 Supabase Email／密碼登入與私人雙人空間。

視覺樣式集中於 `styles.css`，登入頁包含輕量 SVG 手帳插畫；不需外部字型或圖片服務。手機使用底部浮動導覽，桌機登入頁則採雙欄排版。

## 首次設定 Supabase（必要）

1. 開啟你的 Supabase 專案 Dashboard > SQL Editor。
2. 複製 `supabase/schema.sql` **全部內容**，執行一次。此檔建立資料表、存取限制及 5 個 RPC；不用將資料表設成公開，也不需要停用 RLS。
3. 在 Authentication > Providers 確認 Email 登入已啟用。若啟用 Confirm email，註冊後須先完成信箱驗證。正式寄信量較大時依 Supabase 指示設定 SMTP。
4. 在 Authentication > URL Configuration 設定 Site URL 為正式網站網址；開發時也可在 Redirect URLs 加入實際開發網址。GitHub Pages 網址預計為 `https://yncerica-hue.github.io/us/`，部署成功後才可使用。

`.env` 內已填入所提供的專案 URL 與 **publishable key**。這是瀏覽器可公開的憑證，權限由登入與 SQL 限制；不可改填 `service_role` 或 `sb_secret_` 金鑰。可參考 `.env.example` 改用其他專案。修改環境變數後須重新建置。

## 開發與驗證

使用 Node.js 22.12 以上（建議 24）：

```sh
cd /workspace/us
npm ci
npm test
npm run dev
```

```sh
npm run build
npm run preview
```

`npm test` 在本機 PGlite（PostgreSQL 引擎）驗證 SQL 的成員隔離、雙人上限、版本衝突及存取限制，不會連線或修改正式 Supabase。正式環境仍需依下方操作驗證。

另提供 `npm run test:e2e`：先在另一個終端機執行 `npm run build` 與 `npm run preview -- --port 4173 --strictPort`，再執行此測試。預設使用雲端提供的 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 指定其他 Chromium。測試模擬 Supabase Auth、以本機 PostgreSQL 執行 RPC，涵蓋雙帳號同步、記帳、每日打卡、願望、第三人拒絕及存檔失敗，不會修改正式資料。

## 兩個人如何使用

1. 各自註冊不同的 Email 帳號，完成信箱驗證後登入。
2. 第一人填暱稱並按「建立空間」。
3. 私下將邀請碼交給另一半。
4. 第二人填自己的暱稱與邀請碼，按「加入空間」。每個帳號只能加入一個空間，最多兩位成員。
5. 在其中一台裝置新增支出，另一台在未編輯時約 5 秒內可看見；重新整理後仍應保留。

資料透過 HTTPS 寫入 Supabase。兩位成員能共同編輯該空間所有記帳、願望及設定。伺服器以版本號防止同時修改互相覆蓋；衝突或存檔失敗時停止後續編輯，提供未儲存資料下載，請先備份再重新載入雲端資料。下載備份為 JSON，需手動重新輸入變更，尚無自動匯入功能。

「許願」頁面可用每個目標的「上移／下移」調整順序，已實現的目標也依手動順序顯示。每張卡片會顯示達成百分比與進度條；「更新已達成進度」可選擇累計金額或達成百分比，按「更新進度」儲存。這裡輸入的是目前累計值；「存進去」則是在目前進度上增加金額。直接更新進度會保留兩人過去的累計存入紀錄，修正到目標以下時會解除已實現狀態。順序與進度沿用原有雲端存檔，不需修改 Supabase 資料表。

先前 HTML 版本的 `couple-app` localStorage 資料未刪除，但不會自動上傳或合併到新雲端空間。登入狀態儲存在瀏覽器，請在共用裝置用完後登出。

## 帳號管理

登入後進入「記帳 > 設定 > 帳號管理」，可修改自己的暱稱與登入密碼。密碼需至少 8 個字元並再次輸入確認；實際密碼規則依 Supabase 專案設定，更新成功後下次以新密碼登入。密碼只傳給 Supabase Auth，不會寫入雙人空間或備份。

**既有網站須先更新資料庫一次：**在 Supabase Dashboard > SQL Editor 貼上並執行 `supabase/account-management.sql` 全部內容，以啟用暱稱修改。這份檔案可重複執行，不會刪除帳號或生活紀錄。新安裝直接執行完整 `supabase/schema.sql` 即可，不需另跑此檔。

暱稱為 1 至 30 個字元，只能更新登入者本人；另一位成員的名稱保持原樣，約 5 秒內同步新暱稱。資料版本衝突時請返回設定並重新載入後再試。更改密碼不需要 SQL 更新；若 Supabase 要求重新驗證，請重新登入後再修改。

## 部署為公開網址

已準備 `.github/workflows/pages.yml`，推送至 `main` 分支後會觸發部署流程；需先在 GitHub 啟用 Pages 的 GitHub Actions 來源。

1. 將此專案檔案提交並推送至 `yncerica-hue/us` 的 `main` 分支。
2. 在 GitHub 儲存庫 **Settings > Pages > Build and deployment > Source** 選 **GitHub Actions**。
3. 在 Actions 執行 **Deploy website to GitHub Pages**（若設定已先完成，推送 main 會自動執行）。
4. 工作流程成功後，在 Pages 或該次部署結果取得正式網址，再更新 Supabase Site URL。

工作流程會執行 `npm ci` 及 `npm run build -- --base=/us/`，將 `dist/` 部署到 Pages。需使用自己的網域或不同專案路徑時，調整 `--base`。

也可執行 `npm run build`，將 `dist/` 上傳至 Cloudflare Pages 等靜態網站服務。一般根網域部署不需要 `/us/` base。

## 存取與驗證範圍

資料表開啟 RLS 並撤銷前端直接存取權限，只有登入帳號可呼叫 RPC；RPC 使用伺服器端成員關聯檢查權限，不信任前端提供的 members。邀請碼是加入資格，請勿公開。此版本未提供更換伴侶、刪除帳號、邀請碼輪替或未登入時的忘記密碼介面。

目前完成本機建置、SQL 權限測試，以及以模擬 Auth／本機 SQL RPC 進行的雙瀏覽器操作測試。正式 Supabase 的 SQL 執行、Email 寄送、實際跨裝置同步與公開網址部署，須在上述設定完成後實測，不能以本機測試取代。
