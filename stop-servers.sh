#!/bin/bash

# 停止多個服務器實例的腳本

echo "停止所有聊天服務器實例..."

# 停止並刪除 PID 文件
for port in 3001 3002 3003; do
    pid_file="logs/server-${port}.pid"
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "停止服務器 (端口 $port, PID: $pid)"
            kill "$pid"
        else
            echo "服務器 (端口 $port) 已經停止"
        fi
        rm "$pid_file"
    else
        echo "找不到服務器 (端口 $port) 的 PID 文件"
    fi
done

echo "所有服務器已停止"