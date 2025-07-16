<script setup>
import {ref, onMounted, onBeforeUnmount, nextTick} from "vue";

const props = defineProps({
	wsUrl: {type: String, required: true},
});

const messages = ref([]);
const inputText = ref("");
const socket = ref(null);
const messagesContainer = ref(null);
const connectionStatus = ref("disconnected");
const reconnectAttempts = ref(0);
const maxReconnectAttempts = 5;
const reconnectDelay = ref(1000);

function scrollToBottom() {
	nextTick(() => {
		if (messagesContainer.value) {
			messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
		}
	});
}

function sendMessage() {
	const text = inputText.value.trim();
	if (!text) return;

	if (connectionStatus.value !== "connected") {
		console.log("Cannot send message: not connected");
		return;
	}

	const message = {
		roomId: "room1",
		sender: "cheer",
		text,
	};

	if (socket.value && socket.value.readyState === WebSocket.OPEN) {
		socket.value.send(JSON.stringify(message));
		inputText.value = "";
	}
}

function connectWebSocket() {
	if (socket.value && socket.value.readyState === WebSocket.OPEN) {
		return;
	}

	connectionStatus.value = "connecting";
	socket.value = new WebSocket(props.wsUrl);

	socket.value.addEventListener("open", () => {
		console.log("WebSocket 連線已建立");
		connectionStatus.value = "connected";
		reconnectAttempts.value = 0;
		reconnectDelay.value = 1000;

		const joinRoomMessage = {
			roomId: "room1",
			sender: "cheer",
			text: "join_room",
		};
		socket.value.send(JSON.stringify(joinRoomMessage));
	});

	socket.value.addEventListener("message", async (event) => {
		const rawData = event.data;
		const data = rawData instanceof Blob ? await rawData.text() : rawData;
		try {
			const message = JSON.parse(data);

			if (message.type === "ping") {
				const pongMessage = {
					roomId: "room1",
					sender: "cheer",
					text: "pong",
				};
				socket.value.send(JSON.stringify(pongMessage));
				return;
			}

			if (message.text !== "join_room" && message.text !== "pong") {
				messages.value.push(message);
				scrollToBottom();
			}
		} catch (e) {
			console.error("訊息格式錯誤:", e);
		}
	});

	socket.value.addEventListener("close", () => {
		console.log("WebSocket 連線已關閉");
		connectionStatus.value = "disconnected";
		attemptReconnect();
	});

	socket.value.addEventListener("error", (e) => {
		console.error("WebSocket 發生錯誤", e);
		connectionStatus.value = "error";
		attemptReconnect();
	});
}

function attemptReconnect() {
	if (reconnectAttempts.value >= maxReconnectAttempts) {
		console.log("Max reconnect attempts reached");
		connectionStatus.value = "failed";
		return;
	}

	reconnectAttempts.value++;
	connectionStatus.value = "reconnecting";

	console.log(
		`Attempting to reconnect... (${reconnectAttempts.value}/${maxReconnectAttempts})`
	);

	setTimeout(() => {
		connectWebSocket();
	}, reconnectDelay.value);

	reconnectDelay.value = Math.min(reconnectDelay.value * 2, 30000);
}

onMounted(() => {
	connectWebSocket();
});

onBeforeUnmount(() => {
	socket.value?.close();
});
</script>

<template>
	<div class="chat-container">
		<div class="connection-status" :class="connectionStatus">
			狀態:
			<span v-if="connectionStatus === 'connected'">已連接</span>
			<span v-else-if="connectionStatus === 'connecting'">連接中...</span>
			<span v-else-if="connectionStatus === 'reconnecting'"
				>重新連接中... ({{ reconnectAttempts }}/{{
					maxReconnectAttempts
				}})</span
			>
			<span v-else-if="connectionStatus === 'failed'">連接失敗</span>
			<span v-else>已斷開</span>
		</div>

		<div class="messages" ref="messagesContainer">
			<div v-for="(msg, i) in messages" :key="i" class="message">
				<strong>{{ msg.sender }}:</strong> {{ msg.text }}
			</div>
		</div>

		<form @submit.prevent="sendMessage" class="input-area">
			<input
				v-model="inputText"
				type="text"
				placeholder="輸入訊息..."
				autocomplete="off"
				:disabled="connectionStatus !== 'connected'"
			/>
			<button type="submit" :disabled="connectionStatus !== 'connected'">
				送出
			</button>
		</form>
	</div>
</template>

<style scoped>
.chat-container {
	max-width: 500px;
	margin: 2rem auto;
	border: 1px solid #ccc;
	padding: 1rem;
	font-family: Arial, sans-serif;
	display: flex;
	flex-direction: column;
	height: 450px;
}

.connection-status {
	padding: 0.5rem;
	font-size: 0.9rem;
	font-weight: bold;
	border-radius: 4px;
	margin-bottom: 1rem;
	text-align: center;
}

.connection-status.connected {
	background-color: #d4edda;
	color: #155724;
}

.connection-status.connecting,
.connection-status.reconnecting {
	background-color: #fff3cd;
	color: #856404;
}

.connection-status.disconnected,
.connection-status.error,
.connection-status.failed {
	background-color: #f8d7da;
	color: #721c24;
}

.messages {
	flex: 1;
	overflow-y: auto;
	margin-bottom: 1rem;
	padding-right: 0.5rem;
	border-bottom: 1px solid #eee;
}

.message {
	margin-bottom: 0.5rem;
}

.input-area {
	display: flex;
}

input[type="text"] {
	flex: 1;
	padding: 0.5rem;
	font-size: 1rem;
}

input[type="text"]:disabled {
	background-color: #f5f5f5;
	cursor: not-allowed;
}

button {
	padding: 0 1rem;
	font-size: 1rem;
	cursor: pointer;
}

button:disabled {
	background-color: #f5f5f5;
	cursor: not-allowed;
	opacity: 0.6;
}
</style>
