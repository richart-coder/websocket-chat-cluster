#!/bin/bash

echo "🛑 停止 Docker 聊天應用..."

# 停止並移除容器
docker-compose down

echo "🧹 清理未使用的 Docker 資源..."

# 可選：清理未使用的映像和網絡
read -p "是否清理未使用的 Docker 映像和網絡？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker system prune -f
    echo "✅ 清理完成"
else
    echo "⏭️  跳過清理"
fi

echo "✅ 所有服務已停止"