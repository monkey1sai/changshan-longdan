# 趙雲角色樣板：現成人體底模 + Blender 改造

## 來源與授權

- 作者：Quaternius。
- 底模：Universal Base Characters，免費 Standard 版本的 Superhero Male。
- 官方頁面：https://quaternius.com/packs/universalbasecharacters.html
- 官方下載：https://quaternius.itch.io/universal-base-characters
- 授權：CC0 1.0；原包內文字保存在 `QUATERNIUS-LICENSE.txt`。
- 下載日期：2026-09-29。
- 原始 Standard ZIP SHA-256：`FDBF1804C90DFC1EA03E992BFF7DA2DFD1A79318E13270A660180F9308455F40`。
- 整理後 `quaternius-base.glb` SHA-256：`5F4F2AC5B2496B0F1EC6C1879E7FD98A0B814830F8A78833894E20E61EB71A5B`。

免費包只包含部分角色；沒有購買 Source 版本。`zhaoyun.blend` 是本專案從免費 glTF 匯入後自行建立的編輯檔，不是付費版原始檔。

## 檔案

- `quaternius-base.glb`：保留原人體、五官、手指、65 骨骨架與蒙皮的自包含底模，供重建使用。貼圖縮至 1024，移除骨骼顯示用輔助物件。
- `zhaoyun.blend`：Blender 4.5.5 LTS 可編輯檔；盔甲、領口、甲片、裙甲、護脛、頭盔與長翎都在這裡。
- `../public/models/zhaoyun.glb`：遊戲載入的單一檔案，貼圖全部內嵌；29,202 三角面、4,993,552 bytes。槍和披風另由 TypeScript 生成。
- `zhaoyun-stats.json`：生成統計。
- 原始大包與解壓快取被 Git 忽略；正常重建不需要它們。

## 重建

在 repo 根目錄執行（不需要安裝 Blender 外掛，也不需要網路）：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 4.5\blender.exe' --background --factory-startup --disable-autoexec --python scripts/build-character.py
npm test
npm run build
```

`scripts/prepare-character.py` 只供第一次從免費包整理底模。它讀取 `art-source/quaternius/Superhero_Male_FullBody.gltf` 和該 glTF 引用的 `.bin`、貼圖；若來源包的圖片名稱帶 `_png` 後綴但實際檔名沒有，須先按 glTF URI 複製相應原圖。平常直接使用已保存的 `quaternius-base.glb`。

直接在 Blender 修改 `.blend` 後，請同步修改重建腳本或明確改用人工資產流程；重跑腳本會覆寫生成的 `.blend` 與 GLB。

## 遊戲接合

`PlayerModel` 保留原姿勢、雙臂 IK、槍尖和刀光座標；`CharacterSkin` 將視覺骨架對應到既有驅動器。原始體素模型在 GLB 載入和骨架驗證完成前保留，載入失敗會回退；`__game.state.character` / `characterError` 可辨識回退，不能將回退視為精細模型載入成功。

本階段不改戰鬥規則、敵兵、地圖或後製。這是風格化角色樣板，並非寫實人物或三國服飾考據成品。

## 驗證與影像

開發用 `/character.html` 提供新舊模型對照、臉部近看及六種動作預覽。它不加入預設遊戲正式建置。

單元測試會解析實際 GLB 的幾何與骨架，遍歷全部招式，檢查蒙皮數值及槍尖座標未變，另測失敗回退。Node 不解碼圖片；貼圖、可見瀏覽器手感與 GPU 表現必須另外驗收。

需要離線補充影像時：

```powershell
$env:CHARACTER_EVIDENCE = '1'
npm test
& 'C:\Program Files\Blender Foundation\Blender 4.5\blender.exe' --background --factory-startup --disable-autoexec --python scripts/render-character.py
Remove-Item Env:CHARACTER_EVIDENCE
```

輸出在 `artifacts/character/`；這些是執行期蒙皮幾何的 Blender 離線渲染，不等同瀏覽器畫面。
