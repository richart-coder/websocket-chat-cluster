class Connection {
	constructor(id) {
		this.id = id;
		this.clients = new Set();
	}

	addClient(ws) {
		this.clients.add(ws);
	}

	removeClient(ws) {
		const wasRemoved = this.clients.delete(ws);
		return {wasRemoved, isEmpty: this.clients.size === 0};
	}

	broadcast(message) {
		const msgStr = JSON.stringify(message);
		for (const client of this.clients) {
			try {
				client.send(msgStr);
			} catch (error) {
				console.error("Error sending message to client:", error);
				this.clients.delete(client);
			}
		}
	}

	get size() {
		return this.clients.size;
	}

	has(ws) {
		return this.clients.has(ws);
	}
}

class Room {
	constructor(redisSubscriber) {
		this.connections = new Map();
		this.redisSubscriber = redisSubscriber;
	}

	async getOrCreateConnection(roomId) {
		if (this.connections.has(roomId)) {
			return this.connections.get(roomId);
		}

		const connection = new Connection(roomId);
		this.connections.set(roomId, connection);

		try {
			await this.redisSubscriber.subscribe(roomId);
			console.log(`Subscribed to room: ${roomId}`);
			return connection;
		} catch (error) {
			console.error(`Error subscribing to room ${roomId}:`, error);
			this.connections.delete(roomId);
			throw error;
		}
	}

	async removeClientFromRoom(ws, roomId) {
		const connection = this.connections.get(roomId);
		if (!connection) return false;

		const {wasRemoved, isEmpty} = connection.removeClient(ws);

		if (isEmpty) {
			try {
				await this.redisSubscriber.unsubscribe(roomId);
				console.log(`Unsubscribed from room: ${roomId}`);
			} catch (error) {
				console.error(`Error unsubscribing from room ${roomId}:`, error);
			}
			this.connections.delete(roomId);
			console.log(`Cleaned up empty room: ${roomId}`);
		}

		return wasRemoved;
	}

	getRoomSize(roomId) {
		const connection = this.connections.get(roomId);
		return connection ? connection.size : 0;
	}

	broadcastToRoom(roomId, message) {
		const connection = this.connections.get(roomId);
		if (connection) {
			connection.broadcast(message);
		}
	}

	getAllRooms() {
		return Array.from(this.connections.keys());
	}

	async cleanup() {
		for (const roomId of this.connections.keys()) {
			try {
				await this.redisSubscriber.unsubscribe(roomId);
				console.log(`Unsubscribed from room: ${roomId}`);
			} catch (error) {
				console.error(`Error unsubscribing from room ${roomId}:`, error);
			}
		}
		this.connections.clear();
	}
}

export {Room};
