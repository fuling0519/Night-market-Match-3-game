# 素材製作與重建

- 原始 PNG 保留在 `assets/images/`，不覆蓋、不刪除。
- `assets/images/cutouts/` 是已去背的高解析衍生主檔。重建程式優先讀取這裡，避免重新帶入原圖的假棋盤背景。
- 遊戲食物 WebP 統一為 256×256，內容最長邊 236px，置中並保留透明邊界。此解析度可供目前約 30～55 CSS px 的棋盤格使用。
- 所有食物（含普通、四消、章魚燒、棉花糖與舊蚵仔煎）都輸出小圖。四消素材已備妥，直線消除規則尚未接入。
- 背景由原始 PNG 重建，最長邊 1600px、WebP quality 72；背景保留完整矩形，不去背。
- 五格精靈圖的順序固定為珍奶、地瓜球、臭豆腐、雞排、烤玉米；不能再以七格寬度定位。
- 重建：安裝 Pillow 後執行 `python optimize_assets.py`。程式不依賴目前工作目錄，也不需要再次呼叫生圖服務。
- `manifest.json` 記錄來源 SHA-256、尺寸及大小；`contact-dark.png`、`contact-light.png` 提供深淺背景檢查和 40px 縮圖。這些檔案供開發檢查，不是遊戲下載依賴。
- 現有 `.venv` 的 Python 路徑失效；本次使用 Codex bundled Python 與 Pillow 執行，不更動使用者的 Python 安裝。

## 去背來源與提示詞

使用內建 image_gen（imagegen 技能），不是 CLI/API fallback。這是 AI 輔助去背，並非逐像素保證原圖完全不變；已檢查角色、文字與縮圖外觀。

輸出分別保存到 `assets/images/cutouts/item-chicken-4.png` 和 `assets/images/cutouts/item-sweetpotato-4.png`。原圖均保留。

### 雞排提示詞

Use case: background-extraction. Edit target: the supplied spicy chicken cutlet game sprite. Remove ONLY the baked gray and white checkerboard background, output true transparent alpha PNG. Preserve the exact chicken character, face, food, flames, peppers, golden sparkles, paper bag and exact Chinese text 大辣 專用. Preserve original artwork composition, silhouette, colors and detail with no redesign. Preserve soft antialiased edges. No new elements, no checkerboard, no solid background. This is a production cutout for the existing game.

### 地瓜球提示詞

Use case: background-extraction. Edit target: supplied sweet potato balls game sprite. Remove ONLY the baked gray and white checkerboard background; output true transparent alpha PNG. Preserve the exact smiling striped cup, yellow and purple sweet potato balls, skewer, golden sparkles and soft golden swirling glow. Keep composition, character, silhouette and colors with no redesign. Background must be genuinely transparent including gaps between decorations, preserving translucent glow and antialiasing. No solid background, no checkerboard, no new elements.
