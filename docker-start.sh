#!/bin/bash

echo "🚀 啟動 Docker 多實例聊天應用..."

# 檢查 Docker 是否運行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未運行，請先啟動 Docker Desktop"
    exit 1
fi

echo "✅ Docker 正在運行"

# 停止現有容器（如果有）
echo "🧹 清理現有容器..."
docker-compose down

# 構建並啟動服務
echo "🔨 構建並啟動服務..."
docker-compose up --build -d

echo ""
echo "⏳ 等待服務啟動..."
sleep 10

# 檢查服務狀態
echo "📊 服務狀態："
docker-compose ps

echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 服務地址："
echo "  🖥️  負載均衡器:     http://localhost:8080"
echo "  🔴  聊天服務器 1:    ws://localhost:3001" 
echo "  🟡  聊天服務器 2:    ws://localhost:3002"
echo "  🟢  聊天服務器 3:    ws://localhost:3003"
echo "  📊  Redis 監控:     http://localhost:8081"
echo ""
echo "🧪 測試方式："
echo "  1. 打開瀏覽器訪問不同端口測試 WebSocket 連接"
echo "  2. 或使用多實例測試頁面: frontend/index-multi.html"
echo ""
echo "📝 查看日誌："
echo "  docker-compose logs -f chat-server-1"
echo "  docker-compose logs -f chat-server-2" 
echo "  docker-compose logs -f chat-server-3"
echo "  docker-compose logs -f redis"
echo ""
echo "🛑 停止服務："
echo "  docker-compose down"