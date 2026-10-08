## 1. 實作前範圍與驗收協議

- [ ] 1.1 完成提案獨立審查，登錄插入 E12 正式長測前的品質工作範圍、負責人、來源 SHA、精確檔案、回滾與既有重試預算；未批准不實作。
- [ ] 1.2 核對現有 GLB／manifest／來源 .blend 身分與可取得性，指定診斷 evidence 的保管位置與存取範圍；不能取得來源時登錄 BLOCKED。
- [ ] 1.3 在候選取樣前，由獨立 reviewer 登錄 matrix／vertex／握點／FootPlant 誤差、tiny-edge 規則、pose/time、樣本與負例；不得從結果反推較寬門檻。

## 2. 第一個 eligible 實作單位：原因隔離

- [ ] 2.1 重用現有 Web CPU／rig 診斷，核對舊 probe hash 與內容；輸出全部異常區域 edge/triangle/influence 定位，保留 fresh、bind-only、idle、短序列。
- [ ] 2.2 建立同姿勢 Unity full palette、骨架 transform／scale 與 vertex 對照，明示 logic/display mapping，加入已知正常、錯接／跨部位配重與非有限資料的正／負／邊界例。
- [ ] 2.3 分別記錄 topology／weights、程序姿勢與 Unity bridge 原因，證據不足保持 UNKNOWN；以原來源 bind pose 交叉確認，不能只以 shared parity 定案。
- [ ] 2.4 完成本單位必要 tests、可定位 raw evidence、獨立 exact-candidate review 及相應 merge／compatibility 門檻；缺門檻不進入下一實作單位。

## 3. 版本化修復交付

- [ ] 3.1 將已定位需求依 asset-collaboration 契約整理成去敏 packet；指定 mmo-asset-pipeline 工程師、workspace、資料與動作範圍後才送出／製作，否則保持 PREPARED_NOT_SENT。
- [ ] 3.2 只修已確認 topology／weights 原因；交付新 delivery_id、來源／GLB hash、export metadata、technical QA，保留原資產，不新增付費生成或第三方素材。
- [ ] 3.3 若診斷確認另有 runtime 問題，另以 scoped commit 修復；記錄與資產候選的對照，遵守同一問題最多兩輪，不重設已消耗預算。
- [ ] 3.4 驗證 21 骨／命名層級、4 influences、技術預算、root-motion=false、17 招式、tip/tipBase；加入缺骨、非法 weights、載入失敗的負例，確認可見 fallback 且不作品質 PASS。
- [ ] 3.5 審查 delivery／scoped runtime 候選後，只在隔離工作區進入第 4 組品質驗證；第 3／4 組屬同一修復整合單位，完整品質 gate 前不得把資產或 runtime 合併到穩定基準。

## 4. 同版本整合與品質驗收

- [ ] 4.1 鎖定 code/profile/asset/build hashes，在 Web／Unity 帶正式貼圖的實際 render 比較固定正面、背面、左右側；保存連續錄影與 palette／vertex 對照。
- [ ] 4.2 執行 S01／S03：idle、跑停轉身、N1–N6、C1–C6、空中招、格擋反擊、閃避、受傷／倒地、死亡／重試、無雙與握槍／FootPlant 回歸；缺項 NOT_RUN。
- [ ] 4.3 執行 S02 tip/tipBase／命中契約、S06 顯示、S07 fallback／重載與 S08 自然操作回歸；注入／腳本與自然操作分列，取得使用者視覺確認。
- [ ] 4.4 對所有尖三角、跨部位拉伸、裂開或抖動逐項定位；任何可見異常 FAIL，不以 unit／CPU 摘要或單張圖替代品質驗收。
- [ ] 4.5 完成同版本正式獨立審查、已授權合併與 post-merge compatibility；未完成前不標 VERIFIED／ACCEPTED／DONE。

## 5. 返回 E12

- [ ] 5.1 登錄新品質基線與原 E12 量測器／foreground／visible／VRAM／counter blockers、已使用兩輪預算；不將舊短 probe 視為新版本成績。
- [ ] 5.2 經適用 review 與授權後返回 E12，另行完成分級 benchmark／soak；本 change 不勾選 E12 或 E13 為完成，不發布。
