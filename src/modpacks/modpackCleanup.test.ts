import { describe, expect, test } from "bun:test";
import { ADDON_SIDECAR } from "../addons";
import { modpackCleanup, PACK_DIRECTORIES } from "./modpackCleanup";

const PREVIOUS = [
	"mods/create-1.20.1.jar",
	"mods/jei-15.2.0.jar",
	"config/create-server.toml",
	"kubejs/server_scripts/recipes.js",
];

describe("clearing the last modpack before the next one goes in", () => {
	test("removes only the files that modpack installed, and the copies the doctor disabled", () => {
		expect(modpackCleanup(PREVIOUS).paths).toEqual([
			"config/create-server.toml",
			"config/create-server.toml.disabled",
			"kubejs/server_scripts/recipes.js",
			"kubejs/server_scripts/recipes.js.disabled",
			"mods/create-1.20.1.jar",
			"mods/create-1.20.1.jar.disabled",
			"mods/jei-15.2.0.jar",
			"mods/jei-15.2.0.jar.disabled",
		]);
	});

	test("clears a jar the crash doctor renamed out of the way", () => {
		expect(modpackCleanup(PREVIOUS).paths).toContain("mods/jei-15.2.0.jar.disabled");
	});

	test("leaves a mod the player installed themselves alone", () => {
		const paths = modpackCleanup(PREVIOUS).paths;

		expect(paths).not.toContain("mods/dynmap-3.7.jar");
		expect(paths).not.toContain("mods/dynmap-3.7.jar.disabled");
		expect(paths.some((path) => path.startsWith("config/dynmap"))).toBe(false);
	});

	test("never deletes the file that tracks the player's own mods", () => {
		const paths = modpackCleanup([
			"mods/create-1.20.1.jar",
			`mods/${ADDON_SIDECAR}`,
		]).paths;

		expect(paths).toEqual([
			"mods/create-1.20.1.jar",
			"mods/create-1.20.1.jar.disabled",
		]);
	});

	test("falls back to the old wholesale wipe when the modpack predates this record", () => {
		const cleanup = modpackCleanup(null);

		expect(cleanup.wholesale).toBe(true);
		expect(cleanup.paths).toEqual(PACK_DIRECTORIES);
	});

	test("does not treat a recorded file list as a wholesale wipe", () => {
		expect(modpackCleanup(PREVIOUS).wholesale).toBe(false);
		expect(modpackCleanup([]).wholesale).toBe(false);
	});

	test("ignores duplicates and empty entries the pack may have recorded twice", () => {
		expect(
			modpackCleanup([
				"mods/create-1.20.1.jar",
				"mods/create-1.20.1.jar",
				"",
			]).paths,
		).toEqual([
			"mods/create-1.20.1.jar",
			"mods/create-1.20.1.jar.disabled",
		]);
	});
});
