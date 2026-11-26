# 鏡像魔方 3×3 · 3D 解法

用網頁呈現鏡像魔方（Mirror Cube）的 3D 互動操作與逐層解法。

## 功能
- **3D 鏡像魔方**：每層厚度不同，轉動時形狀會改變；可拖曳旋轉視角、滾輪縮放。
- **轉動**：按鈕或鍵盤（U D L R F B，Shift = 逆時針）。
- **打亂**：隨機打亂或輸入自訂公式。
- **自動求解**：以初級逐層法（7 個階段）計算解法，可逐步播放、倒退、點選任一步跳轉。
- **教學**：7 個步驟的說明與公式，每個公式都有 3D「示範」。
- **顏色提示**：在鏡像外觀與標準六色之間切換，方便學習。

## 使用
因為使用 ES modules，需要用本機伺服器開啟：

```bash
python3 -m http.server 8000
```

然後瀏覽 http://localhost:8000 。也可以直接部署到 GitHub Pages。

## 檔案
- `index.html`、`css/style.css`：頁面
- `js/app.js`：Three.js 場景、動畫、播放器與教學
- `js/cube-core.js`：魔方狀態模型與逐層法求解器（可在 Node 中測試）
- `vendor/three/`：Three.js r160（MIT）

## 線上版（GitHub Pages）
`.github/workflows/pages.yml` 會在推送時自動部署。第一次需要到
**Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
網址：https://harry890726.github.io/mirra-cube/
