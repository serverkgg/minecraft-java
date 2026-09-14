import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { WorldLayout } from "../shared";
import {
	discoveredWorlds,
	freeWorldName,
	levelDirectories,
	mainLevelDirectories,
	safeWorldName,
	suffixedWorldName,
	worldBaseName,
	worldDimensions,
	worldImportNotice,
	worldPaths,
	worldRenameSentence,
} from "./world";

describe("reading the worlds out of the volume scan", () => {
	test("every directory holding a level file is a world", () => {
		expect(discoveredWorlds("./world/level.dat\n./creative/level.dat\n")).toEqual([
			"creative",
			"world",
		]);
	});

	test("a bukkit dimension folder is folded into the world it belongs to", () => {
		expect(discoveredWorlds("./world/level.dat\n./world_nether/level.dat\n./world_the_end/level.dat\n")).toEqual([
			"world",
		]);
	});

	test("a dimension folder whose overworld is gone stands on its own", () => {
		expect(discoveredWorlds("./creative_nether/level.dat\n")).toEqual([
			"creative_nether",
		]);
	});

	test("a level file outside a world directory is ignored", () => {
		expect(discoveredWorlds("./level.dat\n./world/dimensions/level.dat\n")).toEqual([]);
	});

	test("hidden directories are ignored, so our own staging never looks like a world", () => {
		expect(discoveredWorlds("./.serverk-staging/level.dat\n./world/level.dat\n")).toEqual([
			"world",
		]);
	});

	test("empty output and blank lines yield no worlds", () => {
		expect(discoveredWorlds("")).toEqual([]);
		expect(discoveredWorlds("\n\n")).toEqual([]);
	});
});

describe("reading the level directories out of an upload scan", () => {
	test("the directory holding each level file is returned, sorted and deduplicated", () => {
		expect(
			levelDirectories(
				".serverk-staging/world-upload/pack/world/level.dat\n.serverk-staging/world-upload/save/level.dat\n.serverk-staging/world-upload/pack/world/level.dat\n",
			),
		).toEqual([
			".serverk-staging/world-upload/pack/world",
			".serverk-staging/world-upload/save",
		]);
	});

	test("a level file with no directory above it is ignored", () => {
		expect(levelDirectories("level.dat\n/level.dat\n")).toEqual([]);
	});

	test("empty output yields nothing", () => {
		expect(levelDirectories("")).toEqual([]);
	});
});

describe("picking the worlds an upload actually holds", () => {
	test("a dimension folder is folded into the world it belongs to", () => {
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

	test("every world in the archive is kept, sorted", () => {
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

	test("a dimension folder whose overworld is missing stands on its own", () => {
		expect(
			mainLevelDirectories([
				"staging/creative_nether",
			]),
		).toEqual([
			"staging/creative_nether",
		]);
	});

	test("nothing found means nothing to import", () => {
		expect(mainLevelDirectories([])).toEqual([]);
	});
});

describe("deriving the world name a folder asks for", () => {
	test("a usable folder name is kept", () => {
		expect(worldBaseName("creative")).toBe("creative");
		expect(worldBaseName("My World")).toBe("My-World");
	});

	test("a folder name with no latin letters or digits falls back to the default world", () => {
		expect(worldBaseName("عالمي")).toBe("world");
		expect(worldBaseName("")).toBe("world");
	});
});

describe("suffixing a taken world name", () => {
	test("the attempt is appended", () => {
		expect(suffixedWorldName("world", 2)).toBe("world-2");
		expect(suffixedWorldName("world", 11)).toBe("world-11");
	});

	test("the base is trimmed so the suffixed name still fits the limit", () => {
		expect(suffixedWorldName("w".repeat(32), 2)).toBe(`${"w".repeat(30)}-2`);
		expect(suffixedWorldName("w".repeat(32), 10)).toBe(`${"w".repeat(29)}-10`);
	});

	test("trimming never leaves a dangling separator", () => {
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

	test("a free base name is taken as it is", async () => {
		await expect(freeWorldName(contextWith([]), "world")).resolves.toBe("world");
	});

	test("a taken name gets the first free suffix", async () => {
		await expect(
			freeWorldName(
				contextWith([
					"world",
				]),
				"world",
			),
		).resolves.toBe("world-2");
	});

	test("a name is taken when any of its dimension folders is", async () => {
		await expect(
			freeWorldName(
				contextWith([
					"world_the_end",
				]),
				"world",
			),
		).resolves.toBe("world-2");
	});

	test("the suffix climbs until nothing is in the way", async () => {
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

	test("a crowded name eventually gives up instead of looping forever", async () => {
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
	test("a plain name is kept", () => {
		expect(safeWorldName("world")).toBe("world");
		expect(safeWorldName("my_world-2")).toBe("my_world-2");
	});

	test("spaces and anything else outside the allowed set become dashes", () => {
		expect(safeWorldName("my world")).toBe("my-world");
		expect(safeWorldName("عالمي")).toBe("");
	});

	test("a name that tries to walk out of the volume cannot", () => {
		expect(safeWorldName("../etc")).toBe("etc");
		expect(safeWorldName("/etc/passwd")).toBe("etc-passwd");
		expect(safeWorldName("..")).toBe("");
	});

	test("a long name is cut to the limit", () => {
		expect(safeWorldName("w".repeat(64))).toBe("w".repeat(32));
	});
});

describe("naming a world's dimension folders", () => {
	test("a unified world keeps its dimensions inside itself", () => {
		expect(worldDimensions("world", WorldLayout.Unified)).toEqual({
			nether: "world/dimensions/minecraft/the_nether",
			end: "world/dimensions/minecraft/the_end",
		});
	});

	test("a bukkit server splits them into sibling folders", () => {
		expect(worldDimensions("world", WorldLayout.Bukkit)).toEqual({
			nether: "world_nether",
			end: "world_the_end",
		});
	});

	test("a legacy vanilla world keeps them in the numbered folders", () => {
		expect(worldDimensions("world", WorldLayout.Vanilla)).toEqual({
			nether: "world/DIM-1",
			end: "world/DIM1",
		});
	});
});

describe("the paths a world occupies", () => {
	test("the world and both bukkit dimension folders are covered", () => {
		expect(worldPaths("creative")).toEqual([
			"creative",
			"creative_nether",
			"creative_the_end",
		]);
	});
});

describe("telling the player why an imported world changed its name", () => {
	test("a world that kept its folder name says nothing", () => {
		expect(worldRenameSentence("creative", "creative")).toBeNull();
	});

	test("a taken name names the world that was already there", () => {
		expect(worldRenameSentence("world", "world-2")).toEqual({
			ar: `أضفنا الماب "world" باسم "world-2" لأن عندك ماب اسمها "world".`,
			en: `The world "world" was added as "world-2" because a world named "world" is already here.`,
		});
	});

	test("a folder name with no latin letters or digits says so", () => {
		expect(worldRenameSentence("عالمي", "world")).toEqual({
			ar: `أضفنا الماب "عالمي" باسم "world" لأن اسم مجلدها ما فيه حروف إنجليزية ولا أرقام.`,
			en: `The world "عالمي" was added as "world" because its folder name has no Latin letters or digits.`,
		});
	});

	test("an import where nothing was renamed carries no notice", () => {
		expect(
			worldImportNotice([
				{
					folder: "creative",
					name: "creative",
				},
			]),
		).toBeNull();
	});

	test("every renamed world gets its own line", () => {
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
