import { describe, expect, it } from "bun:test";
import { byte, type Compound, comp, int, type NBT, string, writeUncompressed } from "prismarine-nbt";
import { LevelLayout, levelHardcore, levelLayout, parseLevel, serializeLevel, withHardcore } from "./levelDat";

const compound = (value: Record<string, unknown>) => ({
	type: "compound",
	value,
});

const level = (data: Record<string, unknown>): NBT => {
	return comp(
		{
			Data: compound(data),
		},
		"",
	) as NBT;
};

const shared: Compound["value"] = {
	LevelName: string("Ahmed's world"),
	DataVersion: int(4440),
	Time: {
		type: "long",
		value: [
			0,
			123_456,
		],
	},
	ServerBrands: {
		type: "list",
		value: {
			type: "string",
			value: [
				"vanilla",
			],
		},
	},
};

const classic = (hardcore: number, difficulty: number, locked: number) => {
	return level({
		...shared,
		hardcore: byte(hardcore),
		Difficulty: byte(difficulty),
		DifficultyLocked: byte(locked),
	});
};

const settings = (difficulty: string, hardcore: number, locked: number) => {
	return level({
		...shared,
		difficulty_settings: compound({
			difficulty: string(difficulty),
			hardcore: byte(hardcore),
			locked: byte(locked),
		}),
	});
};

const dataOf = (edited: NBT | null) => {
	const data = edited?.value.Data;

	if (data?.type !== "compound") {
		throw new Error("the edited level has no Data compound");
	}

	return data.value;
};

const settingsOf = (edited: NBT | null) => {
	const entry = dataOf(edited).difficulty_settings;

	if (entry?.type !== "compound") {
		throw new Error("the edited level has no difficulty_settings compound");
	}

	return entry.value;
};

const gzipped = (value: NBT) => Bun.gzipSync(new Uint8Array(writeUncompressed(value, "big")));

describe("reading which layout a level file uses", () => {
	it("tells the classic layout from the difficulty settings one and reads the hardcore flag of each", () => {
		expect(levelLayout(classic(1, 3, 1))).toBe(LevelLayout.Classic);
		expect(levelHardcore(classic(1, 3, 1))).toBe(true);
		expect(levelLayout(settings("easy", 0, 0))).toBe(LevelLayout.DifficultySettings);
		expect(levelHardcore(settings("easy", 0, 0))).toBe(false);
	});

	it("treats a difficulty settings compound without the flag as not hardcore", () => {
		const bare = level({
			...shared,
			difficulty_settings: compound({
				difficulty: string("normal"),
			}),
		});

		expect(levelHardcore(bare)).toBe(false);
	});

	it("finds no layout in a level with neither, and refuses to edit it", () => {
		const neither = level(shared);

		expect(levelLayout(neither)).toBeNull();
		expect(levelHardcore(neither)).toBeNull();
		expect(withHardcore(neither, true)).toBeNull();
		expect(withHardcore(comp({}, "") as NBT, true)).toBeNull();
	});
});

describe("switching hardcore in a level file", () => {
	it("turning it on in the classic layout sets hardcore and a locked Hard difficulty", () => {
		const data = dataOf(withHardcore(classic(0, 1, 0), true));

		expect(data.hardcore).toEqual(byte(1));
		expect(data.Difficulty).toEqual(byte(3));
		expect(data.DifficultyLocked).toEqual(byte(1));
		expect(data.LevelName).toEqual(shared.LevelName);
		expect(data.Time).toEqual(shared.Time);
	});

	it("turning it on in the difficulty settings layout sets hardcore and a locked hard difficulty", () => {
		const edited = withHardcore(settings("easy", 0, 0), true);

		expect(settingsOf(edited)).toEqual({
			difficulty: string("hard"),
			hardcore: byte(1),
			locked: byte(1),
		});
		expect(dataOf(edited).ServerBrands).toEqual(shared.ServerBrands);
	});

	it("turning it off clears hardcore and the lock and leaves the difficulty in both layouts", () => {
		const data = dataOf(withHardcore(classic(1, 3, 1), false));

		expect(data.hardcore).toEqual(byte(0));
		expect(data.DifficultyLocked).toEqual(byte(0));
		expect(data.Difficulty).toEqual(byte(3));
		expect(settingsOf(withHardcore(settings("hard", 1, 1), false))).toEqual({
			difficulty: string("hard"),
			hardcore: byte(0),
			locked: byte(0),
		});
	});

	it("keeps every other key in its place and leaves the input untouched", () => {
		const original = classic(0, 2, 0);
		const before = structuredClone(original);
		const edited = withHardcore(original, true);

		expect(Object.keys(dataOf(edited))).toEqual(Object.keys(dataOf(original)));
		expect(original).toEqual(before);
	});
});

describe("reading and writing level file bytes", () => {
	it("a round trip without changes returns equal parsed data in both layouts", async () => {
		for (const value of [
			classic(0, 1, 0),
			settings("normal", 0, 0),
		]) {
			const parsed = await parseLevel(gzipped(value));

			expect(parsed).toEqual(value);
			expect(await parseLevel(serializeLevel(parsed as NBT))).toEqual(value);
		}
	});

	it("an edited level reads back with the new values", async () => {
		const edited = withHardcore(settings("easy", 0, 0), true) as NBT;
		const parsed = await parseLevel(serializeLevel(edited));

		expect(parsed === null ? null : levelHardcore(parsed)).toBe(true);
		expect(settingsOf(parsed).difficulty).toEqual(string("hard"));
	});

	it("a level file we can't write back byte for byte reads as nothing", async () => {
		const javaNullCharacter = Uint8Array.of(
			10,
			0,
			0,
			8,
			0,
			4,
			...new TextEncoder().encode("Name"),
			0,
			2,
			0xc0,
			0x80,
			0,
		);

		expect(await parseLevel(Bun.gzipSync(javaNullCharacter))).toBeNull();
	});

	it("bytes that are not a gzipped level file read as nothing", async () => {
		expect(await parseLevel(new TextEncoder().encode("not a level file"))).toBeNull();
		expect(await parseLevel(Bun.gzipSync(new TextEncoder().encode("not nbt")))).toBeNull();
		expect(await parseLevel(new Uint8Array())).toBeNull();
	});
});
