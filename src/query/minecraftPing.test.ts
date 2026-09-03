import { describe, expect, test } from "bun:test";
import { parseStatus } from "./minecraftPing";

const varInt = (value: number) => {
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

const response = (payload: unknown, packetId = 0x00) => {
	const json = new TextEncoder().encode(JSON.stringify(payload));

	const body = [
		...varInt(packetId),
		...varInt(json.length),
		...json,
	];

	return new Uint8Array([
		...varInt(body.length),
		...body,
	]);
};

const status = {
	players: {
		online: 3,
		max: 20,
	},
	version: {
		name: "1.21.11",
	},
	description: "A Serverk Minecraft Server",
};

describe("reading a status response off the wire", () => {
	test("a complete response gives the player counts, the version and the motd", () => {
		expect(parseStatus(response(status))).toEqual({
			players: {
				online: 3,
				max: 20,
			},
			version: "1.21.11",
			description: "A Serverk Minecraft Server",
		});
	});

	test("a response longer than one packet is still read, because the frame carries its own length", () => {
		const packet = response(status);
		const padded = new Uint8Array(packet.length + 4);

		padded.set(packet);

		expect(parseStatus(padded)?.players).toEqual({
			online: 3,
			max: 20,
		});
	});

	test("a modern description object is read through its text", () => {
		expect(
			parseStatus(
				response({
					...status,
					description: {
						text: "hello",
					},
				}),
			)?.description,
		).toBe("hello");
	});

	test("a description we cannot read is dropped rather than failing the sample", () => {
		expect(
			parseStatus(
				response({
					...status,
					description: {
						extra: [],
					},
				}),
			)?.description,
		).toBeNull();
		expect(
			parseStatus(
				response({
					...status,
					description: null,
				}),
			)?.description,
		).toBeNull();
	});

	test("a missing version name is dropped rather than failing the sample", () => {
		expect(
			parseStatus(
				response({
					players: status.players,
				}),
			)?.version,
		).toBeNull();
	});

	test("fractional or negative counts are clamped to whole players", () => {
		expect(
			parseStatus(
				response({
					players: {
						online: -1,
						max: 20.7,
					},
				}),
			)?.players,
		).toEqual({
			online: 0,
			max: 20,
		});
	});

	test("a response we have not fully received yet asks for more bytes", () => {
		const packet = response(status);

		expect(parseStatus(new Uint8Array(0))).toBeNull();
		expect(parseStatus(packet.subarray(0, 1))).toBeNull();
		expect(parseStatus(packet.subarray(0, packet.length - 4))).toBeNull();
	});

	test("a large payload whose length needs two varint bytes is read whole", () => {
		const long = {
			players: status.players,
			description: "n".repeat(400),
		};

		expect(parseStatus(response(long))?.description).toBe(long.description);
	});

	test("a packet that is not a status response is refused", () => {
		expect(() => parseStatus(response(status, 0x01))).toThrow();
	});

	test("a response with no player counts is refused, because a sample without them is a lie", () => {
		expect(() =>
			parseStatus(
				response({
					version: {
						name: "1.21.11",
					},
				}),
			),
		).toThrow();
	});
});
