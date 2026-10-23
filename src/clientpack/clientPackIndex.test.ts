import { describe, expect, it } from "bun:test";
import { BridgeUserError } from "@serverkgg/bridge";
import { parseModpackIndex } from "../modpacks";
import { ServerVariant } from "../shared";
import { type ClientPackIndexIdentity, type ClientPackModrinthMod, clientPackIndex } from "./clientPackIndex";

const SHA1_SODIUM = "1".repeat(40);

const SHA512_SODIUM = "a".repeat(128);

const SHA1_LITHIUM = "2".repeat(40);

const SHA512_LITHIUM = "b".repeat(128);

const identity = (overrides: Partial<ClientPackIndexIdentity> = {}): ClientPackIndexIdentity => {
	return {
		name: "Friends SMP",
		version: "3",
		mcVersion: "1.20.1",
		variant: ServerVariant.Fabric,
		loaderVersion: "0.15.3",
		...overrides,
	};
};

const SODIUM: ClientPackModrinthMod = {
	fileName: "sodium-fabric-0.5.8+mc1.20.1.jar",
	sha1: SHA1_SODIUM,
	sha512: SHA512_SODIUM,
	sizeBytes: 1_003_421,
	url: "https://cdn.modrinth.com/data/AANobbMI/versions/OihdIimA/sodium-fabric-0.5.8%2Bmc1.20.1.jar",
};

const LITHIUM: ClientPackModrinthMod = {
	fileName: "lithium-fabric-mc1.20.1-0.11.2.jar",
	sha1: SHA1_LITHIUM,
	sha512: SHA512_LITHIUM,
	sizeBytes: 702_310,
	url: "https://cdn.modrinth.com/data/gvQqBUqZ/versions/ZSNsJrPI/lithium-fabric-mc1.20.1-0.11.2.jar",
};

const LOADERS = [
	{
		variant: ServerVariant.Fabric,
		mcVersion: "1.20.1",
		loaderVersion: "0.15.3",
		dependency: "fabric-loader",
	},
	{
		variant: ServerVariant.Forge,
		mcVersion: "1.20.1",
		loaderVersion: "47.2.0",
		dependency: "forge",
	},
	{
		variant: ServerVariant.NeoForge,
		mcVersion: "1.21.1",
		loaderVersion: "21.1.72",
		dependency: "neoforge",
	},
];

describe("writing a client pack modrinth index", () => {
	it("writes the index the modrinth app imports, with the files in path order", () => {
		const text = clientPackIndex(identity(), [
			SODIUM,
			LITHIUM,
		]);

		expect(text).toBe(`{
  "formatVersion": 1,
  "game": "minecraft",
  "versionId": "3",
  "name": "Friends SMP",
  "files": [
    {
      "path": "mods/lithium-fabric-mc1.20.1-0.11.2.jar",
      "hashes": {
        "sha1": "${SHA1_LITHIUM}",
        "sha512": "${SHA512_LITHIUM}"
      },
      "env": {
        "client": "required",
        "server": "required"
      },
      "downloads": [
        "https://cdn.modrinth.com/data/gvQqBUqZ/versions/ZSNsJrPI/lithium-fabric-mc1.20.1-0.11.2.jar"
      ],
      "fileSize": 702310
    },
    {
      "path": "mods/sodium-fabric-0.5.8+mc1.20.1.jar",
      "hashes": {
        "sha1": "${SHA1_SODIUM}",
        "sha512": "${SHA512_SODIUM}"
      },
      "env": {
        "client": "required",
        "server": "required"
      },
      "downloads": [
        "https://cdn.modrinth.com/data/AANobbMI/versions/OihdIimA/sodium-fabric-0.5.8%2Bmc1.20.1.jar"
      ],
      "fileSize": 1003421
    }
  ],
  "dependencies": {
    "minecraft": "1.20.1",
    "fabric-loader": "0.15.3"
  }
}`);
	});

	it("writes the same text whatever order the mods arrive in", () => {
		expect(
			clientPackIndex(identity(), [
				LITHIUM,
				SODIUM,
			]),
		).toBe(
			clientPackIndex(identity(), [
				SODIUM,
				LITHIUM,
			]),
		);
	});

	it("names the loader dependency after the server type", () => {
		for (const loader of LOADERS) {
			const text = clientPackIndex(identity(loader), []);

			expect(JSON.parse(text).dependencies).toEqual({
				minecraft: loader.mcVersion,
				[loader.dependency]: loader.loaderVersion,
			});
		}
	});

	it("reads back through the package's own index parser for every mod loader", () => {
		for (const loader of LOADERS) {
			const parsed = parseModpackIndex(
				clientPackIndex(identity(loader), [
					SODIUM,
					LITHIUM,
				]),
			);

			expect(parsed).toEqual({
				name: "Friends SMP",
				mcVersion: loader.mcVersion,
				variant: loader.variant,
				loaderVersion: loader.loaderVersion,
				files: [
					{
						path: "mods/lithium-fabric-mc1.20.1-0.11.2.jar",
						url: LITHIUM.url,
						digest: `sha512:${SHA512_LITHIUM}`,
						sizeBytes: 702_310,
						projectId: "gvQqBUqZ",
					},
					{
						path: "mods/sodium-fabric-0.5.8+mc1.20.1.jar",
						url: SODIUM.url,
						digest: `sha512:${SHA512_SODIUM}`,
						sizeBytes: 1_003_421,
						projectId: "AANobbMI",
					},
				],
				blocked: [],
			});
		}
	});

	it("writes a curseforge download address unchanged, because the modrinth app accepts any https host", () => {
		const url = "https://edge.forgecdn.net/files/4712/868/jei-1.20.1-forge-15.3.0.4.jar";

		const text = clientPackIndex(
			identity({
				variant: ServerVariant.Forge,
				loaderVersion: "47.2.0",
			}),
			[
				{
					...SODIUM,
					fileName: "jei-1.20.1-forge-15.3.0.4.jar",
					url,
				},
			],
		);

		expect(JSON.parse(text).files.at(0).downloads).toEqual([
			url,
		]);
	});

	it("writes the summary after the name when the pack has one", () => {
		const text = clientPackIndex(
			identity({
				summary: "The mods our server runs.",
			}),
			[],
		);

		expect(Object.keys(JSON.parse(text))).toEqual([
			"formatVersion",
			"game",
			"versionId",
			"name",
			"summary",
			"files",
			"dependencies",
		]);
		expect(JSON.parse(text).summary).toBe("The mods our server runs.");
	});

	it("leaves the summary out when the pack has none", () => {
		expect(JSON.parse(clientPackIndex(identity(), []))).not.toHaveProperty("summary");
	});

	it("refuses a file name that is not a plain name inside the mods folder", () => {
		for (const fileName of [
			"",
			".",
			"..",
			"../server.properties",
			"nested/sodium.jar",
			"/etc/passwd",
			"..\\sodium.jar",
		]) {
			expect(() => {
				clientPackIndex(identity(), [
					{
						...SODIUM,
						fileName,
					},
				]);
			}).toThrow(BridgeUserError);
		}
	});

	it("keeps a file name with two dots inside it, because it cannot leave the mods folder", () => {
		const text = clientPackIndex(identity(), [
			{
				...SODIUM,
				fileName: "create..patch.jar",
			},
		]);

		expect(JSON.parse(text).files.at(0).path).toBe("mods/create..patch.jar");
	});

	it("refuses a server type that runs no mods", () => {
		for (const variant of [
			ServerVariant.Paper,
			ServerVariant.Purpur,
			ServerVariant.Vanilla,
		]) {
			expect(() => {
				clientPackIndex(
					identity({
						variant,
					}),
					[],
				);
			}).toThrow(BridgeUserError);
		}
	});
});
