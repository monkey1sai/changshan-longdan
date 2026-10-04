# E02 隔離工程與受阻驗證紀錄

日期：2026-10-04（Asia/Taipei）。`stepVerdict: BLOCKED_ENVIRONMENT`；`nextStepAllowed:false`；`implementationPr:null`；`mergeSha:null`；`releaseOrPaidActionPerformed:false`。

## A. 範圍與授權

- 前置 E01 限定 DONE，起始 main `8932ee47b1e902c1d858b9f1b4a1733657c04a8a`，準備候選 `45d763b9660a72f386a873a99db6bdeb9069b06d`；規格 PR #8 固定 head `389a9a657edbdc94da18c7bdb75d62081787b54d`。
- 使用者核准「方向 1，核准 ADR 與固定官方套件下載」；[決策原文／Envelope](./E02_DECISION.md)。允許本機最小工程、必要固定官方相依、驗證與本機 commits。沒有 E02 push／PR／CI dispatch／merge／發布、付費、新 Editor／平台或 E03 玩法／資產移植授權。
- 變量 V09／V10／V12；S05／S07／S08 僅工程／平台前置，不給 gameplay scenario PASS。Web source、相依 lock、Vite／itch 路徑與原 GLB／manifest 保留。
- 協調者負責 source；獨立 `/root/e02_engine_review` 開始前 advisory `CONDITIONAL PROCEED`。configured dispatch Astra/high；actual runtime 沒有獨立讀回，不當成 formal GitHub APPROVED。

## B. 交付物與環境

已建立 `unity/ChangshanLongdan`、固定 ProjectVersion／manifest／17 項 policy／實際 packages lock、C# settings／build 入口、9 Edit Mode cases、1 Play Mode case 與空場景 boot／capture source。[runner 與重現 README](./E02_UNITY_VALIDATION.md)提供真正 Editor／Test Framework／Windows Player 命令；上述 C# 原始碼尚未完成實機編譯，沒有可啟動 build。

工程不含新角色或遊戲美術，scene／URP assets 由已建立的 Configure 入口生成。共享授權故障前 Editor 產生的 20 個 default settings 是未配置的 partial outputs，已逐檔 SHA-256 保存到 `release/e02/import-20261004-cdn-verified/partial-default-settings/`，不作已接受設定提交；原 `ProjectVersion.txt` 和 lock 保留。

固定 Editor `6000.6.4f1 / 12bfff696524`，exe SHA-256 `eaba9cb7a7fcfa922c439bf85e60a4e5c3e58215a14cdb53e820d1e9c0ad638f`。Windows 11 Pro；i5-13500／RTX 4060 Ti／63.75 GiB；driver `32.0.15.8097`。1920×1080、renderScale 1、Linear、D3D11、Mono、60 cap／VSync 1 是固定候選，沒有 effective settings／效能 PASS；VRAM、input-to-photon 未知。

最終 candidate SHA／完整 source hashes／測試 bytes 一致性寫入 ignored `release/e02/engine-foundation-20261004/candidate.json`，避免自我引用 SHA。原始產物 local_only，沒有對外上傳。

## C. 實際驗證

| 項目 | 觀察結果與限制 |
|---|---|
| ADR | ACCEPTED；只接受架構／下載範圍，非 implementation approval |
| 套件來源 | 實讀 Editor BuiltInPackages URP 17.6.0／TF 1.8.0；14 個必要 builtin＋3 個 registry package 的 lock 政策核對通過；不是 C# import PASS |
| 固定官方 archives | Profiling Core 1.0.3、Searcher 4.9.5、Mono Cecil 1.11.6；實讀官方 302 的精確 Unity CDN，SHA-1 對照官方 metadata，保存 SHA-256／manifest／archive cache |
| runner checks | Node／filesystem／真正 XML parser 的合成正負例；缺 exe／錯版、scope、額外 registry／package、root motion、junction、缺欄位、零／失敗／skip XML、來源變更均須拒絕；最終數量／原始 exit 見 candidate 紀錄。不是 Unity tests |
| Web | 22 files／227 tests、TypeScript／build／itch package PASS；3,014,494 bytes，SHA-256 `79fd2220cad31e29ef0a47d4dfb778d3bd177758514637b09a013aabf444c871`，與 E01 相同；未重跑已耗盡的 E01 GPU round，沒有上傳 |
| 真實 compile attempt | 被測 code SHA `73272ae8dc06693ed6d3cc8d80ee1f0537971188`；runId `16b83c0e-ebda-4ae6-a667-a42dc662251a`；Editor 10:01:12 至 10:06:09（+08:00）；ENVIRONMENT_FAILURE，沒有 compile report |
| Edit Mode／Play Mode／Windows build／Player／PNG | NOT_RUN；前一階段未通過。不能把 Node checks 或 default settings 當作替代 |
| 新 checkout | 只可驗證 source／工具與唯讀 preflight；真正 Unity stages 尚未成功重現 |
| CI／formal review／merge／post-merge | NOT_RUN；沒有 E02 遠端操作授權，不沿用三個歷史固定 PR 的例外 |

保留失敗：首輪 Node checks 51／52，fixture 的路徑末尾分隔符造成 mismatch，修正後通過。第一個 download attempt `fetch failed`，沒有 Unity 啟動；以已驗 HTTPS 方法的修正遇到官方 302，仍未啟動；唯讀實讀 Location 後限定 checksum-addressed Unity CDN，三包成功。沒有換版本／registry 或降低門檻。這些是工具／網路問題，不是 gameplay failure。

真正 Editor attempt 的原始錯誤：

```text
Connection to channel LicenseClient-jacks refused
Licensing initialization failed after 74.83s
Failed to acquire global mutex Unity-LicenseClient-jacks.
Another instance of Unity.Licensing.Client is already running.
```

授權 entitlement 未驗證；上述證據只證明共享 IPC／mutex 故障，不推論使用者身分或付款問題。主控重新核对 UUID／project／固定 exe／父 Node 42488，只停止本次 Editor 37816；Editor exit `4294967295`、runner exit 2、`timedOut:false`，為人工在已觀察服務故障後中止。未知 Editor／共享 Licensing Client 沒有接管或停止。

## D. 審查與修正

完整 interim diff `45d763b..4fc5f90` advisory `CHANGES_REQUIRED`；一個 HIGH 指出可能接受 Library／cache junction，未觀察實機越界；已補全既有寫入樹拒絕及 task-owned junction 負例。其餘為 compile 後 scene／settings／manifest 漂移、缺數值可能誤 PASS、verified 標记過早；已補 source 凍結、finite integer checks 與全部 postconditions 後才標記。下載、守衛與結果修正各用新 commit，失敗紀錄沒有覆蓋。

交付 advisory 審查與最終 candidate hash 另存 ignored evidence，仍不替代 formal independent approval。原 Unity 失敗綁定 73272ae；後續本機工具改善沒有再啟動 Editor，不借用舊結果作最新 code PASS。

## E. 停止、回滾與下一步

目前停止在共享授權服務阻擋。使用者需先保存現有 Unity 工作，在 Unity Hub 正常介面恢復固定 Editor 的授權服務，確認可開啟後回覆「授權服務已恢復」。代理不讀授權檔／credentials、不重啟共享服務、不刪未知 Unity lock 或改 ACL／TLS／sandbox；沒有自行開啟下一輪。

恢復後從全新 task-owned checkout 執行同版 runner，逐階段收實際 compile／9 Edit／1 Play／Windows build／Player／PNG 與 Web compatibility。還要最終 SHA 的 formal review、另行授權 E02 推送／PR／CI／合併以及合併後確認，才可能 VERIFIED／DONE；不開始 E03。

回滾只普通 revert E02 source／設定／runner，保留本輪失敗 evidence／official archives；不 reset／clean 既有工作樹、不刪 Web／原 `.blend`／GLB、不自行發布回滾版。
