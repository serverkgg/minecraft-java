import { describe, expect, test } from "bun:test";
import { manifestSchema } from "@serverkgg/bridge/manifest";
import { ServerVariant } from "../shared";
import { COMPANIONS, CompanionId, CROSSPLAY, FABRIC_API } from "./companion";

const MANIFEST_PATH = `${import.meta.dir}/../../serverk.yml`;

const manifest = manifestSchema.parse(Bun.YAML.parse(await Bun.file(MANIFEST_PATH).text()));

describe("the bedrock address only exists when crossplay can run", () => {
	test("the bedrock port is live on the server types Geyser supports, with crossplay on", () => {
		const bedrock = manifest.container.ports.find((port) => port.key === "bedrock");

		expect(bedrock?.activeWhen).toMatchObject([
			{
				variable: "SERVER_TYPE",
				values: CROSSPLAY.variants,
			},
			{
				variable: CROSSPLAY.variable,
				values: [
					"true",
				],
			},
		]);
	});

	test("the java port is always live", () => {
		const game = manifest.container.ports.find((port) => port.key === "game");

		expect(game?.activeWhen).toEqual([]);
	});
});

describe("a companion brings the libraries its loader needs", () => {
	const geyser = COMPANIONS.find((companion) => companion.id === CompanionId.Geyser);
	const floodgate = COMPANIONS.find((companion) => companion.id === CompanionId.Floodgate);

	test("the fabric builds of geyser and floodgate ask for fabric api, which they refuse to load without", () => {
		expect(geyser?.artifacts[ServerVariant.Fabric]?.requires).toEqual([
			FABRIC_API,
		]);
		expect(floodgate?.artifacts[ServerVariant.Fabric]?.requires).toEqual([
			FABRIC_API,
		]);
	});

	test("the neoforge and plugin builds need no library of their own", () => {
		for (const variant of [
			ServerVariant.NeoForge,
			ServerVariant.Paper,
			ServerVariant.Purpur,
		]) {
			expect(geyser?.artifacts[variant]?.requires).toEqual([]);
			expect(floodgate?.artifacts[variant]?.requires).toEqual([]);
		}
	});

	test("fabric api is read from modrinth for the version the server runs", () => {
		expect(FABRIC_API.project).toBe("P7dR8mSH");
		expect(FABRIC_API.loader).toBe("fabric");
		expect(FABRIC_API.files.test("fabric-api-0.145.5+26.2.jar")).toBe(true);
		expect(FABRIC_API.files.test("fabric-api.jar")).toBe(true);
		expect(FABRIC_API.files.test("fabric-carpet-1.4.166.jar")).toBe(false);
	});
});

describe("a mod build of a companion is pinned to the version the server runs", () => {
	const geyser = COMPANIONS.find((companion) => companion.id === CompanionId.Geyser);
	const floodgate = COMPANIONS.find((companion) => companion.id === CompanionId.Floodgate);

	test("the fabric and neoforge builds are read from modrinth for the version the server runs", () => {
		for (const variant of [
			ServerVariant.Fabric,
			ServerVariant.NeoForge,
		]) {
			expect(geyser?.artifacts[variant]?.modrinth?.matchGameVersion).toBe(true);
			expect(floodgate?.artifacts[variant]?.modrinth?.matchGameVersion).toBe(true);
		}
	});

	test("the fabric and neoforge builds of geyser never fall back to the newest build", () => {
		for (const variant of [
			ServerVariant.Fabric,
			ServerVariant.NeoForge,
		]) {
			expect(geyser?.artifacts[variant]?.download).toBeNull();
		}
	});

	test("the plugin builds of geyser still come from geysermc, where one jar spans versions", () => {
		for (const variant of [
			ServerVariant.Paper,
			ServerVariant.Purpur,
		]) {
			expect(geyser?.artifacts[variant]?.download).toMatchObject({
				project: "geyser",
			});
		}
	});
});
