## 進度回報與最終完成契約

每次完成／受阻交付都回報已完成項目數／22、百分比、本次完成項目、剩餘gate與下一個eligible步驟。現在3/22（13.6%）只是任務計數，不代表遊戲工程品質或工作量比例。只有task本身約定的條件完成才勾選，不因文件格式、CI或Jev回應通過而勾選未驗收工程。

使用者要求最終可見打開Unity、用Jev執行遊戲並通過全部必要測試，並於2026-10-08確認「Jev選擇，Unity工具執行」。按現有Jev Choice配置，由Jev支援選擇、已授權Unity/Player executor實際執行；缺executor時記UNAVAILABLE，不自行宣稱滿足。最終5.2/5.3全部證據與gates齊備且22/22後才能稱SPEC completed；必要FAIL/UNKNOWN/SKIPPED/NOT_RUN均阻擋。

## 1. 第一個 eligible 單元：新證據與能力方案

- [x] 1.1 核對最新base／E11與E12候選diff、歷史限定接受及formal缺口；指定單元負責人、reviewer、V/S、允許檔案與回滾，使用STEP_RECORD，未審查不實作。證據：docs/engineering/UNITY_E12_CAPABILITY_STEP_RECORD.md A/B。
- [x] 1.2 保存既有601frame／15sample／0valid的raw與hash，記錄已用兩輪；取得新的VRAM時鐘語義／counter身分定位證據，不改validator門檻。證據：UNITY_E12_CAPABILITY_PLAN原生同instance對照及raw索引；只完成本機觀察來源定位，不代表指定Player freshness。
- [x] 1.3 提出camera-specific visible、前景、timing alignment／去重／收尾、記憶體對齊及量測成本方案；未知項保持BLOCKED，取得独立方案審查與新範圍批准，不重設原budget。證據：UNITY_E12_CAPABILITY_PLAN M1–M7/M2-T與STEP_RECORD「Task1.3方案退出」；使用者同意下一步並明確接受M2-T工程量測定義，獨立方法審查接受成本對照修正。runtime仍NOT_RUN，task1.4 gate未齊不得開始unit2。
- [ ] 1.4 完成本單元必要確定性驗證、raw evidence、exact-head review；需要提交合併時走正式approval／merge授權／postmerge gate後，才開始第2單元。

## 2. 量測能力工程（可於美術等待期間進行）

- [ ] 2.1 按已審查精確範圍重用E12候選，修正timestamp／Player身分／counter語義；加正常、錯category、錯unit、stale/future、PID重用、倒退／重复／missing負例。
- [ ] 2.2 補足foreground／focus／minimized、四種敵數與真正visible來源；驗證遮擋、螢幕外、其他camera與失焦負例，明列instrumentation成本。
- [ ] 2.3 完成delayed CPU/GPU逐幀identity、latency／去重／收尾與每秒記憶體對齊；測缺樣、重複、不連續、warmup邊界及最終延遲樣本。
- [ ] 2.4 執行工具tests、Unity compile/Edit/Play/build/Player及短CAPABILITY_PROBE，保存完整build payload、raw和actual readback；不用短probe宣稱正式成績。
- [ ] 2.5 完成獨立exact-head正式review、該單元授權merge與postmerge確認；能力或必要證據不齊停止，禁止進正式E12。

## 3. 美術交付與Unity整合單元

- [ ] 3.1 核對既有修復需求、工程師／workspace／來源blend／packet／傳輸範圍，按協作契約送達才更新PREPARED_NOT_SENT；本次spec不替代送達證據。
- [ ] 3.2 接收美術新delivery_id、來源／GLB hashes、匯出及QA，保留原資產；來源或契約不符保持BLOCKED，material count以實際GLB盤點。
- [ ] 3.3 在隔離工作區匯入並驗證21骨／4 influences／17招／tip/tipBase／FootPlant／root-motion／fallback；若確認Unity bridge原因，另scoped commit處理，不接管資產製作。
- [ ] 3.4 在同code/profile/asset/build版本跑S01/S03/S07與S02/S06/S08，雙引擎正式貼圖render、固定角度、連續動作及自然操作；沿用30/60/120Hz與既有grip/plant/root門檻。
- [ ] 3.5 取得使用者視覺確認、正式exact-head review、授權merge與postmerge；資產和runtime完整品質gate之前不合併穩定基準，不標ACCEPTED。

## 4. 正式E12分級與長測

- [ ] 4.1 第2與第3單元完成後，鎖定固定品質資產、code/profile/full-build hashes、硬體／driver／Player readback、合法workload與峰值、成本對照、跑前memory budgets與review。
- [ ] 4.2 跑20人seed7/11/23，每次30秒暖機＋180秒採樣，全部必要指標與回歸通過才升級；失敗或unknown保存raw並停止。
- [ ] 4.3 依序跑50、100、200、300人同協議，每級獨立退出；不跳過失敗級、不看完結果再降門檻。
- [ ] 4.4 完成30分鐘soak、memory drift/slope與S01/S02/S03/S06/S07回歸，保存wall／CPU／GPU／draw／GC／RAM／VRAM和峰值證據。
- [ ] 4.5 完成正式獨立review、已授權merge、CI與postmerge相容性；全部齊備才登錄E12 DONE，不倒填舊probe。

## 5. E13凍結整合與可玩版本

- [ ] 5.1 E12 DONE後凍結單一Windows候選與完整包hash，列明保留Web、場景佔位與所有歷史缺口，禁止拼接不同SHA PASS。
- [ ] 5.2 可見打開凍結候選的指定Unity project，保存Editor/版本/操作證據；按已確認Jev語義記錄狀態/Choice/outcome及實際executor。另從同版輸出Windows包執行完整S01–S08與四難度自然勝敗／重試／暫停／失焦、音效與實體手把；Editor開啟與腳本支持證據不能替代輸出包/自然操作，全部必要測項同版PASS，缺項NOT_RUN並阻擋。
- [ ] 5.3 取得使用者體驗確認、正式獨立APPROVED、授權merge與postmerge；工程DONE與發布分列，不自動上傳itch／付費／部署。
