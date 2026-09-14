import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { WORLD_STAGING } from "../shared";
import { worlds } from "./worlds";

const UPLOAD = `${WORLD_STAGING}/9f1/save`;

interface Stage {
	context: Bridge.Context;
	moves: string[][];
	removed: string[];
	added: string[][];
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
	} as unknown as Bridge.Context;

	return {
		context,
		moves,
		removed,
		added,
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
		const { context, moves, removed, added } = stage(
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
