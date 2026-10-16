# 趙雲蒙皮形變修復需求

## 2026-10-16 本地補登核對

- 補登基準：`f490870f998c0bf961d68d3301c98f4a638de26b`；來源為 [fb7e7cd7ab8f116530ca488bb020bcb12be2f557](https://github.com/monkey1sai/changshan-longdan/blob/fb7e7cd7ab8f116530ca488bb020bcb12be2f557/docs/art/requests/cl-zhaoyun-deformation-v1.md)，blob `dcfbbbc4973e9ef82918551329fb5f411cc7410d`，原檔 SHA-256 `8d1afa9e5f9f6bca03b48a32b5a0d01cf46652f673ee785c7241e3603f53a10b`。
- **需求仍為 `PREPARED_NOT_SENT`**：本次沒有送達、接單、製作、新 delivery、資產替換或驗收。維護者與美術工程師的責任敘述不是已完成指派的證據。
- 本次實際雜湊核對：Web `public/models/zhaoyun.glb` 與 Unity `Assets/StreamingAssets/Characters/zhaoyun.glb` 均為下方記錄的 `7dccbfae…`，各 3,706,788 bytes，且與目前 manifest 相符。來源 blend 的 `c8dff5bf…` 與 manifest／[E03 來源表](../../engineering/E03_ZHAOYUN_IMPORT.md#來源核對)一致；**本次未重新取得或驗證原始 blend 檔案**。
- 原需求 worktree 的 `probe.ts` 與 `web-vertices.json` 仍可取得，SHA-256 與下方原紀錄相符；歷史 Player 截圖路徑亦存在。本次僅核對檔案與雜湊，沒有重跑 CPU probe、檢視 GPU 同姿勢或驗證目前 runtime；下方 VERIFIED 僅指該歷史診斷的原有結論。
- 下方「本需求 worktree」及 `release/` 路徑指原 2026-10-07 診斷工作區，不是這次補登 worktree；原件沒有複製進 Git。本文件提供來源索引，不表示新 checkout 已含原始證據。
- 目前製作與整合依[模型資產協作契約](../asset-collaboration.md)及 [Unity follow-up SPEC](../../../openspec/changes/unity-migration-followup/specs/unity-migration-completion/spec.md)。完整修復驗收保留 30/60/120 Hz、握點 p95≤3cm、plant≤5cm、扣除設計位移後 root≤5cm 的原適用窗口，以及 21 骨、17 招式、4 influences、root-motion=false、tip／tipBase、FootPlant、可見 fallback 與雙引擎 render／自然操作／使用者視覺確認要求；本文件不另設或降低門檻。
- [follow-up tasks](../../../openspec/changes/unity-migration-followup/tasks.md) 的送達、修復、驗收與正式 E12 條件維持未完成；本次不勾選項目、不重設修正預算，也不沿用舊版本 PASS。

## 2026-10-07 原始需求紀錄

- request_id：`cl-zhaoyun-deformation-v1`
- 日期：2026-10-07（Asia/Taipei）
- 狀態：`PREPARED_NOT_SENT`。已完成本地診斷與需求整理；尚未委託、製作、交付或驗收。
- 來源：使用者要求插入趙雲破圖異動，回報「肢體拉長、折疊或抖動」。原 E12 目標保留。
- 優先順序：先恢復角色品質基線，再執行 E12 正式效能長測。
- 遊戲整合與驗收：changshan-longdan 維護者／使用者；美術製作：mmo-asset-pipeline 美術工程師，尚未指派。

## 問題與同版本證據

遊戲基準 `be04336f108db76bb75da31e8b68e065eb182307`；資產 `public/models/zhaoyun.glb` SHA-256：
`7dccbfae4b61280889a7be98370692143898c3eeef8dcd55dfa36ad4b4248a33`。

Unity 6000.6.4f1 的 E12 b 實際 Player 畫面可見衣料大片尖三角與拉伸：
`.worktrees/_clones/e12-a/release/e02/e12-b/player/scene.png`，run `0b500855-f098-4ede-b199-c5cbb6c4f152`。
這張靜態畫面未驗證抖動頻率，亦不能單獨定位根因。

另以既有 `scripts/lib/rig-parity.ts::textureFreeGlb`、GLTFLoader、PlayerModel、ZhaoYunSkin，
保留幾何、骨架、配重，只移除 Node 無法解碼的貼圖資料，執行 CPU 頂點比較。
診斷工具與 JSON 暫存於本需求 worktree 的 `release/skin-diagnosis/`，尚未提交：

- 命令：`node --experimental-strip-types release/skin-diagnosis/probe.ts`
- 工具 `probe.ts` SHA-256：`db0b3f3ad92f7fdd7fa7b7d30b89ff1f3379224d57ddb953cabd85fd85d45eaf`
- 結果 `web-vertices.json` SHA-256：`26e6e545a4f90486d1a75865075e22f226cc20922f1d6b230aefbcf73aa4b7ee`
- 27815 頂點；以無向頂點索引去重後量測 52276 條邊；另列 97 條原長小於 0.005 的邊。
  此排除值僅用於穩定診斷比值，不是修復驗收門檻。

| 狀態 | 邊長比 p99 | 最大邊長比 | 超過 4 倍的獨立邊 |
|---|---:|---:|---:|
| 全新匯入，從未套姿勢 | 1（自身基準） | 1 | 0 |
| 建立綁定，尚未 Update | 1 | 1 | 0 |
| 單次 idle Update | 15.622 | 70.922 | 2847 |
| idle 120 個後續 60 Hz 更新 | 17.027 | 88.305 | 2899 |

新匯入時，CPU bind-skinned 頂點與 raw POSITION 的最大差為約 `2.17e-6` mesh-local units；
Bind-only 與新匯入頂點的最大差為 0。此結果不代表原始拓撲或配重品質已驗收。

異常定位：

- 三角形 25204 的邊 `1352→1116`：原長 0.006738765，單次 idle 後 0.477924046。
  前者約 70.8% thigh_r、28.8% calf_r；後者約 39.7% lowerarm_r、39.7% upperarm_r、15.2% pelvis。
  原始兩點位置約 `(-0.4356, 0.7705, 0.1489)` 與 `(-0.4419, 0.7729, 0.1484)`。
- 三角形 14878 的邊 `14801→14876`：一端 cape_02=100%，另一端約 60.3% calf_r、39.6% thigh_r。
- 每個異常階段最嚴重的 8 條邊保留完整索引、原始／變形位置及各 influence；
  尚未輸出全部異常邊與區域標記，製作前需補足定位資料。

**VERIFIED：** Web CPU skinning 也會在 idle 後嚴重拉伸，不能僅以 Unity 矩陣橋接解釋。
**INFERRED：** 配重區域斷界、原始融合／封孔造成的跨部位拓撲、姿勢重定向的非均勻縮放可能共同影響。
**UNVERIFIED：** Unity 全新匯入 A/B/C 完整 palette 與 GPU 同姿勢比較、各問題對抖動的貢獻。
不以這份 CPU 診斷宣稱修復或 GPU 驗收通過。

## 建議製作順序與範圍

1. 在原始檔定位上述頂點及三角形，確認是否存在連接手臂／腿／披風的錯接面。
   核對 `scripts/prepare-zhaoyun.py` 的空間配重分支與對全部 boundary 執行 holes_fill 的影響。
2. 若確認錯接拓撲，先修復；否則直接處理已定位的配重問題。按真正的衣料、肢體區域配重，披風與裙襬使用對應骨頭，
   接縫需連續過渡；保留需要分離的表面。不能以全域平滑配重掩蓋錯接面。
3. 遊戲端另外核對 Unity `CharacterAnimation` 的完整蒙皮矩陣與非均勻縮放。
   若仍有獨立形變，再以新匯入 A／Bind-only B／固定 idle C／短序列 D 分組修正。
4. 產生新的 delivery_id 與 manifest，不覆寫舊資產。先比對畫面與骨架契約，再切換遊戲使用版本。

## 必須保留的資產與玩法契約

- 風格：既有 PS2 風格、趙雲輪廓、比例、配色與使用者自製模型辨識度；不重新設計人物。
- 來源：user-created.blend SHA-256 `c8dff5bf7d43c04040a5f661b64a8702b5bedaf5fb2f69debd10a626dcc901a9`。
  使用權依既有 manifest；來源檔位置待製作端安全核對，不在公開需求嵌入私有路徑。
- 輸出：GLB、既有公尺／座標／原點契約；Web Three.js 與 Unity 6000.6.4f1 都需相容。
- 介面：保留現有 21 個骨頭名稱與層級、SM_ZhaoYun／SM_ZhaoYunSpear、最大 4 influences。
  若拓撲／骨架必須改契約，先提出差異與整合影響，不能靜默更名或增骨。
- 預算：不高於現有 29569 三角形、既有材質數與三張 2048 貼圖；維持 1 LOD、0 authored clips。
  材質不新增，碰撞代理不適用；不改 hit shape、傷害、移動、AI、權威 weapon tip／tipBase。
- 原始檔與 GLB 均須可取得、雜湊可核對；付費生成額度 0，外部上傳／跨 repo 寫入／遠端發布未授權。
  這份需求未送至另一個 chat 或美術 repo。

## 遊戲驗收與失敗條件

- 同資產版本，保存全新匯入／綁定／idle／短動作的矩陣與頂點比較；CPU 比較不能代替實際 render。
- 固定攝影機與光照，比較正面、背面、左右側；實測站立、走跑轉向、N1、連段、格擋、閃避、跳躍、無雙。
- 任何大片尖三角、衣料裂開、肢體跨部位拉伸或持續抖動即 FAIL；數值異常須逐項定位，不能只降低摘要分位數。
- 既有 bone position／grip／weapon tip／tipBase／FootPlant 回歸通過；負面匯入測試仍須顯示 fallback。
- 新版本需工程測試、同姿勢 Web／Unity 實際畫面、自然操作與使用者視覺確認。
  缺失證據保留 NOT_RUN；不沿用舊版本的 E06 或 E12 PASS。
- 角色品質確認後，才重新以新 candidate 執行 E12 分級測試及 soak；未完成前不進入 E13。

## 回滾

保留原 GLB、manifest、原始檔及上述基準 commit。候選資產使用新版本；驗收失敗時維持原鎖定版本，
不覆寫舊證據，不把舊版本標記為已修復。
