---
status: amended — Tauri 桌面版目標已取消，見文末
---

# 以 TypeScript + Svelte 為單一前端程式碼，輸出離線單檔 HTML，並以 MIT 授權開源為 FairDraw

目前版本是純 Vanilla JS，靠 `build.py` 把 CSS/JS/資源內嵌成一個離線 HTML 檔，這個「免安裝、免連網」的部署模式是現場活動最重要的特性，重寫時必須保留。同時使用者希望除了現有的單檔 HTML，也能提供可安裝的桌面版，並把專案以 FairDraw 之名公開在 GitHub 上供他人使用（MIT 授權，移除所有原始組織的專屬字樣，改為可設定的通用工具）。

選擇 TypeScript + Svelte 作為前端技術：Svelte 編譯後幾乎不帶框架 runtime，bundle 體積接近純手刻 JS，適合繼續維持「單檔內嵌」的打包方式；同時比 Vanilla TS 更好維護狀態同步（畫面隨資料自動更新），比 React／Vue 打包體積更小。桌面安裝版用 Tauri 包裝同一份前端，不需要維護第二套 UI。

考慮過的其他選項：React（生態最大但 bundle 較重）、Electron（比 Tauri 重很多，安裝檔體積差距大）、繼續 Vanilla JS（維護成本隨功能增加而上升）。

單檔 HTML 目標優先於桌面安裝版，先完成前者再視情況做後者。

## 修訂（取消 Tauri 桌面版）

重新評估後決定不做桌面安裝版：單檔 HTML 已經滿足「免安裝、離線、雙擊即用」的核心需求，桌面版能多提供的（工作列圖示、不用記得用 Chrome/Edge 開）相對邊際，但要多維護一整條 Rust/Tauri 建置與發佈流程，且本機當下也未安裝 Rust 工具鏈。Svelte + TypeScript 的技術選型不受此影響（原本就是為了單檔打包考量），僅移除「輸出雙目標」與 `packages/desktop` 這部分範圍。若之後有具體理由（例如需要不受瀏覽器限制的原生檔案系統能力），可以重新評估。
