import { expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { comp, type NBT, string, writeUncompressed } from "prismarine-nbt";
import { cloneWorld, inspectJavaWorld, worldNameArgument, worldTools } from "./worldTools";

it("world names reject traversal and shell punctuation", () => {
	for (const name of [
		"../world",
		"",
		"/world",
		"$(touch file)",
		"world;rm",
		"a".repeat(33),
	]) {
		expect(() => worldNameArgument(name)).toThrow();
	}
	expect(worldNameArgument("our-world_2")).toBe("our-world_2");
});

it("a Bedrock world is rejected before any command", async () => {
	const context = {
		files: {
			exists: async () => true,
		},
	} as unknown as Bridge.Context;
	await expect(inspectJavaWorld(context, "world")).rejects.toThrow();
});

it("invalid Java headers are rejected and gzip Java metadata accepted", async () => {
	const context = (header: string) =>
		({
			files: {
				size: async () => 100,
				exists: async () => false,
			},
			exec: async () => ({
				stdout: header,
				code: 0,
			}),
		}) as unknown as Bridge.Context;
	await expect(inspectJavaWorld(context("08 00 00"), "world")).rejects.toThrow();
	await expect(inspectJavaWorld(context("1f 8b 08"), "world")).resolves.toBeUndefined();
});

it("create preserves the old world, changes only generation settings and reports the new world", async () => {
	const writes: unknown[] = [];
	const reported: Bridge.Activity[] = [];
	const context = {
		files: {
			exists: async () => false,
		},
		codec: {
			javaProperties: {
				merge: async (_path: string, values: unknown) => {
					writes.push(values);
				},
			},
		},
		log: () => {},
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;
	await worldTools.actions.create?.(context, {
		name: "new-world",
		seed: "123",
	});
	expect(writes).toEqual([
		{
			"level-seed": "123",
		},
		{
			"level-name": "new-world",
		},
	]);
	expect(reported).toEqual([
		{
			name: BridgeEventName.WorldCreated,
			text: {
				ar: "تم إنشاء ماب جديد new-world، ويتولد عند التشغيل التالي",
				en: "Created world new-world, generated on the next start",
			},
			subject: "new-world",
			details: {
				world: "new-world",
				seed: "123",
			},
		},
	]);
});

it("clone refuses to overwrite an existing world", async () => {
	const context = {
		files: {
			exists: async () => true,
		},
	} as unknown as Bridge.Context;
	await expect(cloneWorld(context, "world", "existing")).rejects.toThrow();
});

const gzippedNbt = (root: Record<string, unknown>) => {
	return Bun.gzipSync(new Uint8Array(writeUncompressed(comp(root, "") as NBT, "big")));
};

const SEED = {
	type: "long",
	value: [
		-1,
		-123,
	],
};

const levelWithSeed = () => {
	return gzippedNbt({
		Data: {
			type: "compound",
			value: {
				LevelName: string("world"),
				WorldGenSettings: {
					type: "compound",
					value: {
						seed: SEED,
					},
				},
			},
		},
	});
};

const resetVolume = (entries: Record<string, Uint8Array>, levelName = "world", failCopy = false) => {
	const stored = new Map<string, Uint8Array>(Object.entries(entries));
	const properties: Record<string, string> = {
		"level-name": levelName,
	};
	const merged: Record<string, string>[] = [];
	const reported: Bridge.Activity[] = [];
	const logged: [
		string,
		unknown,
	][] = [];
	const under = (path: string) =>
		[
			...stored.keys(),
		].filter((key) => key === path || key.startsWith(`${path}/`));

	const context = {
		exec: async (argv: string[]) => {
			if (argv[0] === "find" && argv.includes("-type")) {
				return {
					code: 0,
					stdout: "",
					stderr: "",
				};
			}

			if (argv[0] === "od") {
				return {
					code: 0,
					stdout: [
						...(stored.get(argv.at(-1) ?? "") ?? new Uint8Array()).slice(0, 3),
					]
						.map((byte) => byte.toString(16).padStart(2, "0"))
						.join(" "),
					stderr: "",
				};
			}

			if (argv[0] === "gzip") {
				return {
					code: 0,
					stdout: "",
					stderr: "",
				};
			}

			if (argv[0] === "cp") {
				const source = argv.at(-2) ?? "";
				const target = argv.at(-1) ?? "";

				if (failCopy) {
					stored.set(`${target}/level.dat`, new Uint8Array());

					return {
						code: 1,
						stdout: "",
						stderr: "No space left on device",
					};
				}

				for (const key of under(source)) {
					stored.set(`${target}${key.slice(source.length)}`, stored.get(key) ?? new Uint8Array());
				}

				return {
					code: 0,
					stdout: "",
					stderr: "",
				};
			}

			if (argv[0] === "find") {
				return {
					code: 0,
					stdout: [
						...stored.keys(),
					]
						.filter((key) => key.endsWith("/level.dat"))
						.map((key) => `./${key}`)
						.join("\n"),
					stderr: "",
				};
			}

			return {
				code: 0,
				stdout: Buffer.from(stored.get(argv.at(-1) ?? "") ?? new Uint8Array()).toString("base64"),
				stderr: "",
			};
		},
		codec: {
			javaProperties: {
				read: async () => ({
					...properties,
				}),
				merge: async (_path: string, values: Record<string, string>) => {
					merged.push(values);
					Object.assign(properties, values);
				},
			},
		},
		files: {
			exists: async (path: string) => under(path).length > 0,
			size: async (path: string) => stored.get(path)?.length ?? 0,
			remove: async (path: string) => {
				for (const key of under(path)) {
					stored.delete(key);
				}
			},
			move: async (source: string, destination: string) => {
				if (under(destination).length > 0) {
					throw new Error(`${destination} already exists`);
				}

				for (const key of under(source)) {
					stored.set(`${destination}${key.slice(source.length)}`, stored.get(key) ?? new Uint8Array());
					stored.delete(key);
				}
			},
		},
		log: Object.assign(
			(message: string, fields: unknown) => {
				logged.push([
					message,
					fields,
				]);
			},
			{
				warn: () => {},
			},
		),
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		stored,
		properties,
		merged,
		reported,
		logged,
	};
};

const bukkitWorld = (level: Uint8Array) => {
	return {
		"server.properties": new Uint8Array(),
		"world/level.dat": level,
		"world/playerdata/steve.dat": new Uint8Array(),
		"world_nether/level.dat": new Uint8Array(),
		"world_nether/DIM-1/region/r.0.0.mca": new Uint8Array(),
		"world_the_end/level.dat": new Uint8Array(),
		"world_the_end/DIM1/region/r.0.0.mca": new Uint8Array(),
		"creative/level.dat": new Uint8Array(),
	};
};

const keysOf = (stored: Map<string, Uint8Array>) => {
	return [
		...stored.keys(),
	].sort();
};

it("a world reset moves the active world with its nether and end to -old, keeps its name active and writes its seed", async () => {
	const run = resetVolume(bukkitWorld(levelWithSeed()));

	await worldTools.actions.resetWorld?.(run.context, {});

	expect(keysOf(run.stored)).toEqual([
		"creative/level.dat",
		"server.properties",
		"world-old/level.dat",
		"world-old/playerdata/steve.dat",
		"world-old_nether/DIM-1/region/r.0.0.mca",
		"world-old_nether/level.dat",
		"world-old_the_end/DIM1/region/r.0.0.mca",
		"world-old_the_end/level.dat",
	]);
	expect(run.merged).toContainEqual({
		"level-seed": "-123",
	});
	expect(run.properties).toEqual({
		"level-name": "world",
		"level-seed": "-123",
	});
});

it("a world reset reports a wiped world that names the archive", async () => {
	const run = resetVolume(bukkitWorld(levelWithSeed()));

	await worldTools.actions.resetWorld?.(run.context, {});

	expect(run.reported).toEqual([
		{
			name: BridgeEventName.WorldWiped,
			text: {
				ar: "تم ريسيت ماب world، والماب القديم محفوظ باسم world-old",
				en: "Reset world world, keeping the old one as world-old",
			},
			subject: "world",
			details: {
				world: "world",
				scope: "world",
			},
		},
	]);
});

it("a world reset reads the seed a 26.1 world keeps in world_gen_settings.dat", async () => {
	const run = resetVolume({
		"server.properties": new Uint8Array(),
		"world/level.dat": gzippedNbt({
			Data: {
				type: "compound",
				value: {
					LevelName: string("world"),
				},
			},
		}),
		"world/data/minecraft/world_gen_settings.dat": gzippedNbt({
			data: {
				type: "compound",
				value: {
					seed: SEED,
				},
			},
		}),
		"world/dimensions/minecraft/the_nether/region/r.0.0.mca": new Uint8Array(),
	});

	await worldTools.actions.resetWorld?.(run.context, {});

	expect(keysOf(run.stored)).toEqual([
		"server.properties",
		"world-old/data/minecraft/world_gen_settings.dat",
		"world-old/dimensions/minecraft/the_nether/region/r.0.0.mca",
		"world-old/level.dat",
	]);
	expect(run.properties["level-seed"]).toBe("-123");
});

it("a world reset is unavailable until the active world exists, and refuses in the same words without moving anything", async () => {
	const run = resetVolume(bukkitWorld(levelWithSeed()), "survival");
	const before = keysOf(run.stored);

	const unavailable = await worldTools.unavailable?.(run.context);

	expect(Object.keys(unavailable ?? {})).toEqual([
		"resetWorld",
		"resetFromCopy",
	]);
	expect(unavailable?.resetFromCopy).toEqual(unavailable?.resetWorld);
	expect(unavailable?.resetWorld?.en).toBe(
		"The active world hasn't been generated yet, so there's nothing to reset. Start your server to generate it.",
	);
	await expect(worldTools.actions.resetWorld?.(run.context, {})).rejects.toThrow(unavailable?.resetWorld?.en);
	expect(keysOf(run.stored)).toEqual(before);
	expect(run.merged).toEqual([]);
	expect(run.reported).toEqual([]);
	expect(await worldTools.unavailable?.(resetVolume(bukkitWorld(levelWithSeed())).context)).toEqual({});
});

it("a world reset refuses when no seed can be read, and moves nothing", async () => {
	const run = resetVolume(bukkitWorld(new TextEncoder().encode("not a level file")));
	const before = keysOf(run.stored);

	await expect(worldTools.actions.resetWorld?.(run.context, {})).rejects.toThrow(
		"We couldn't read the world's seed from its files, so the world wasn't reset.",
	);
	expect(keysOf(run.stored)).toEqual(before);
	expect(run.merged).toEqual([]);
	expect(run.reported).toEqual([]);
});

const builtWorld = () => {
	return {
		...bukkitWorld(levelWithSeed()),
		"lobby-original/level.dat": levelWithSeed(),
		"lobby-original/region/r.0.0.mca": new TextEncoder().encode("spawn builds"),
		"lobby-original/uid.dat": new Uint8Array(),
		"lobby-original/session.lock": new Uint8Array(),
		"lobby-original_nether/level.dat": new Uint8Array(),
		"lobby-original_nether/DIM-1/region/r.0.0.mca": new Uint8Array(),
		"lobby-original_the_end/level.dat": new Uint8Array(),
		"lobby-original_the_end/DIM1/region/r.0.0.mca": new Uint8Array(),
	};
};

it("a reset from a copy refuses the active world as its source and changes nothing", async () => {
	const run = resetVolume(builtWorld());
	const before = keysOf(run.stored);

	await expect(
		worldTools.actions.resetFromCopy?.(run.context, {
			source: "world",
		}),
	).rejects.toThrow("That's the active world itself.");
	expect(keysOf(run.stored)).toEqual(before);
	expect(run.merged).toEqual([]);
	expect(run.reported).toEqual([]);
});

it("a reset from a copy refuses a source the Worlds list doesn't show and changes nothing", async () => {
	const run = resetVolume(builtWorld());
	const before = keysOf(run.stored);

	for (const source of [
		"lobby",
		"world_nether",
	]) {
		await expect(
			worldTools.actions.resetFromCopy?.(run.context, {
				source,
			}),
		).rejects.toThrow("No world with that name is in the Worlds list.");
	}
	expect(keysOf(run.stored)).toEqual(before);
	expect(run.merged).toEqual([]);
	expect(run.reported).toEqual([]);
});

it("a failed copy removes what it copied, leaves the active world, its properties and the list as they were, and says nothing changed", async () => {
	const run = resetVolume(builtWorld(), "world", true);
	const before = keysOf(run.stored);
	const listed = await worldTools.unavailable?.(run.context);

	await expect(
		worldTools.actions.resetFromCopy?.(run.context, {
			source: "lobby-original",
		}),
	).rejects.toThrow("We couldn't copy the world, so the active world wasn't reset.");
	expect(keysOf(run.stored)).toEqual(before);
	expect(run.properties).toEqual({
		"level-name": "world",
	});
	expect(run.merged).toEqual([]);
	expect(run.reported).toEqual([]);
	expect(await worldTools.unavailable?.(run.context)).toEqual(listed ?? {});
});

it("a reset from a copy moves the active world to -old and puts the copy in its place under the same name", async () => {
	const run = resetVolume(builtWorld());

	await worldTools.actions.resetFromCopy?.(run.context, {
		source: " lobby-original ",
	});

	expect(keysOf(run.stored)).toEqual([
		"creative/level.dat",
		"lobby-original/level.dat",
		"lobby-original/region/r.0.0.mca",
		"lobby-original/session.lock",
		"lobby-original/uid.dat",
		"lobby-original_nether/DIM-1/region/r.0.0.mca",
		"lobby-original_nether/level.dat",
		"lobby-original_the_end/DIM1/region/r.0.0.mca",
		"lobby-original_the_end/level.dat",
		"server.properties",
		"world-old/level.dat",
		"world-old/playerdata/steve.dat",
		"world-old_nether/DIM-1/region/r.0.0.mca",
		"world-old_nether/level.dat",
		"world-old_the_end/DIM1/region/r.0.0.mca",
		"world-old_the_end/level.dat",
		"world/level.dat",
		"world/region/r.0.0.mca",
		"world_nether/DIM-1/region/r.0.0.mca",
		"world_nether/level.dat",
		"world_the_end/DIM1/region/r.0.0.mca",
		"world_the_end/level.dat",
	]);
	expect(new TextDecoder().decode(run.stored.get("world/region/r.0.0.mca"))).toBe("spawn builds");
	expect(run.properties).toEqual({
		"level-name": "world",
	});
	expect(run.merged.some((values) => "level-seed" in values)).toBe(false);
	expect(run.reported).toEqual([
		{
			name: BridgeEventName.WorldWiped,
			text: {
				ar: "تم ريسيت ماب world من نسخة lobby-original، والماب القديم محفوظ باسم world-old",
				en: "Reset world world from the copy lobby-original, keeping the old one as world-old",
			},
			subject: "world",
			details: {
				world: "world",
				scope: "copy",
				source: "lobby-original",
			},
		},
	]);
	expect(run.logged).toEqual([
		[
			"reset a world from a copy",
			{
				world: "world",
				from: "lobby-original",
				archive: "world-old",
			},
		],
	]);
});

it("a reset from a copy is unavailable while the active world is the only world in the list", async () => {
	const run = resetVolume({
		"server.properties": new Uint8Array(),
		"world/level.dat": levelWithSeed(),
		"world_nether/level.dat": new Uint8Array(),
	});

	expect(await worldTools.unavailable?.(run.context)).toEqual({
		resetFromCopy: {
			ar: "الماب المفعّل هو الماب الوحيد في القائمة، لذلك لا توجد نسخة للريسيت منها. انسخ الماب أولًا من «انسخ الماب».",
			en: "The active world is the only one in the list, so there's no copy to reset from. Copy the world first with Copy world.",
		},
	});
	expect(await worldTools.unavailable?.(resetVolume(builtWorld()).context)).toEqual({});
});
