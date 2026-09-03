import { describe, expect, test } from "bun:test";
import { CLIENT_ONLY_NAMES, isClientOnlyFilename, isClientOnlyPath, isServerSafeFilename } from "./clientMods";

const JAR_NAME = /^[a-z0-9._+-]+$/;

describe("telling a client-side mod apart by its file name", () => {
	test("recognises the mods that cannot run on a dedicated server", () => {
		for (const filename of [
			"entity_texture_features_1.20.1-forge-7.0.6.jar",
			"oculus-mc1.20.1-1.8.0.jar",
			"chat_heads-0.13.18-forge-1.20.jar",
			"citresewn-1.20.1-5.jar",
			"PresenceFootsteps-1.20.1-1.9.1-beta.1.jar",
			"figura-0.1.4+1.20.1.jar",
		]) {
			expect(isClientOnlyFilename(filename)).toBe(true);
		}
	});

	test("leaves the mods a server depends on alone", () => {
		for (const filename of [
			"fabric-api-0.92.6+1.20.1.jar",
			"Chunky-1.3.146.jar",
			"spark-1.10.53-forge.jar",
			"luckperms-forge-5.4.102.jar",
			"architectury-9.2.14-forge.jar",
			"geckolib-forge-1.20.1-4.8.2.jar",
			"BiomesOPlenty-1.20.1-19.0.0.96.jar",
			"kubejs-forge-2001.6.5-build.16.jar",
		]) {
			expect(isClientOnlyFilename(filename)).toBe(false);
		}
	});

	test("matches a name only where it starts a word, so short entries cannot collide", () => {
		expect(isClientOnlyFilename("iris-1.6.17+mc1.20.1.jar")).toBe(true);
		expect(isClientOnlyFilename("polaris-1.0.0.jar")).toBe(false);
		expect(isClientOnlyFilename("blur-3.1.0.jar")).toBe(true);
		expect(isClientOnlyFilename("colorblurred-2.0.jar")).toBe(false);
	});

	test("treats everything under a client-side folder as client-side", () => {
		expect(isClientOnlyPath("shaderpacks/ComplementaryUnbound_r5.2.zip")).toBe(true);
		expect(isClientOnlyPath("resourcepacks/Faithful.zip")).toBe(true);
		expect(isClientOnlyPath("mods/Chunky-1.3.146.jar")).toBe(false);
		expect(isClientOnlyPath("config/forge-server.toml")).toBe(false);
	});

	test("catches the checker that crash-looped a server on boot", () => {
		expect(isClientOnlyFilename("MissingModsChecker-1.20.1-1.1.jar")).toBe(true);
	});

	test("catches wakes, which every side signal called server-safe", () => {
		expect(isClientOnlyFilename("wakes-1.21.1-NeoForge-1.4.0.jar")).toBe(true);
		expect(isClientOnlyFilename("Wakes-Reforged-1.21.1-1.4.0.jar")).toBe(true);
		expect(isClientOnlyFilename("awakescape-1.0.0.jar")).toBe(false);
	});

	test("catches the jar spellings, not only the catalog slugs", () => {
		for (const filename of [
			"CullLessLeaves-Reforged-1.20.1-1.0.1.jar",
			"InventoryProfilesNext-forge-1.20-1.10.10.jar",
			"RoughlyEnoughItems-13.0.683-forge.jar",
			"eatinganimation-1.20.1-2.0.2.jar",
			"crash_assistant-1.20.1-1.1.0.jar",
			"particle-rain-3.1.0.jar",
			"entity-texture-features-forge-1.20.1-6.0.1.jar",
		]) {
			expect(isClientOnlyFilename(filename)).toBe(true);
		}
	});

	test("every deny entry is spelled the way a jar name can be, so none of them lie dormant", () => {
		expect(CLIENT_ONLY_NAMES.filter((entry) => !JAR_NAME.test(entry))).toEqual([]);
	});

	test("keeps the deny list sorted and free of duplicates", () => {
		expect(CLIENT_ONLY_NAMES).toEqual(
			[
				...new Set(CLIENT_ONLY_NAMES),
			].sort(),
		);
	});
});

describe("the mods a server is always allowed to keep", () => {
	test("vetoes the deny list", () => {
		for (const filename of [
			"Ping-Wheel-1.9.2-forge-1.20.1.jar",
			"appleskin-forge-mc1.20.1-2.5.1.jar",
			"thulium-1.0.0.jar",
		]) {
			expect(isServerSafeFilename(filename)).toBe(true);
			expect(isClientOnlyFilename(filename)).toBe(false);
		}
	});

	test("does not whitelist a mod that merely looks alike", () => {
		expect(isServerSafeFilename("appleskinner-1.0.0.jar")).toBe(true);
		expect(isServerSafeFilename("crabappleskin-1.0.0.jar")).toBe(false);
	});
});
