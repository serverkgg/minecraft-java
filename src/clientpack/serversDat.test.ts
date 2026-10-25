import { describe, expect, it } from "bun:test";
import { simplify } from "prismarine-nbt";
import { parseLevel } from "../worlds";
import { serversDatOf } from "./serversDat";

describe("writing servers.dat", () => {
	it("encodes one server with an arabic name as uncompressed nbt that reads back unchanged", async () => {
		const parsed = await parseLevel(
			serversDatOf([
				{
					name: "سيرفر الأصحاب",
					ip: "ahmed.srvk.gg",
				},
			]),
		);

		expect(parsed?.name).toBe("");
		expect(parsed === null ? null : simplify(parsed)).toEqual({
			servers: [
				{
					name: "سيرفر الأصحاب",
					ip: "ahmed.srvk.gg",
				},
			],
		});
	});

	it("writes a character outside the basic plane as two three-byte surrogates, the only form java reads", () => {
		const bytes = serversDatOf([
			{
				name: "🎮",
				ip: "a",
			},
		]);

		expect([
			...bytes.subarray(25, 33),
		]).toEqual([
			0x00,
			0x06,
			0xed,
			0xa0,
			0xbc,
			0xed,
			0xbe,
			0xae,
		]);
	});
});
