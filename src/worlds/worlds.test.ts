import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { WORLD_STAGING } from "../shared";
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
	test("an upload outside the world staging folder is refused", async () => {
		const { context } = stage([], []);

		await expect(worlds.add?.(context, "../etc/passwd")).rejects.toThrow();
		await expect(worlds.add?.(context, "world")).rejects.toThrow();
	});

	test("an archive with no level file is refused", async () => {
		const { context } = stage([], []);

		await expect(worlds.add?.(context, UPLOAD)).rejects.toThrow();
	});

	test("a world keeps its folder name when nothing is in the way", async () => {
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

	test("an Aternos world lands beside the world the server already has", async () => {
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
		expect(outcome?.notice.ar).toContain(`باسم "world-2"`);
		expect(outcome?.notice.ar).toContain(`اسمها "world"`);
	});

	test("every world in one archive is imported and each sees the name the last one took", async () => {
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

	test("a folder name with no latin letters or digits becomes the default world", async () => {
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
		expect(outcome?.notice.ar).toBe(`أضفنا الماب "عالمي" باسم "world" لأن اسم مجلدها ما فيه حروف إنجليزية ولا أرقام.`);
	});

	test("a level file at the root of the upload keeps the staging folder name and leaves nothing behind", async () => {
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

	test("a Bedrock world in the archive fails before anything moves", async () => {
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
		files: {
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
	test("more than five worlds become one entry with the count and the first names", async () => {
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
	test("activating a world names it and the world it replaced", async () => {
		const { context, reported } = managed("world");

		await worlds.actions?.activate?.(context, ROW, {});

		expect(reported).toEqual([
			{
				name: BridgeEventName.WorldActivated,
				text: {
					ar: "تم تفعيل ماب creative بدل world",
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

	test("deleting a world reports it only once it is gone", async () => {
		const { context, reported, removed } = managed("world");

		await worlds.actions?.delete?.(context, ROW, {});

		expect(removed.length).toBeGreaterThan(0);
		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.WorldDeleted,
		]);
		expect(reported.at(0)?.subject).toBe("creative");
	});

	test("the active world is refused and nothing is reported", async () => {
		const { context, reported } = managed("creative");

		await expect(worlds.actions?.delete?.(context, ROW, {})).rejects.toThrow();
		expect(reported).toEqual([]);
	});

	test("resetting the nether and the end each say which dimension was wiped", async () => {
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
