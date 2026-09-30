# 常山龍膽：開發環境初始化

本文件補充既有 `README.md` 與 `AGENTS.md`，不重建遊戲、不改玩法或 itch.io 發布設定。

## 本機 Windows / WSL / Linux

在儲存庫根目錄執行，使用 Node.js 22（最低 22.12）；`.nvmrc` 固定主要版本，`package-lock.json` 固定專案套件。

```sh
node --version
npm ci
npm run check
npm run dev
```

`npm run check` 依序執行既有 Vitest、TypeScript 型別檢查與 Vite 建置；任何一步失敗即停止。遊戲預設開在 `http://localhost:5173`。Node 24 / 26 的原有支援宣告不變，本次環境及 CI 基準先採 Node 22。

`npm ci` 會重建 `node_modules`，不應用來保存手動修改的套件。它不應更改 lockfile；若報 lockfile 不一致，先查明原因，不要直接刪除 lockfile。

## Dev Container / Codespaces 設定

`.devcontainer/devcontainer.json` 使用官方 Node 22 Bookworm 開發映像、非 root 使用者，建立環境後只安裝依賴，不自動啟動遊戲。

本機可在 VS Code 開啟儲存庫後執行 **Dev Containers: Reopen in Container**。Codespaces 應選擇含本次設定的分支；建立雲端實例可能消耗帳戶額度，請先自行確認費用。提交此設定不代表已建立或測試 Codespace。

容器內啟動時固定使用已轉發的連接埠：

```sh
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

連接埠維持私人存取。不要把 Vite 的 `allowedHosts` 設為 `true`；若遠端代理拒絕主機名稱，僅允許該環境的確切主機名稱，不開放任意網域。遊戲實際 WebGL 渲染仍在使用者的瀏覽器，不保證雲端主機有 GPU。

## 自動檢查與手動驗收

`.github/workflows/ci.yml` 在 Windows / Linux 執行鎖定安裝、`npm run check`、itch.io ZIP 打包驗證以及 tracked-file 乾淨檢查。它不部署、不發布 release，也不上傳到 itch.io。

測試與 build 通過不代表已驗證畫面、手把或操作手感。合併前請在可見瀏覽器確認：進入戰鬥、移動、普攻 / 蓄力、防禦、暫停恢復、中英切換及結果畫面。既有 `scripts/verify-experience.mjs` 的使用方式仍依 README；未執行就不可宣稱已完成視覺或效能驗證。

AI agent 先讀 `AGENTS.md`，保留 `base: './'`、既有程序素材與授權檔，不新增 API key、付費服務或自動發布動作。
