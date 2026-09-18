# 🍢 台灣夜市消消樂 (Taiwan Night Market Match-3 Game)

一款融合台灣在地夜市文化的休閒三消網頁遊戲！跟著美食香氣踏遍全台經典夜市，挑戰連鎖 Combo，體驗最接地氣的消除樂趣！

🎮 **線上直接玩（GitHub Pages）**：  
👉 [點我立即開玩夜市消消樂！](https://fuling0519.github.io/Night-market-Match-3-game/)

---

## 🌟 遊戲特色

- 🧋 **道地台灣小吃**：珍珠奶茶、黃金地瓜球、酥脆臭豆腐、香酥雞排、鮮美蚵仔煎。
- 🏮 **五大夜市巡禮**：
  1. **台中逢甲夜市**（目標 400 分 / 20 步）
  2. **台北饒河夜市**（目標 700 分 / 18 步）
  3. **花蓮東大門夜市**（目標 1000 分 / 16 步）
  4. **台南花園夜市**（目標 1400 分 / 14 步）
  5. **台南武聖夜市**（目標 2000 分 / 12 步）
- 💥 **連鎖消除與 Combo 音效**：多重消除引發熱血 Combo 特效與澎湃音效。
- 📖 **貼心新手教學**：內建手把手互動教學模式，初次遊玩零門檻。
- 📱 **響應式跨平台支援**：支援電腦滑鼠拖曳與手機觸控操作。

---

## 🕹️ 遊玩方式

1. **基本規則**：拖曳或滑動相鄰的兩個美食圖示，橫向或縱向湊齊 3 個（或以上）相同美食即可消除得分。
2. **過關條件**：在限制步數之內達成關卡目標分數即可通關，並解鎖下一個夜市景點。
3. **通關存檔**：遊戲進度會自動保存在本地瀏覽器（LocalStorage），隨時回來繼續挑戰！

---

## 📂 專案架構

```text
Night-market-Match-3-game/
├── assets/
│   ├── audio/                  # 遊戲背景音樂 (BGM)
│   │   └── grim_pursuit.mp3
│   └── images/                 # 遊戲視覺資源
│       ├── bg-home.png         # 首頁夜市背景
│       ├── bg-fengjia.png      # 逢甲夜市背景
│       ├── bg-raohe.png        # 饒河夜市背景
│       ├── bg-dongdamen.png    # 東大門夜市背景
│       ├── bg-huayuan.png      # 花園夜市背景
│       ├── bg-wusheng.png      # 武聖夜市背景
│       ├── item-boba.png       # 珍珠奶茶
│       ├── item-sweetpotato.png# 地瓜球
│       ├── item-tofu.png       # 臭豆腐
│       ├── item-chicken.png    # 雞排
│       └── item-oyster.png     # 蚵仔煎
├── tools/                      # 開發輔助工具
│   └── combo_font.html         # Combo 特效字體調校預覽頁
├── index.html                  # 遊戲主程式（包含首頁、關卡選擇與主遊戲板）
├── tutorial.html               # 新手教學模式引導頁
├── .gitignore                  # Git 忽略檔案設定
└── README.md                   # 專案說明文件

---

## 🛠️ 本地開發與執行

本專案採用純原生 **HTML5 + CSS3 + Vanilla JavaScript** 開發，無須安裝額外依賴套件（Zero Dependencies）：

1. Clone 本專案至本機：
   `ash
   git clone https://github.com/fuling0519/Night-market-Match-3-game.git
   `
2. 直接使用瀏覽器雙擊開啟 index.html 即可開始遊玩！

---

## 📜 授權協議

本專案僅供個人學習、交流與展示使用。
