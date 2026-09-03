const STATUS_PROTOCOL_VERSION = -1;

const STATUS_STATE = 1;

const MAX_RESPONSE_BYTES = 256 * 1024;

export interface PingPlayers {
	online: number;
	max: number;
}

export interface PingStatus {
	players: PingPlayers;
	version: string | null;
	description: string | null;
	latencyMs: number;
}

interface StatusPayload {
	players?: {
		online?: unknown;
		max?: unknown;
	};
	version?: {
		name?: unknown;
	};
	description?: unknown;
}

interface DescriptionObject {
	text?: unknown;
}

const writeVarInt = (value: number) => {
	const bytes: number[] = [];

	let current = value >>> 0;

	while (true) {
		if ((current & ~0x7f) === 0) {
			bytes.push(current);

			return bytes;
		}

		bytes.push((current & 0x7f) | 0x80);

		current >>>= 7;
	}
};

const readVarInt = (view: Uint8Array, offset: number) => {
	let value = 0;
	let size = 0;

	while (size < 5) {
		const byte = view[offset + size];

		if (byte === undefined) {
			return null;
		}

		value |= (byte & 0x7f) << (7 * size);
		size += 1;

		if ((byte & 0x80) === 0) {
			return {
				value,
				size,
			};
		}
	}

	throw new Error("minecraft ping varint is malformed");
};

const framed = (body: number[]) => {
	return new Uint8Array([
		...writeVarInt(body.length),
		...body,
	]);
};

const handshake = (host: string, hostPort: number) => {
	const address = new TextEncoder().encode(host);

	return framed([
		0x00,
		...writeVarInt(STATUS_PROTOCOL_VERSION),
		...writeVarInt(address.length),
		...address,
		(hostPort >> 8) & 0xff,
		hostPort & 0xff,
		...writeVarInt(STATUS_STATE),
	]);
};

const STATUS_REQUEST = framed([
	0x00,
]);

const toDescription = (description: unknown): string | null => {
	if (typeof description === "string") {
		return description;
	}

	if (description === null || typeof description !== "object") {
		return null;
	}

	const text = (description as DescriptionObject).text;

	return typeof text === "string" ? text : null;
};

export const parseStatus = (view: Uint8Array): Omit<PingStatus, "latencyMs"> | null => {
	const frame = readVarInt(view, 0);

	if (!frame) {
		return null;
	}

	if (view.length < frame.size + frame.value) {
		return null;
	}

	const packetId = readVarInt(view, frame.size);

	if (!packetId) {
		return null;
	}

	if (packetId.value !== 0x00) {
		throw new Error("minecraft ping response has an unexpected packet id");
	}

	const length = readVarInt(view, frame.size + packetId.size);

	if (!length) {
		return null;
	}

	const start = frame.size + packetId.size + length.size;

	if (view.length < start + length.value) {
		return null;
	}

	const status = JSON.parse(new TextDecoder().decode(view.subarray(start, start + length.value))) as StatusPayload;

	const online = status.players?.online;
	const max = status.players?.max;

	if (typeof online !== "number" || typeof max !== "number") {
		throw new Error("minecraft ping response is missing player counts");
	}

	const version = status.version?.name;

	return {
		players: {
			online: Math.max(0, Math.floor(online)),
			max: Math.max(0, Math.floor(max)),
		},
		version: typeof version === "string" ? version : null,
		description: toDescription(status.description),
	};
};

export const probeMinecraftPing = (host: string, hostPort: number, timeoutMs: number) => {
	return new Promise<PingStatus>((resolve, reject) => {
		const startedAt = performance.now();

		let socket: Awaited<ReturnType<typeof Bun.connect>> | null = null;
		let received = new Uint8Array(0);
		let settled = false;

		const finish = (outcome: Omit<PingStatus, "latencyMs"> | Error) => {
			if (settled) {
				return;
			}

			settled = true;

			clearTimeout(timer);
			socket?.end();

			if (outcome instanceof Error) {
				reject(outcome);

				return;
			}

			resolve({
				...outcome,
				latencyMs: Math.round(performance.now() - startedAt),
			});
		};

		const timer = setTimeout(() => {
			finish(new Error("minecraft ping timed out"));
		}, timeoutMs);

		const handle = (chunk: Uint8Array) => {
			if (received.length + chunk.length > MAX_RESPONSE_BYTES) {
				finish(new Error("minecraft ping response is too large"));

				return;
			}

			const merged = new Uint8Array(received.length + chunk.length);

			merged.set(received);
			merged.set(chunk, received.length);

			received = merged;

			try {
				const status = parseStatus(received);

				if (status) {
					finish(status);
				}
			} catch (error) {
				finish(error instanceof Error ? error : new Error(String(error)));
			}
		};

		Bun.connect({
			hostname: host,
			port: hostPort,
			socket: {
				data(_socket, data) {
					handle(data);
				},
				error(_socket, error) {
					finish(error);
				},
				close() {
					finish(new Error("minecraft ping connection closed early"));
				},
			},
		})
			.then((created) => {
				if (settled) {
					created.end();

					return;
				}

				socket = created;

				created.write(handshake(host, hostPort));
				created.write(STATUS_REQUEST);
			})
			.catch((error) => {
				finish(error instanceof Error ? error : new Error(String(error)));
			});
	});
};
