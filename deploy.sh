#!/usr/bin/env bash
# ============================================================
#  Voice Studio — Render.com 一键部署准备脚本
#  用法: bash deploy.sh
# ============================================================
set -e

echo "========================================"
echo "  Voice Studio 部署准备"
echo "========================================"

# 1. 初始化 git (若未初始化)
if [ ! -d .git ]; then
  echo "[1/4] 初始化 Git 仓库..."
  git init
  git branch -M main
else
  echo "[1/4] Git 仓库已存在"
fi

# 2. 添加文件并提交
echo "[2/4] 暂存文件..."
git add -A
if git diff --cached --quiet; then
  echo "      无新改动需要提交"
else
  git commit -m "feat: 真实 DSP 引擎 + AI Provider 接口 + Render.com 部署配置

- 后端: 自相关基频检测 / Levinson-Durbin LPC / PSOLA 音高变换 / Schroeder 混响
- 后端: AI Provider 可插拔层 (ElevenLabs / OpenAI / Coqui)
- 部署: render.yaml Blueprint + 持久磁盘 + DATA_DIR 环境变量
- 修复: ACF 归一化 / 共振峰提取 / 亮度与粗糙度计算"
fi

# 3. 检查远程仓库
echo "[3/4] 检查远程仓库..."
if ! git remote get-url origin &>/dev/null; then
  echo ""
  echo "  ⚠ 尚未配置 GitHub 远程仓库。请执行以下步骤:"
  echo ""
  echo "  a) 在 https://github.com/new 创建一个新仓库 (不要勾选 README)"
  echo "  b) 运行以下命令 (替换 YOUR_USERNAME 和 YOUR_REPO):"
  echo ""
  echo "     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
  echo "     git push -u origin main"
  echo ""
else
  echo "  远程仓库: $(git remote get-url origin)"
  echo "  运行 'git push' 推送最新代码"
fi

# 4. Render.com 部署指引
echo "[4/4] Render.com 部署步骤:"
echo ""
echo "  1. 访问 https://dashboard.render.com → New → Blueprint"
echo "  2. 连接你的 GitHub 账号,选择刚推送的仓库"
echo "  3. Render 会自动识别 render.yaml,点击 Apply"
echo "  4. 等待构建完成 (~2 分钟),获得持久公网 URL:"
echo "     https://voice-studio-xxxx.onrender.com"
echo ""
echo "  (可选) 在 Render 控制台填入 AI API Key 实现顶级音色效果:"
echo "     ELEVENLABS_API_KEY / OPENAI_API_KEY / COQUI_API_KEY"
echo "     并将 VOICE_AI_PROVIDER 改为 elevenlabs / openai / coqui"
echo ""
echo "========================================"
echo "  完成! 部署后 URL 永久有效,自动重新部署"
echo "========================================"
