import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { WorldLayout } from "../shared";
import {
	archivedWorldName,
	archiveWorld,
	discoveredWorlds,
	freeWorldName,
	levelDirectories,
	mainLevelDirectories,
	planWorldArchive,
	safeWorldName,
	suffixedWorldName,
	worldBaseName,
	worldDimensions,
	worldImportNotice,
	worldPaths,
	worldRenameSentence,
} from "./world";

describe("reading the worlds out of the volume scan", () => {
	it("every directory holding a level file is a world", () => {
		expect(discoveredWorlds("./world/level.dat\n./creative/level.dat\n")).toEqual([
			"creative",
			"world",
		]);
	});

	it("a bukkit dimension folder is folded into the world it belongs to", () => {
		expect(discoveredWorlds("./world/level.dat\n./world_nether/level.dat\n./world_the_end/level.dat\n")).toEqual([
			"world",
		]);
	});

	it("a dimension folder whose overworld is gone stands on its own", () => {
		expect(discoveredWorlds("./creative_nether/level.dat\n")).toEqual([
			"creative_nether",
		]);
	});

	it("a level file outside a world directory is ignored", () => {
		expect(discoveredWorlds("./level.dat\n./world/dimensions/level.dat\n")).toEqual([]);
	});

	it("hidden directories are ignored, so our own staging never looks like a world", () => {
		expect(discoveredWorlds("./.serverk-staging/level.dat\n./world/level.dat\n")).toEqual([
			"world",
		]);
	});

	it("empty output and blank lines yield no worlds", () => {
		expect(discoveredWorlds("")).toEqual([]);
		expect(discoveredWorlds("\n\n")).toEqual([]);
	});
});

describe("reading the level directories out of an upload scan", () => {
	it("the directory holding each level file is returned, sorted and deduplicated", () => {
		expect(
			levelDirectories(
				".serverk-uploads/world/pack/world/level.dat\n.serverk-uploads/world/save/level.dat\n.serverk-uploads/world/pack/world/level.dat\n",
			),
		).toEqual([
			".serverk-uploads/world/pack/world",
			".serverk-uploads/world/save",
		]);
	});

	it("a level file with no directory above it is ignored", () => {
		expect(levelDirectories("level.dat\n/level.dat\n")).toEqual([]);
	});

	it("empty output yields nothing", () => {
		expect(levelDirectories("")).toEqual([]);
	});
});

describe("picking the worlds an upload actually holds", () => {
	it("a dimension folder is folded into the world it belongs to", () => {
		expect(
			mainLevelDirectories([
				"staging/world",
				"staging/world_nether",
				"staging/world_the_end",
			]),
		).toEqual([
			"staging/world",
		]);
	});

	it("every world in the archive is kept, sorted", () => {
		expect(
			mainLevelDirectories([
				"staging/survival",
				"staging/creative",
				"staging/creative_nether",
			]),
		).toEqual([
			"staging/creative",
			"staging/survival",
		]);
	});

	it("a dimension folder whose overworld is missing stands on its own", () => {
		expect(
			mainLevelDirectories([
				"staging/creative_nether",
			]),
		).toEqual([
			"staging/creative_nether",
		]);
	});

	it("nothing found means nothing to import", () => {
		expect(mainLevelDirectories([])).toEqual([]);
	});
});

describe("deriving the world name a folder asks for", () => {
	it("a usable folder name is kept", () => {
		expect(worldBaseName("creative")).toBe("creative");
		expect(worldBaseName("My World")).toBe("My-World");
	});

	it("a folder name with no latin letters or digits falls back to the default world", () => {
		expect(worldBaseName("عالمي")).toBe("world");
		expect(worldBaseName("")).toBe("world");
	});
});

describe("suffixing a taken world name", () => {
	it("the attempt is appended", () => {
		expect(suffixedWorldName("world", 2)).toBe("world-2");
		expect(suffixedWorldName("world", 11)).toBe("world-11");
	});

	it("the base is trimmed so the suffixed name still fits the limit", () => {
		expect(suffixedWorldName("w".repeat(32), 2)).toBe(`${"w".repeat(30)}-2`);
		expect(suffixedWorldName("w".repeat(32), 10)).toBe(`${"w".repeat(29)}-10`);
	});

	it("trimming never leaves a dangling separator", () => {
		expect(suffixedWorldName(`${"w".repeat(29)}-xy`, 2)).toBe(`${"w".repeat(29)}-2`);
	});
});

describe("finding a free world name", () => {
	const contextWith = (taken: string[]) => {
		return {
			files: {
				exists: async (path: string) => taken.includes(path),
			},
		} as unknown as Bridge.Context;
	};

	it("a free base name is taken as it is", async () => {
		await expect(freeWorldName(contextWith([]), "world")).resolves.toBe("world");
	});

	it("a taken name gets the first free suffix", async () => {
		await expect(
			freeWorldName(
				contextWith([
					"world",
				]),
				"world",
			),
		).resolves.toBe("world-2");
	});

	it("a name is taken when any of its dimension folders is", async () => {
		await expect(
			freeWorldName(
				contextWith([
					"world_the_end",
				]),
				"world",
			),
		).resolves.toBe("world-2");
	});

	it("the suffix climbs until nothing is in the way", async () => {
		await expect(
			freeWorldName(
				contextWith([
					"world",
					"world-2",
					"world-3_nether",
				]),
				"world",
			),
		).resolves.toBe("world-4");
	});

	it("a crowded name eventually gives up instead of looping forever", async () => {
		await expect(freeWorldName(contextWith(worldPaths("world")), "world")).resolves.toBe("world-2");
		await expect(
			freeWorldName(
				{
					files: {
						exists: async () => true,
					},
				} as unknown as Bridge.Context,
				"world",
			),
		).rejects.toThrow();
	});
});

describe("making a player's world name safe to write to disk", () => {
	it("a plain name is kept", () => {
		expect(safeWorldName("world")).toBe("world");
		expect(safeWorldName("my_world-2")).toBe("my_world-2");
	});

	it("spaces and anything else outside the allowed set become dashes", () => {
		expect(safeWorldName("my world")).toBe("my-world");
		expect(safeWorldName("عالمي")).toBe("");
	});

	it("a name that tries to walk out of the volume cannot", () => {
		expect(safeWorldName("../etc")).toBe("etc");
		expect(safeWorldName("/etc/passwd")).toBe("etc-passwd");
		expect(safeWorldName("..")).toBe("");
	});

	it("a long name is cut to the limit", () => {
		expect(safeWorldName("w".repeat(64))).toBe("w".repeat(32));
	});
});

describe("naming a world's dimension folders", () => {
	it("a unified world keeps its dimensions inside itself", () => {
		expect(worldDimensions("world", WorldLayout.Unified)).toEqual({
			nether: "world/dimensions/minecraft/the_nether",
			end: "world/dimensions/minecraft/the_end",
		});
	});

	it("a bukkit server splits them into sibling folders", () => {
		expect(worldDimensions("world", WorldLayout.Bukkit)).toEqual({
			nether: "world_nether",
			end: "world_the_end",
		});
	});

	it("a legacy vanilla world keeps them in the numbered folders", () => {
		expect(worldDimensions("world", WorldLayout.Vanilla)).toEqual({
			nether: "world/DIM-1",
			end: "world/DIM1",
		});
	});
});

describe("the paths a world occupies", () => {
	it("the world and both bukkit dimension folders are covered", () => {
		expect(worldPaths("creative")).toEqual([
			"creative",
			"creative_nether",
			"creative_the_end",
		]);
	});
});

describe("telling the player why an imported world changed its name", () => {
	it("a world that kept its folder name says nothing", () => {
		expect(worldRenameSentence("creative", "creative")).toBeNull();
	});

	it("a taken name names the world that was already there", () => {
		expect(worldRenameSentence("world", "world-2")).toEqual({
			ar: `تمت إضافة الماب «world» باسم «world-2» لأن لديك ماب باسم «world».`,
			en: `The world "world" was added as "world-2" because a world named "world" is already here.`,
		});
	});

	it("a folder name with no latin letters or digits says so", () => {
		expect(worldRenameSentence("عالمي", "world")).toEqual({
			ar: `تمت إضافة الماب «عالمي» باسم «world» لأن اسم مجلده لا يحتوي على حروف إنجليزية أو أرقام.`,
			en: `The world "عالمي" was added as "world" because its folder name has no Latin letters or digits.`,
		});
	});

	it("an import where nothing was renamed carries no notice", () => {
		expect(
			worldImportNotice([
				{
					folder: "creative",
					name: "creative",
				},
			]),
		).toBeNull();
	});

	it("every renamed world gets its own line", () => {
		const notice = worldImportNotice([
			{
				folder: "creative",
				name: "creative",
			},
			{
				folder: "world",
				name: "world-2",
			},
			{
				folder: "عالمي",
				name: "world",
			},
		]);

		expect(notice?.en.split("\n")).toHaveLength(2);
		expect(notice?.ar.split("\n")).toHaveLength(2);
		expect(notice?.en.split("\n").at(0)).toContain(`"world-2"`);
		expect(notice?.ar.split("\n").at(1)).toContain("حروف إنجليزية");
	});
});

describe("archivedWorldName", () => {
	it("joins the world, the pack and old", () => {
		expect(archivedWorldName("world", "All the Mods 9")).toBe("world-all-the-mods-9-old");
	});

	it("stays a valid world name of 32 characters at most, ending in -old", () => {
		const name = archivedWorldName("survival", "Better Minecraft [FORGE] - MC 1.20.1 Edition");

		expect(name.length).toBeLessThanOrEqual(32);
		expect(name.endsWith("-old")).toBe(true);
		expect(safeWorldName(name)).toBe(name);
		expect(name).toBe("survival-better-minecraft-fo-old");
	});

	it("a pack name with no Latin letters keeps just the world", () => {
		expect(archivedWorldName("world", "مودباك")).toBe("world-old");
	});
});

const volumeWith = (paths: string[], properties = true) => {
	const files = new Set(paths);
	const moves: string[][] = [];
	const merged: Record<string, string | number | boolean>[] = [];
	const under = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

	const context = {
		files: {
			exists: async (path: string) =>
				path === "server.properties"
					? properties
					: [
							...files,
						].some((entry) => under(entry, path)),
			move: async (from: string, to: string) => {
				moves.push([
					from,
					to,
				]);

				for (const entry of [
					...files,
				]) {
					if (under(entry, from)) {
						files.delete(entry);
						files.add(`${to}${entry.slice(from.length)}`);
					}
				}
			},
		},
		codec: {
			javaProperties: {
				read: async () => {
					return {
						"level-name": "world",
					};
				},
				merge: async (_path: string, values: Record<string, string | number | boolean>) => {
					merged.push(values);
				},
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		files,
		moves,
		merged,
	};
};

describe("archiveWorld", () => {
	it("moves the world with its nether and end under the archived name and starts a fresh world", async () => {
		const { context, files, moves, merged } = volumeWith([
			"world/level.dat",
			"world_nether/DIM-1/region",
			"world_the_end/DIM1/region",
		]);

		const archive = await planWorldArchive(context, "RLCraft");

		expect(archive).toEqual({
			from: "world",
			to: "world-rlcraft-old",
			fresh: "world",
		});

		if (archive) {
			await archiveWorld(context, archive);
		}

		expect(moves).toEqual([
			[
				"world",
				"world-rlcraft-old",
			],
			[
				"world_nether",
				"world-rlcraft-old_nether",
			],
			[
				"world_the_end",
				"world-rlcraft-old_the_end",
			],
		]);
		expect(
			[
				...files,
			].some((path) => path.startsWith("world/")),
		).toBe(false);
		expect(merged).toEqual([
			{
				"level-name": "world",
			},
		]);
	});

	it("takes the next free name when the archived name is already used", async () => {
		const { context } = volumeWith([
			"world/level.dat",
			"world-rlcraft-old/level.dat",
		]);

		expect((await planWorldArchive(context, "RLCraft"))?.to).toBe("world-rlcraft-old-2");
	});

	it("has nothing to archive when the active world was never generated", async () => {
		const { context } = volumeWith([]);

		expect(await planWorldArchive(context, "RLCraft")).toBeNull();
	});
});
