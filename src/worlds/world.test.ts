import { describe, expect, test } from "bun:test";
import { WorldLayout } from "../shared";
import { discoveredWorlds, levelDirectories, safeWorldName, worldDimensions, worldPaths } from "./world";

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
