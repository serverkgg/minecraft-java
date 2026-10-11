import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { byte, comp, type NBT, string, writeUncompressed } from "prismarine-nbt";
import { WORLD_STAGING } from "../shared";
import { parseLevel } from "./levelDat";
import { worlds } from "./worlds";

const UPLOAD = `${WORLD_STAGING}/9f1/save`;

interface Stage {
	context: Bridge.Context;
	moves: string[][];
	removed: string[];
	added: string[][];
	reported: Bridge.Activity[];
}

const stage = (present: string[], found: string[]): Stage => {
	const files = new Set([
		UPLOAD,
		...present,
		...found,
	]);
	const moves: string[][] = [];
	const removed: string[] = [];
	const added: string[][] = [];
	const reported: Bridge.Activity[] = [];

	const context = {
		files: {
			exists: async (path: string) => files.has(path),
			size: async () => 100,
			move: async (from: string, to: string) => {
				moves.push([
					from,
					to,
				]);
				files.delete(from);
				files.add(to);
			},
			remove: async (path: string) => {
				removed.push(path);
				files.delete(path);
			},
		},
		exec: async (args: string[]) => {
			if (args.at(0) === "find") {
				return {
					stdout: found.map((directory) => `${directory}/level.dat`).join("\n"),
					stderr: "",
					code: 0,
				};
			}

			return {
				stdout: args.at(0) === "od" ? "1f 8b 08" : "",
				stderr: "",
				code: 0,
			};
		},
		log: (_message: string, fields: Record<string, string>) => {
			added.push([
				fields.folder ?? "",
				fields.world ?? "",
			]);
		},
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		moves,
		removed,
		added,
		reported,
	};
};

describe("importing an uploaded world", () => {
	it("an upload outside the world staging folder is refused", async () => {
		const { context } = stage([], []);

		await expect(worlds.add?.(context, "../etc/passwd")).rejects.toThrow();
		await expect(worlds.add?.(context, "world")).rejects.toThrow();
	});

	it("an archive with no level file is refused", async () => {
		const { context } = stage([], []);

		await expect(worlds.add?.(context, UPLOAD)).rejects.toThrow();
	});

	it("a world keeps its folder name when nothing is in the way", async () => {
		const { context, moves, removed, added, reported } = stage(
			[],
			[
				`${UPLOAD}/creative`,
			],
		);

		const outcome = await worlds.add?.(context, UPLOAD);

		expect(outcome).toBeUndefined();
		expect(moves).toEqual([
			[
				`${UPLOAD}/creative`,
				"creative",
			],
		]);
		expect(removed).toEqual([
			UPLOAD,
		]);
		expect(added).toEqual([
			[
				"creative",
				"creative",
			],
		]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.WorldImported,
				text: {
					ar: "تم استيراد ماب creative",
					en: "Imported world creative",
				},
				subject: "creative",
				details: {
					world: "creative",
					folder: "creative",
				},
			},
		]);
	});

	it("an Aternos world lands beside the world the server already has", async () => {
		const { context, moves, added } = stage(
			[
				"world",
			],
			[
				`${UPLOAD}/world`,
				`${UPLOAD}/world_nether`,
				`${UPLOAD}/world_the_end`,
			],
		);

		const outcome = await worlds.add?.(context, UPLOAD);

		expect(moves).toEqual([
			[
				`${UPLOAD}/world`,
				"world-2",
			],
			[
				`${UPLOAD}/world_nether`,
				"world-2_nether",
			],
			[
				`${UPLOAD}/world_the_end`,
				"world-2_the_end",
			],
		]);
		expect(added).toEqual([
			[
				"world",
				"world-2",
			],
		]);
		expect(outcome?.notice.en).toContain(`as "world-2"`);
		expect(outcome?.notice.en).toContain(`named "world"`);
		expect(outcome?.notice.ar).toContain("باسم «world-2»");
		expect(outcome?.notice.ar).toContain("ماب باسم «world»");
	});

	it("every world in one archive is imported and each sees the name the last one took", async () => {
		const { context, moves, added } = stage(
			[
				"world",
			],
			[
				`${UPLOAD}/world`,
				`${UPLOAD}/world-2`,
			],
		);

		await worlds.add?.(context, UPLOAD);

		expect(moves).toEqual([
			[
				`${UPLOAD}/world`,
				"world-2",
			],
			[
				`${UPLOAD}/world-2`,
				"world-2-2",
			],
		]);
		expect(added).toEqual([
			[
				"world",
				"world-2",
			],
			[
				"world-2",
				"world-2-2",
			],
		]);
	});

	it("a folder name with no latin letters or digits becomes the default world", async () => {
		const { context, moves } = stage(
			[],
			[
				`${UPLOAD}/عالمي`,
			],
		);

		const outcome = await worlds.add?.(context, UPLOAD);

		expect(moves).toEqual([
			[
				`${UPLOAD}/عالمي`,
				"world",
			],
		]);
		expect(outcome?.notice.en).toBe(
			`The world "عالمي" was added as "world" because its folder name has no Latin letters or digits.`,
		);
		expect(outcome?.notice.ar).toBe(
			`تمت إضافة الماب «عالمي» باسم «world» لأن اسم مجلده لا يحتوي على حروف إنجليزية أو أرقام.`,
		);
	});

	it("a level file at the root of the upload keeps the staging folder name and leaves nothing behind", async () => {
		const { context, moves, removed } = stage(
			[],
			[
				UPLOAD,
			],
		);

		await worlds.add?.(context, UPLOAD);

		expect(moves).toEqual([
			[
				UPLOAD,
				"save",
			],
		]);
		expect(removed).toEqual([]);
	});

	it("a Bedrock world in the archive fails before anything moves", async () => {
		const { context, moves } = stage(
			[
				`${UPLOAD}/bedrock/db`,
			],
			[
				`${UPLOAD}/aaa`,
				`${UPLOAD}/bedrock`,
			],
		);

		await expect(worlds.add?.(context, UPLOAD)).rejects.toThrow();
		expect(moves).toEqual([]);
	});
});

const STAMP = JSON.stringify({
	variant: "vanilla",
	version: "1.21.4",
	build: null,
	java: 21,
	launch: {
		kind: "jar",
		target: "server.jar",
	},
});

const managed = (active: string) => {
	const reported: Bridge.Activity[] = [];
	const removed: string[] = [];
	const properties: Record<string, string> = {
		"level-name": active,
	};

	const context = {
		variable: () => null,
		exec: async () => ({
			stdout: "./world/level.dat\n./creative/level.dat",
			stderr: "",
			code: 0,
		}),
		files: {
			size: async () => 100,
			exists: async (path: string) => path === ".serverk-install.json",
			read: async () => STAMP,
			remove: async (path: string) => {
				removed.push(path);
			},
		},
		codec: {
			javaProperties: {
				read: async () => properties,
				merge: async (_path: string, values: Record<string, string>) => {
					Object.assign(properties, values);
				},
			},
		},
		net: {
			json: async () => {
				throw new Error("offline");
			},
		},
		log: () => {},
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		reported,
		removed,
	};
};

const ROW = {
	id: "creative",
	name: "creative",
};

describe("reporting a large world upload", () => {
	it("more than five worlds become one entry with the count and the first names", async () => {
		const names = [
			"alpha",
			"bravo",
			"charlie",
			"delta",
			"echo",
			"foxtrot",
			"golf",
		];
		const { context, reported } = stage(
			[],
			names.map((name) => `${UPLOAD}/${name}`),
		);

		await worlds.add?.(context, UPLOAD);

		expect(reported).toEqual([
			{
				name: BridgeEventName.WorldImported,
				text: {
					ar: "تم استيراد مابات alpha، bravo، charlie، delta، echo وغيرها (7)",
					en: "Imported worlds alpha, bravo, charlie, delta, echo and more (7)",
				},
				details: {
					count: 7,
					worlds: "alpha, bravo, charlie, delta, echo",
				},
			},
		]);
	});
});

describe("what the world actions report", () => {
	it("activating a world names it and the world it replaced", async () => {
		const { context, reported } = managed("world");

		await worlds.actions?.activate?.(context, ROW, {});

		expect(reported).toEqual([
			{
				name: BridgeEventName.WorldActivated,
				text: {
					ar: "تم تفعيل ماب creative بدلًا من world",
					en: "Activated world creative in place of world",
				},
				subject: "creative",
				details: {
					world: "creative",
					previous: "world",
				},
			},
		]);
	});

	it("deleting a world reports it only once it is gone", async () => {
		const { context, reported, removed } = managed("world");

		await worlds.actions?.delete?.(context, ROW, {});

		expect(removed.length).toBeGreaterThan(0);
		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.WorldDeleted,
		]);
		expect(reported.at(0)?.subject).toBe("creative");
	});

	it("the active world is refused and nothing is reported", async () => {
		const { context, reported } = managed("creative");

		await expect(worlds.actions?.delete?.(context, ROW, {})).rejects.toThrow();
		expect(reported).toEqual([]);
	});

	it("resetting the nether and the end each say which dimension was wiped", async () => {
		const { context, reported } = managed("world");

		await worlds.actions?.resetNether?.(context, ROW, {});
		await worlds.actions?.resetEnd?.(context, ROW, {});

		expect(
			reported.map((entry) => [
				entry.name,
				entry.subject,
				entry.details?.scope,
			]),
		).toEqual([
			[
				BridgeEventName.WorldWiped,
				"creative",
				"nether",
			],
			[
				BridgeEventName.WorldWiped,
				"creative",
				"end",
			],
		]);
	});
});

describe("which world actions apply", () => {
	const listedRow = async (context: Bridge.Context, id: string) => {
		const row = (await worlds.list(context)).find((entry) => entry.id === id);

		if (!row) {
			throw new Error(`the list built no row for ${id}`);
		}

		return row;
	};

	it("the active world cannot be deleted or activated, and says why in the words the refusal uses", async () => {
		const { context } = managed("creative");
		const active = await listedRow(context, "creative");

		const unavailable = await worlds.unavailable?.(context, active);

		expect(Object.keys(unavailable ?? {}).sort()).toEqual([
			"activate",
			"delete",
		]);
		expect(unavailable?.delete?.en).toBe("You can't delete the active world. Activate another one first");
		await expect(worlds.actions?.delete?.(context, active, {})).rejects.toThrow(unavailable?.delete?.en);
		await expect(worlds.actions?.activate?.(context, active, {})).rejects.toThrow(unavailable?.activate?.en);
	});

	it("any other world, and a row that carries only its id, keeps every action", async () => {
		const { context } = managed("world");

		expect(await worlds.unavailable?.(context, await listedRow(context, "creative"))).toEqual({});
		expect(
			await worlds.unavailable?.(context, {
				id: "creative",
			}),
		).toEqual({});
	});
});

const LEVEL = "world/level.dat";

const storedLevel = (): NBT => {
	return comp(
		{
			Data: {
				type: "compound",
				value: {
					LevelName: string("world"),
					difficulty_settings: {
						type: "compound",
						value: {
							difficulty: string("easy"),
							hardcore: byte(0),
							locked: byte(0),
						},
					},
				},
			},
		},
		"",
	) as NBT;
};

const hardcoreHarness = (running = false) => {
	const stored = new Map<string, Uint8Array>([
		[
			LEVEL,
			Bun.gzipSync(new Uint8Array(writeUncompressed(storedLevel(), "big"))),
		],
	]);
	const reported: Bridge.Activity[] = [];
	const under = (path: string) =>
		[
			...stored.keys(),
		].filter((key) => key === path || key.startsWith(`${path}/`));

	const context = {
		server: {
			running,
		},
		exec: async (argv: string[]) => {
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

			if (argv[0] === "base64") {
				return {
					code: 0,
					stdout: Buffer.from(stored.get(argv.at(-1) ?? "") ?? new Uint8Array()).toString("base64"),
					stderr: "",
				};
			}

			const [, , , , encoded = "", staged = ""] = argv;

			stored.set(staged, new Uint8Array(Buffer.from(new TextDecoder().decode(stored.get(encoded)), "base64")));

			return {
				code: 0,
				stdout: "",
				stderr: "",
			};
		},
		codec: {
			javaProperties: {
				read: async () => ({
					"level-name": "world",
				}),
			},
		},
		files: {
			exists: async (path: string) => under(path).length > 0,
			write: async (path: string, contents: string) => {
				stored.set(path, new TextEncoder().encode(contents));
			},
			ensure: async () => {},
			size: async () => 100,
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
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;

	const settings = async () => {
		const level = await parseLevel(stored.get(LEVEL) ?? new Uint8Array());
		const data = level?.value.Data;
		const entry = data?.type === "compound" ? data.value.difficulty_settings : undefined;

		return entry?.type === "compound" ? entry.value : null;
	};

	return {
		context,
		reported,
		stored,
		settings,
	};
};

const WORLD: Bridge.Row = {
	id: "world",
};

describe("switching hardcore on a world", () => {
	it("turns hardcore on with a locked hard difficulty, reports it and leaves no scratch behind", async () => {
		const run = hardcoreHarness();

		await worlds.actions?.hardcore?.(run.context, WORLD, {
			enabled: true,
		});

		expect(await run.settings()).toEqual({
			difficulty: string("hard"),
			hardcore: byte(1),
			locked: byte(1),
		});
		expect(run.reported).toEqual([
			{
				name: BridgeEventName.GameplayChanged,
				text: {
					ar: "تم تفعيل الهاردكور في ماب world",
					en: "Turned on hardcore for world world",
				},
				subject: "world",
				details: {
					what: "hardcore",
					value: "on",
					world: "world",
				},
			},
		]);
		expect([
			...run.stored.keys(),
		]).toEqual([
			LEVEL,
		]);
	});

	it("lists the world as hardcore once it is on, and turns it off again", async () => {
		const run = hardcoreHarness();

		expect((await worlds.list(run.context)).at(0)?.hardcore).toBe("");
		await worlds.actions?.hardcore?.(run.context, WORLD, {
			enabled: true,
		});
		expect((await worlds.list(run.context)).at(0)?.hardcore).toBe("✓");
		await worlds.actions?.hardcore?.(run.context, WORLD, {
			enabled: false,
		});

		expect(await run.settings()).toEqual({
			difficulty: string("hard"),
			hardcore: byte(0),
			locked: byte(0),
		});
		expect(run.reported.at(1)?.text.en).toBe("Turned off hardcore for world world");
	});

	it("refuses to set hardcore to the value the world already has, and writes nothing", async () => {
		const run = hardcoreHarness();
		const before = run.stored.get(LEVEL);

		await expect(
			worlds.actions?.hardcore?.(run.context, WORLD, {
				enabled: false,
			}),
		).rejects.toThrow("Hardcore is already off for this world.");
		expect(run.stored.get(LEVEL)).toBe(before);
		expect(run.reported).toEqual([]);
	});

	it("refuses while the server is running", async () => {
		const run = hardcoreHarness(true);
		const before = run.stored.get(LEVEL);

		await expect(
			worlds.actions?.hardcore?.(run.context, WORLD, {
				enabled: true,
			}),
		).rejects.toThrow("Stop the server");
		expect(run.stored.get(LEVEL)).toBe(before);
	});

	it("refuses a world the list does not show", async () => {
		const run = hardcoreHarness();

		await expect(
			worlds.actions?.hardcore?.(
				run.context,
				{
					id: "../world",
				},
				{
					enabled: true,
				},
			),
		).rejects.toThrow("We couldn't find that world.");
		expect(run.reported).toEqual([]);
	});

	it("refuses a level file it can't read", async () => {
		const run = hardcoreHarness();

		run.stored.set(LEVEL, new TextEncoder().encode("not a level file"));

		await expect(
			worlds.actions?.hardcore?.(run.context, WORLD, {
				enabled: true,
			}),
		).rejects.toThrow("We couldn't read the world's level.dat");
		expect((await worlds.list(run.context)).at(0)?.hardcore).toBe("");
	});
});
