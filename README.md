# FairDraw

離線的活動現場抽獎工具：匯入 Excel 名單與獎項、用密碼學安全亂數抽選、留下可查核的得獎紀錄與備份。正式使用只需要打包出來的單一 HTML 檔，不需要安裝任何程式、也不需要連網。

## 這是誰在維護

FairDraw v2（本目錄下的 `packages/*`）是從一份內部工具（原始組織的內部抽獎工具 v1.0）重寫而來的通用開源版本，移除了原本寫死的組織品牌與文案，改成可自行設定活動名稱、副標與規則。`packages/examples/sample/` 保留了一份範例 Excel 設定，僅作為範例，不是預設值。

重寫過程的關鍵決策記錄在 [`CONTEXT.md`](./CONTEXT.md)（領域詞彙表）與 [`docs/adr/`](./docs/adr/)（架構決策紀錄），想了解「為什麼這樣設計」可以先看那裡。

## 專案結構

```
packages/
├── core/       純函式的抽選/驗證邏輯（人員與獎項驗證、安全抽樣、作廢補抽、備份自我驗證），無 DOM 依賴
├── xlsx-io/    Excel 讀寫（基於 SheetJS），對外只暴露表格陣列格式
├── app/        Svelte 5 + Vite 前端，打包成單一離線 HTML
└── examples/
    └── sample/ 範例活動設定（Excel 範本），僅供參考
```

## 開發

需要 Node.js 20+ 與 pnpm。

```sh
pnpm install
pnpm -r test          # 跑全部套件的測試（core 15 項、xlsx-io 4 項）
pnpm --filter @fairdraw/app dev     # 本機開發伺服器
pnpm --filter @fairdraw/app build   # 打包成單一離線 HTML，輸出於 packages/app/dist/index.html
pnpm --filter @fairdraw/app run check   # 型別檢查（svelte-check）
```

`packages/app/dist/index.html` 就是正式使用的檔案：存到會場電腦，用電腦版 Chrome 或 Edge 開啟即可，不需要伺服器、不需要安裝 Node.js，也不會連網或上傳名單。

## 維護提醒

- 修改抽選邏輯（`packages/core`）後，必須重跑測試（`pnpm --filter @fairdraw/core test`）並重新演練；這些測試是唯一的正確性回歸基準。
- 正式活動不可修改原始碼或 JSON 備份以指定中獎者、無紀錄地換人或回溯抽獎；作廢是不可復原的刻意設計（見 [ADR-0003](./docs/adr/0003-void-is-irreversible.md)）。
- 姓名球動畫是視覺表現，抽選一律使用完整合格名單，不依球面當下可見文字抽選。
- 不要把個資、雲端端點或真實名單寫入程式碼或範例資料。
- 本工具不提供多台電腦即時同步、帳號權限、照片匯入或伺服器端防竄改；本機操作紀錄是實務留痕，不是防竄改公證。

## 授權

MIT，見 [LICENSE](./LICENSE)。
