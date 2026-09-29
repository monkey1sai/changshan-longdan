# 可替換視覺資源

本次工作以雙地圖分支為基礎，整合既有趙雲模型；只重構視覺接線，不改 combat/entities 的規則、不發布。

入口為 `src/assets/`、`src/main.ts` 與 `src/game.ts`。玩家、敵人、武器、場景與特效的資源供應者由資源包注入；素材失敗時保留程序模型。碰撞仍以 `world/levels.ts` 與 `world/layout.ts` 為準。

驗證路徑：先執行既有 Vitest 基線，再測資源替換、錯誤回退、骨架與動畫接合，最後 typecheck/build 與可見瀏覽器雙地圖驗證。不得以單元測試替代畫面驗收。

## 使用入口

`src/main.ts` 將 `createAssetPack()` 的結果傳給 `new Game(canvas, pack)`。
Game 只使用視覺合約，不知道 GLB 路徑、骨頭名称或敵人部件名稱。
每個 Game 取得新的視覺實例，不能在兩個 Game 之間共享同一個 Object3D。

| 類別 | 替換入口 | 保留的規則 |
| --- | --- | --- |
| 人物 | `player.character.path`、`rig`、`materials` | 玩家狀態、血量、攻擊判定 |
| 人物動畫 | `player.animation.sample(player, out)` | 依遊戲時間取樣，不以動畫事件施加傷害 |
| 武器 | `player.weapon.model`、握點、刀光端點、`createFallback` | 傷害、攻擊範圍仍在 combat |
| 敵人 | `enemies.model.path`、8 個具名部件 | 300 人 AI、受擊閃光、死亡與批次渲染 |
| 敵人動畫 | `enemies.animate(store, index, time, pose)` | 修改視覺姿勢，不修改 EnemyStore |
| 城池／宅邸 | `worlds.fortress`、`worlds.manor` | layout/levels 的碰撞、出生點與敵人配置 |
| 材質 | 各模型的 `materials`，以材質名稱或 `*` 匹配 | 原 GLB 中的 PBR 貼圖保留 |
| 特效 | `effects` 各類別工廠 | `clear/update` 與原事件呼叫合約 |
| 龍 | `dragon.head`、`dragon.createSegment` | 龍的路徑、持續時間與打擊判定 |

這個版本把現有程序動畫設計成可替換供應者，**不會自動播放 GLB animation clips 或自動重定向任意骨架**。同規格造型可以替換模型檔；換骨架要更新 rig，換動作要替換 animation 供應者。不同體型、非人形或不同武器類型仍須專用 adapter。這是相容性邊界，不是已完成任意模型轉換的承諾。

## 範例：另一個美術包

下列路徑為示例，必須先提供素材；預設包只使用已隨庫提供的趙雲模型。

```ts
import { createAssetPack } from './assets/default-pack.ts'
import { LONGDAN_SPEAR, QUATERNIUS_RIG } from './assets/character.ts'

const pack = createAssetPack({
  id: 'my-art-pack',
  player: {
    character: {
      path: 'models/my-hero.glb',
      rig: QUATERNIUS_RIG,
      materials: { Armor: { roughness: 0.25, metalness: 0.8 } },
    },
    weapon: {
      ...LONGDAN_SPEAR,
      model: { path: 'models/my-spear.glb' },
      tip: 2.7,
      trailBase: 1.25,
    },
  },
  worlds: {
    fortress: { path: 'models/fortress.glb' },
    manor: { path: 'models/manor.glb' },
  },
})
new Game(canvas, pack).start()
```

所有路徑相對於 `public/`，不要加 `public/`、起首 `/` 或外部網址。載入器會加上 Vite 的 `BASE_URL`，保留 itch.io 子目錄相容性。建議 GLB 內嵌貼圖；外掛壓縮、DRACO/KTX2 解碼器尚未配置。

## 建模合約

### 共通

- 單位為公尺，+Y 朝上、+Z 朝前；在建模工具套用旋轉／縮放。
- 模型自身需要包含 UV、法線與所需貼圖；單純提高渲染解析度不會補出素材細節。
- `materials` 支援 color、roughness、metalness、emissive、emissiveIntensity。具名設定優先於 `*`。
- pack 層級的 `materials` 作用於程序回退模型；GLB 的覆蓋設定放在各自 ModelAsset，避免非同步載入時遺失設定。
- 不允許材質或動畫 adapter 修改 combat/entities 狀態。TypeScript 的 readonly 是使用合約，並非執行時沙箱。

### 玩家

- 預設映射位於 `src/assets/character.ts` 的 `QUATERNIUS_RIG`。
- 每個主要骨頭都必須存在且肢段長度非零。指骨可透過 `fingers: []` 停用握拳處理。
- 現行 adapter 的標準肢段為上臂 0.32m、前臂至手掌 0.25m、大腿 0.46m、小腿 0.42m，沿用既有 IK。不能假定任意比例或任意骨軸均適用。
- `character: null` 使用程序人物。角色、武器分別載入，人物失敗不會阻止武器載入。
- 當前披風使用既有 Verlet 鏈生成；要完全不同的身體／披風驅動器，可替換 `AssetPack.createPlayer`，保持公開合約。

### 武器

- 模型原點是武器驅動器原點；+Z 是槍身前向。
- `gripRight` 為右手在槍軸上的位置；`gripLeftRange` 是相對右握點、容許左手 IK 沿槍身滑動的區間。
- `tip`、`trailBase` 只控制刀光取樣；它們不會增加戰鬥射程。
- 武器 GLB 替換後沿用既有握持動畫；全新武器類型要另外提供姿勢供應者與玩法設定。

### 敵人

使用 rigid parts 以保留 8 個 InstancedMesh。GLB 必須提供以下具名角色：

```ts
enemies: {
  model: {
    path: 'models/my-enemy.glb',
    parts: {
      legs: 'Leg', arms: 'Arm', torso: 'Torso', head: 'Head',
      spear: 'Spear', sword: 'Sword', shield: 'Shield', plume: 'Plume',
    },
  },
}
```

每個部件是單一 Mesh、單一 MeshStandardMaterial，沒有 skin；幾何座標直接以該肢段 pivot 為原點。左右臂／腿共用幾何；位置與轉角由批次動畫給定。部件名稱可配置，不必沿用示例。
這個批次路徑不接受一整隻蒙皮 GLB：要使用完整蒙皮人群需另寫 `createEnemies` adapter，並量測 300 人的 CPU/GPU 預算。

### 場景

城池與宅邸可以各提供 GLB，坐標必須對準現有 layout。載入成功後才隱藏該場景的程序外觀；地圖切換重用已建立的視覺，不重複載入。
城池的火與旗仍是獨立動態系統，替換的模型不得重複畫同一組火旗。宅邸 GLB 取代整組程序場景，包含原來的人物裝飾；新模型若需要動態人物，應提供自訂場景工廠。
新增建築、挪動牆壁或改走道不是純外觀替換：必須改 layout/levels 並新增碰撞測試。

### 特效與動畫

特效有不同資料形式：刀光是歷史軌跡、火花是粒子、龍是沿路徑批次幾何。它們不能全用單一 GLB 表達。
透過 `effects.trail`、`effects.sparks` 等工廠換實作；介面在 `src/assets/pack.ts`。特效回呼沿用遊戲事件，不以粒子相交回寫傷害。
`dragon.head` 可直接換頭部 GLB；`createSegment` 提供單位盒範圍內的身段幾何。其他龍造型可換整個 `effects.dragon`。

## 回退與資源生命週期

- `ModelSlot` 的狀態是 procedural、loading、ready、fallback，錯誤保存在 error。
- 原模型在載入與驗證完成前保持顯示；空模型或載入失敗不能移除回退。
- `ModelSlot.dispose()` 釋放該 slot 擁有的幾何、材質與貼圖。釋放後才完成的請求也會釋放，不重新掛回場景。
- 每個模型載入實例擁有資源；目前未實作跨 Game 的 GLTF 快取或整個 Game 的卸載。這個版本適用於頁面生命週期內的一個 Game，並以重新載入頁面切換資源包，不宣稱支援運行中熱換包。
- DEV `window.__game.state.assets` 顯示所選 pack、人物、敵人及場景載入狀態。正式版不提供 debug hooks。

## 本輪證據（2026-09-29）

- 基準：`codex/isekai-season-one` 的 `6413114`；整合 `dfc5290` 的角色 runtime、GLB、授權與測試。未合併發布分支或修改遠端。
- 基線：15 個測試檔、97 個測試通過。
- 資源介面接線後：TypeScript 檢查通過；`npm run build` 通過，61 modules。
- 新測試初跑：108 個測試，106 通過、2 失敗。兩個新增測試將初始狀態誤寫成 idle；已改為比較視覺更新前後狀態不變。
- 使用者同意限定驗證後重跑：16 個測試檔、108 個測試全部通過；`npm run build`（含 TypeScript）通過。
- 可見 Chrome 本機驗證：`scripts/verify-assets.mjs` 通過。城池 → 月影宅邸 → 城池皆重新建立 300 人戰局，人物狀態 ready，鍵盤移動／普攻／選關／無雙成功，無 browser console error 或 pageerror。無雙充能由 DEV hook 提供，觸發使用真實鍵盤。前景 60 幀平均 16.6667ms；僅為單一機器的短時間樣本。
- 截圖與 JSON：`C:/Users/IOT/.codex/visualizations/2026/09/29/01a0ec87-3a2e-7c23-9264-fb3d94a5b513/asset-validation/`，`assets-browser-report.json` 的 passed 為 true。
- Vite 日誌另有 `THREE.WebGLProgram`／`warning X4122` 浮點精度警告；它不是 browser error，截圖未觀察到對應破圖。本次沒有進行跨 GPU shader 相容性測試。
- 環境阻擋：`helper_sandbox_lock_failed`；獨立唯讀 reviewer 的升權重試在使用者同意後仍遭自動核准拒絕。因此獨立審查未執行，不能視為無發現或通過。
- 尚未完成：獨立共享合約審查。沒有新高清場景或新敵人美術素材，未上架。

恢復點：沙箱恢復後，先完成本工作樹的獨立 diff 審查；如果審查要求修正，再執行受影響測試與瀏覽器驗證。所有缺口關閉前不得將重構標記完成。這次瀏覽器證據只屬本機開發版本，不是線上部署驗證。
