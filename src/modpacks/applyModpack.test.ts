import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { STAGING_ROOT } from "../shared";
import { parentDirectoriesOf, placePreparedFiles } from "./applyModpack";
import type { ModpackFile } from "./modpackIndex";

const file = (path: string): ModpackFile => ({
	path,
	url: `https://cdn.modrinth.com/${path}`,
	digest: "sha1:da39a3ee5e6b4b0d3255bfef95601890afd80709",
	sizeBytes: 1,
	projectId: null,
});

const fixture = () => {
	const directories = new Set<string>();
	const moves: [
		string,
		string,
	][] = [];
	const context = {
		files: {
			ensure: async (...paths: string[]) => {
				for (const path of paths) {
					directories.add(path);
				}
			},
			move: async (from: string, to: string) => {
				const parent = to.split("/").slice(0, -1).join("/");

				if (parent.length > 0 && !directories.has(parent)) {
					throw new Error(`ENOENT: no such file or directory, rename '${from}' -> '${to}'`);
				}

				moves.push([
					from,
					to,
				]);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		directories,
		moves,
	};
};

describe("the folders a modpack's files land in", () => {
	test("lists every distinct parent folder once and skips files at the root", () => {
		expect(
			parentDirectoriesOf([
				"mods/a.jar",
				"mods/b.jar",
				"config/x/y.toml",
				"README.md",
			]),
		).toEqual([
			"mods",
			"config/x",
		]);
	});
});

describe("placing the staged modpack files", () => {
	test("creates the mods folder and every parent folder before moving, so a wiped server takes the pack", async () => {
		const { context, directories, moves } = fixture();

		await placePreparedFiles(context, [
			file("mods/modnametooltip_1.16.2-1.15.0.jar"),
			file("config/kubejs/client.toml"),
		]);

		expect([
			...directories,
		]).toEqual([
			"mods",
			"config/kubejs",
		]);
		expect(moves).toEqual([
			[
				`${STAGING_ROOT}/pack/content/mods/modnametooltip_1.16.2-1.15.0.jar`,
				"mods/modnametooltip_1.16.2-1.15.0.jar",
			],
			[
				`${STAGING_ROOT}/pack/content/config/kubejs/client.toml`,
				"config/kubejs/client.toml",
			],
		]);
	});

	test("still creates the mods folder when the pack ships nothing for it, so a rescued jar has a home", async () => {
		const { context, directories } = fixture();

		await placePreparedFiles(context, []);

		expect(directories.has("mods")).toBe(true);
	});
});
