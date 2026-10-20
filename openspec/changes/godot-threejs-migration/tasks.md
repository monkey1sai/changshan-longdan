# Godot 直接移植 Three.js：進度與 gate

> **核准路由導入候選，尚未生效**：[政策](../../../docs/governance/INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_POLICY.md)標示 `ADOPTION_CANDIDATE_NOT_EFFECTIVE`。本清單下文「正式APPROVED／正式核准」在未合法啟用、scope外或activation未知時仍指原正式要求，缺項HELD；只有依法定當時有效規則啟用且屬明確scope，才可採政策完整契約下的獨立審查接受＋人類owner精確核准。GitHub實際review、必要人類／專項、平台較嚴門檻及當次操作授權分列，不自批、不回填歷史。此修訂不勾任何task、不標G00 DONE、不解鎖G01。

以本清單 20 項 task 計數，每次交付報 completed/20、百分比、本次成果、未齊 gates 及下一 eligible；比例不是品質／工作量百分比。原 Unity 3/22 是歷史，不納入此計數。G00 尚未 DONE；G01 實作必須等 G00 正式 review、授權 merge、post-merge 與清理。規劃與唯讀盤點不等於執行下一期。

## 1. G00 引擎決策與移植契約（當前單元）

- [x] 1.1 記錄使用者設計／平台批准、來源 SHA、來源／資產保全、已有失敗及已用預算；取得獨立開始前範圍審查並寫 STEP_RECORD。
- [x] 1.2 更新 Godot ADR／AGENTS／README／舊路線歷史通知、新 SPEC／設計與 G00/G01 計畫，保留 S01–S08、所有數值及人類／formal gates，完成 OpenSpec strict、連結、歷史內容／runtime 未變與秘密檢查。
- [ ] 1.3 形成精確候選 SHA，取得獨立最終審查／正式 APPROVED，保存可讀產物與同版本結果；advisory 不當正式批准。
- [ ] 1.4 取得明確 push／PR／merge 授權後核對遠端合併、post-merge 相容性、證據備份及本任務 worktree 清理；G00 DONE 才開始 G01。

## 2. G01 同版 Windows／Web 工具鏈

- [ ] 2.1 G00 DONE 後取得 scoped review、版本／template 固定官方來源與 checksum／hash、必要下載授權，鎖硬體及環境，缺來源／模板不以 CLI 存在過關。
- [ ] 2.2 在 godot/ChangshanLongdan 建最小 GDScript／Compatibility 工程、runner 及最小測試；正例與缺 exe／錯版／缺 template／timeout／缺報告／零測試負例通過。
- [ ] 2.3 實際匯出 Windows x64 與 single-thread Web index.html／ZIP，驗完整 payload、前景啟動／正常關閉及 localhost 子路徑／iframe、WASM MIME、renderer／設定讀回，保留 raw evidence；空場景不算 gameplay。
- [ ] 2.4 完成原 Web 回歸、同 SHA 正式獨立 APPROVED、具體授權遠端 merge、post-merge 與清理，才 G01 DONE。

## 3. G02 一招對一敵的可玩切片

- [ ] 3.1 G01 DONE 後 scope review，鎖原 GLB／manifest／來源 hashes，驗 Godot 座標／朝向／骨架／tip/tipBase、可見 fallback 及原始缺陷；修復需求依美術協作，不重生替身。
- [ ] 3.2 移植移動／鏡頭／輸入時鐘、N1 對一敵、傷害／受擊／事件與局部 castle setup；TS 對照、30/60/120Hz 正負邊界及原位移權威通過。
- [ ] 3.3 兩平台前景可玩、鏡頭／持槍／音訊初步時序及代表性成本，保存 render／連續動作／自然輸入，明列未完成玩法及原缺陷，不稱 300 兵達標。
- [ ] 3.4 完成同版證據、使用者適用視覺確認、正式獨立 APPROVED、授權遠端 merge、post-merge 與清理，才 G02 DONE。

## 4. G03 完整玩法與呈現

- [ ] 4.1 G02 DONE 後 scope review，移植全部17招、取消／緩衝／防禦反擊／無雙／受擊／去重、AI／SoA／Director／四難度與完整300兵 setup，原 TS fixtures、1/5/20人、30/60/120Hz 正負邊界均通過。
- [ ] 4.2 移植原城池／程序士兵／動畫／鏡頭與cutaway／VFX／音樂音效、中英 UI／字型／三出陣入口／結果／重試／暫停／失焦及鍵鼠／手把；兩平台驗 S01–S04／S06–S08，資產品質不得借 fallback 過關。
- [ ] 4.3 驗 Web iframe／子路徑、音效解鎖／fullscreen／storage拒絕／focus及背景切回，Windows及Web自然勝敗／使用者視聽確認，保存同版本完整 trace／render／影片與明確缺口。
- [ ] 4.4 完成原 Web 相容性、同 SHA 正式獨立 APPROVED、授權遠端 merge、post-merge 與清理，才 G03 DONE。

## 5. G04 雙平台品質／效能與凍結交付

- [ ] 5.1 G03 DONE 後審查固定品質／合法 workload、硬體／driver／code/profile/assets/full-build hashes、各平台 timing／memory／真正 visible／前景來源與工具成本；未知維持 BLOCKED，Web或非.NET mapping變更必須先正式審查及人類批准。
- [ ] 5.2 依 SPEC 原門檻跑兩平台20/50/100/200/300，每級seed7/11/23暖機30s＋採樣180s，各級通過才升級，完成30min soak與回歸；保留raw及失敗，不降門檻或借別平台數據。
- [ ] 5.3 凍結單一版本，實際可見開啟 Godot project，Windows包及Web包完整S01–S08、四難度自然勝敗／重試／暫停／失焦、實體手把／聽感及使用者確認；若沿用Jev須另核對授權與實際executor/outcome，不把Choice當PASS。
- [ ] 5.4 完成正式獨立 APPROVED、授權遠端 merge、post-merge 相容性／證據保全／清理及兩平台包交付才 Godot 移植 DONE；公開 itch 上傳／部署／付費另授權。
