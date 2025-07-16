#!/bin/bash

# 啟動多個 WebSocket 服務器實例的腳本

echo "啟動多個聊天服務器實例..."

# 確保 Redis 正在運行
echo "檢查 Redis 是否運行..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo "錯誤：Redis 未運行。請先啟動 Redis：brew services start redis"
    exit 1
fi

echo "Redis 正在運行 ✓"

# 創建日誌目錄
mkdir -p logs

# 啟動服務器實例
echo "啟動服務器實例..."

# 實例 1 - 端口 3001
PORT=3001 node server.js > logs/server-3001.log 2>&1 &
PID1=$!
echo "服務器 1 已啟動在端口 3001 (PID: $PID1)"

# 實例 2 - 端口 3002  
PORT=3002 node server.js > logs/server-3002.log 2>&1 &
PID2=$!
echo "服務器 2 已啟動在端口 3002 (PID: $PID2)"

# 實例 3 - 端口 3003
PORT=3003 node server.js > logs/server-3003.log 2>&1 &
PID3=$!
echo "服務器 3 已啟動在端口 3003 (PID: $PID3)"

# 保存 PID 到文件，方便後續停止
echo $PID1 > logs/server-3001.pid
echo $PID2 > logs/server-3002.pid  
echo $PID3 > logs/server-3003.pid

echo ""
echo "所有服務器已啟動！"
echo "- 服務器 1: ws://localhost:3001 (PID: $PID1)"
echo "- 服務器 2: ws://localhost:3002 (PID: $PID2)" 
echo "- 服務器 3: ws://localhost:3003 (PID: $PID3)"
echo ""
echo "查看日誌："
echo "  tail -f logs/server-3001.log"
echo "  tail -f logs/server-3002.log"
echo "  tail -f logs/server-3003.log"
echo ""
echo "停止所有服務器："
echo "  ./stop-servers.sh"