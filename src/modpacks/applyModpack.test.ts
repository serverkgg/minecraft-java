import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import type { ModpackRelease } from "../providers";
import { STAGING_ROOT } from "../shared";
import { parentDirectoriesOf, placePreparedFiles, releaseIdentity } from "./applyModpack";
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

const release = (loaders: string[], gameVersions: string[]): ModpackRelease => ({
	versionId: "8902446",
	version: "4.1.0",
	stable: true,
	loaders,
	gameVersions,
	file: {
		filename: "pack.zip",
		url: "https://edge.forgecdn.net/files/8902/446/pack.zip",
		sizeBytes: null,
		digest: null,
	},
	serverPacks: [],
});

describe("naming the type and version a modpack release runs on", () => {
	test("drops the family tag and labels the loader the way the panel does", () => {
		expect(
			releaseIdentity(
				release(
					[
						"fabric",
					],
					[
						"1.20.1",
						"1.20",
					],
				),
				"1.21.1",
			),
		).toEqual({
			ar: "1.20.1 · Fabric",
			en: "1.20.1 · Fabric",
		});
	});

	test("keeps the raw loader ids when the release runs on a loader we have no server type for", () => {
		expect(
			releaseIdentity(
				release(
					[
						"quilt",
					],
					[
						"1.20.1",
					],
				),
				"1.20.1",
			),
		).toEqual({
			ar: "1.20.1 · quilt",
			en: "1.20.1 · quilt",
		});
	});

	test("falls back to the raw tags when none of them is a release version", () => {
		expect(
			releaseIdentity(
				release(
					[
						"fabric",
					],
					[
						"23w31a",
					],
				),
				"1.21.1",
			),
		).toEqual({
			ar: "23w31a · Fabric",
			en: "23w31a · Fabric",
		});
	});

	test("says so in both languages when the release names neither a version nor a loader", () => {
		expect(releaseIdentity(release([], []), "1.21.1")).toEqual({
			ar: "نسخة ما نعرفها · مشغّل ما نعرفه",
			en: "an unknown version · an unknown loader",
		});
	});
});
