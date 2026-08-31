import { describe, expect, test } from "bun:test";
import { isClientOnlyFilename, isClientOnlyPath } from "./clientMods";

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
});
