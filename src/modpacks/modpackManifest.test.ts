import { describe, expect, test } from "bun:test";
import {
	CurseforgeDependency,
	type CurseforgeFile,
	CurseforgeHash,
	type CurseforgeMod,
} from "@serverkgg/bridge/catalogs";
import { CURSEFORGE_CLASS_MODS, type ModrinthVersion } from "../providers";
import { ServerVariant } from "../shared";
import {
	ladderCurseforgeEntries,
	type ModpackManifestFile,
	parseCurseforgeManifest,
	partitionCurseforgeEntries,
} from "./modpackManifest";

const manifest = (overrides: Record<string, unknown> = {}) => {
	return JSON.stringify({
		minecraft: {
			version: "1.20.1",
			modLoaders: [
				{
					id: "forge-47.2.20",
					primary: true,
				},
			],
		},
		manifestType: "minecraftModpack",
		manifestVersion: 1,
		name: "Test Pack",
		version: "1.0.0",
		author: "someone",
		files: [
			{
				projectID: 238_222,
				fileID: 4_712_868,
				required: true,
			},
		],
		overrides: "overrides",
		...overrides,
	});
};

describe("reading a curseforge modpack manifest", () => {
	test("reads the pack a server can be built from", () => {
		const parsed = parseCurseforgeManifest(manifest());

		expect(parsed.mcVersion).toBe("1.20.1");
		expect(parsed.variant).toBe(ServerVariant.Forge);
		expect(parsed.loaderVersion).toBe("47.2.20");
		expect(parsed.overrides).toBe("overrides");
		expect(parsed.files).toEqual([
			{
				fileId: 4_712_868,
				projectId: 238_222,
				required: true,
			},
		]);
	});

	test("drops the minecraft version out of a three part neoforge loader id", () => {
		const parsed = parseCurseforgeManifest(
			manifest({
				minecraft: {
					version: "1.20.1",
					modLoaders: [
						{
							id: "neoforge-1.20.1-47.1.99",
							primary: true,
						},
					],
				},
			}),
		);

		expect(parsed.variant).toBe(ServerVariant.NeoForge);
		expect(parsed.loaderVersion).toBe("47.1.99");
	});

	test("keeps a loader version that carries its own suffix", () => {
		const parsed = parseCurseforgeManifest(
			manifest({
				minecraft: {
					version: "1.21.1",
					modLoaders: [
						{
							id: "neoforge-26.1.2.68-beta",
							primary: true,
						},
					],
				},
			}),
		);

		expect(parsed.loaderVersion).toBe("26.1.2.68-beta");
	});

	test("reads fabric packs", () => {
		const parsed = parseCurseforgeManifest(
			manifest({
				minecraft: {
					version: "1.20.1",
					modLoaders: [
						{
							id: "fabric-0.15.11",
							primary: true,
						},
					],
				},
			}),
		);

		expect(parsed.variant).toBe(ServerVariant.Fabric);
		expect(parsed.loaderVersion).toBe("0.15.11");
	});

	test("takes the loader the pack marked primary", () => {
		const parsed = parseCurseforgeManifest(
			manifest({
				minecraft: {
					version: "1.20.1",
					modLoaders: [
						{
							id: "fabric-0.15.11",
							primary: false,
						},
						{
							id: "forge-47.2.20",
							primary: true,
						},
					],
				},
			}),
		);

		expect(parsed.variant).toBe(ServerVariant.Forge);
	});

	test("falls back to the default overrides folder", () => {
		expect(
			parseCurseforgeManifest(
				manifest({
					overrides: undefined,
				}),
			).overrides,
		).toBe("overrides");
	});

	test("keeps the folder a pack named itself", () => {
		expect(
			parseCurseforgeManifest(
				manifest({
					overrides: "serverpack",
				}),
			).overrides,
		).toBe("serverpack");
	});

	test("refuses a quilt pack the way the modrinth reader does", () => {
		expect(() =>
			parseCurseforgeManifest(
				manifest({
					minecraft: {
						version: "1.20.1",
						modLoaders: [
							{
								id: "quilt-0.26.0",
								primary: true,
							},
						],
					},
				}),
			),
		).toThrow("quilt");
	});

	test("refuses a pack built for another game", () => {
		expect(() =>
			parseCurseforgeManifest(
				manifest({
					manifestType: "somethingElse",
				}),
			),
		).toThrow("not minecraft");
	});

	test("refuses a manifest version we have not read", () => {
		expect(() =>
			parseCurseforgeManifest(
				manifest({
					manifestVersion: 2,
				}),
			),
		).toThrow("manifest version 2");
	});

	test("refuses a pack with no minecraft version", () => {
		expect(() =>
			parseCurseforgeManifest(
				manifest({
					minecraft: {
						modLoaders: [
							{
								id: "forge-47.2.20",
								primary: true,
							},
						],
					},
				}),
			),
		).toThrow("no minecraft version");
	});

	test("refuses a pack with more files than we install", () => {
		expect(() =>
			parseCurseforgeManifest(
				manifest({
					files: Array.from(
						{
							length: 1025,
						},
						(_value, index) => {
							return {
								projectID: index + 1,
								fileID: index + 1,
								required: true,
							};
						},
					),
				}),
			),
		).toThrow("more than the 1024");
	});

	test("refuses json that is not a manifest", () => {
		expect(() => parseCurseforgeManifest("not json")).toThrow("not valid json");
	});
});

const TERRABLENDER = 563_928;

const BALM = 531_761;

const CLIMATE_RIVERS = 900_001;

const NETHER_PORTAL_FIX = 900_002;

const SODIUM = 900_003;

const JADE = 900_004;

const SEARCHABLES = 900_005;

const APPLESKIN = 900_006;

const MISSING = 900_999;

const requires = (...modIds: number[]) => {
	return modIds.map((modId) => {
		return {
			modId,
			relationType: CurseforgeDependency.Required,
		};
	});
};

const file = (fileName: string, modId: number, overrides: Partial<CurseforgeFile> = {}): CurseforgeFile => {
	return {
		id: modId * 10,
		modId,
		fileName,
		displayName: fileName,
		downloadUrl: `https://edge.forgecdn.net/files/1000/1/${fileName}`,
		fileLength: 1024,
		fileDate: "2026-01-01T00:00:00Z",
		isAvailable: true,
		releaseType: 1,
		gameVersions: [
			"1.20.1",
			"Fabric",
		],
		hashes: [],
		dependencies: [],
		...overrides,
	};
};

const clientTagged = (fileName: string, modId: number, overrides: Partial<CurseforgeFile> = {}) => {
	return file(fileName, modId, {
		gameVersions: [
			"1.20.1",
			"Fabric",
			"Client",
		],
		...overrides,
	});
};

const unreadable = (entry: CurseforgeFile) => {
	return {
		...entry,
		dependencies: undefined,
	} as unknown as CurseforgeFile;
};

const names = (entries: CurseforgeFile[]) => {
	return entries.map((entry) => entry.fileName);
};

describe("the curseforge dependency shield", () => {
	test("keeps the client-tagged library a kept mod requires", () => {
		const partition = partitionCurseforgeEntries([
			file("climaterivers-1.20.1-1.0.0.jar", CLIMATE_RIVERS, {
				dependencies: requires(TERRABLENDER),
			}),
			clientTagged("TerraBlender-fabric-1.20.1-3.0.1.7.jar", TERRABLENDER),
		]);

		expect(names(partition.installable)).toEqual([
			"climaterivers-1.20.1-1.0.0.jar",
			"TerraBlender-fabric-1.20.1-3.0.1.7.jar",
		]);
		expect(names(partition.shielded)).toEqual([
			"TerraBlender-fabric-1.20.1-3.0.1.7.jar",
		]);
		expect(partition.degraded).toBe(false);
	});

	test("keeps the library the library it shields requires", () => {
		const partition = partitionCurseforgeEntries([
			file("netherportalfix-fabric-1.20.1-13.0.1.jar", NETHER_PORTAL_FIX, {
				dependencies: requires(BALM),
			}),
			clientTagged("balm-fabric-1.20.1-7.3.7.jar", BALM, {
				dependencies: requires(TERRABLENDER),
			}),
			clientTagged("TerraBlender-fabric-1.20.1-3.0.1.7.jar", TERRABLENDER),
		]);

		expect(names(partition.shielded).sort()).toEqual(
			[
				"balm-fabric-1.20.1-7.3.7.jar",
				"TerraBlender-fabric-1.20.1-3.0.1.7.jar",
			].sort(),
		);
		expect(partition.installable.length).toBe(3);
	});

	test("still leaves out the client-tagged mod nothing requires", () => {
		const partition = partitionCurseforgeEntries([
			file("climaterivers-1.20.1-1.0.0.jar", CLIMATE_RIVERS),
			clientTagged("TerraBlender-fabric-1.20.1-3.0.1.7.jar", TERRABLENDER),
		]);

		expect(names(partition.installable)).toEqual([
			"climaterivers-1.20.1-1.0.0.jar",
		]);
		expect(partition.shielded.length).toBe(0);
	});

	test("keeps a jar the deny list names when a kept mod requires it", () => {
		const partition = partitionCurseforgeEntries([
			file("Jade-1.20.1-fabric-11.9.2.jar", JADE, {
				dependencies: requires(SEARCHABLES),
			}),
			clientTagged("Searchables-fabric-1.20.1-1.0.3.jar", SEARCHABLES),
		]);

		expect(names(partition.shielded)).toEqual([
			"Searchables-fabric-1.20.1-1.0.3.jar",
		]);
	});

	test("leaves the deny list in charge of a jar nothing requires", () => {
		const partition = partitionCurseforgeEntries([
			file("Jade-1.20.1-fabric-11.9.2.jar", JADE),
			file("sodium-fabric-0.5.11.jar", SODIUM),
		]);

		expect(names(partition.installable)).toEqual([
			"Jade-1.20.1-fabric-11.9.2.jar",
		]);
	});

	test("keeps a whitelisted file before any other signal reads it", () => {
		const partition = partitionCurseforgeEntries([
			clientTagged("appleskin-fabric-mc1.20.1-2.5.1.jar", APPLESKIN),
		]);

		expect(partition.installable.length).toBe(1);
		expect(partition.shielded.length).toBe(0);
	});

	test("names the dependency the pack never shipped instead of failing", () => {
		const partition = partitionCurseforgeEntries([
			file("climaterivers-1.20.1-1.0.0.jar", CLIMATE_RIVERS, {
				dependencies: requires(MISSING),
			}),
		]);

		expect(partition.absent).toEqual([
			MISSING,
		]);
		expect(partition.installable.length).toBe(1);
	});

	test("keeps every questionable file when curseforge sends no dependencies at all", () => {
		const partition = partitionCurseforgeEntries([
			unreadable(file("climaterivers-1.20.1-1.0.0.jar", CLIMATE_RIVERS)),
			unreadable(clientTagged("TerraBlender-fabric-1.20.1-3.0.1.7.jar", TERRABLENDER)),
			unreadable(clientTagged("balm-fabric-1.20.1-7.3.7.jar", BALM)),
			unreadable(clientTagged("sodium-fabric-0.5.11.jar", SODIUM)),
		]);

		expect(partition.degraded).toBe(true);
		expect(names(partition.installable)).toEqual([
			"climaterivers-1.20.1-1.0.0.jar",
			"TerraBlender-fabric-1.20.1-3.0.1.7.jar",
			"balm-fabric-1.20.1-7.3.7.jar",
		]);
		expect(partition.absent.length).toBe(0);
	});

	test("reads only the required relation, not the optional one", () => {
		const partition = partitionCurseforgeEntries([
			file("climaterivers-1.20.1-1.0.0.jar", CLIMATE_RIVERS, {
				dependencies: [
					{
						modId: TERRABLENDER,
						relationType: 2,
					},
				],
			}),
			clientTagged("TerraBlender-fabric-1.20.1-3.0.1.7.jar", TERRABLENDER),
		]);

		expect(partition.shielded.length).toBe(0);
		expect(partition.installable.length).toBe(1);
	});

	test("never lets a dependency cycle stall the shield", () => {
		const partition = partitionCurseforgeEntries([
			file("climaterivers-1.20.1-1.0.0.jar", CLIMATE_RIVERS, {
				dependencies: requires(TERRABLENDER),
			}),
			clientTagged("TerraBlender-fabric-1.20.1-3.0.1.7.jar", TERRABLENDER, {
				dependencies: requires(BALM),
			}),
			clientTagged("balm-fabric-1.20.1-7.3.7.jar", BALM, {
				dependencies: requires(TERRABLENDER, CLIMATE_RIVERS),
			}),
		]);

		expect(partition.installable.length).toBe(3);
		expect(partition.shielded.length).toBe(2);
	});
});

const SHA1 = "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33";

const SHA512 = "b".repeat(128);

const MODRINTH_PROJECT = "AABBCCDD";

const hashed = (entry: CurseforgeFile, value = SHA1): CurseforgeFile => {
	return {
		...entry,
		hashes: [
			{
				algo: CurseforgeHash.Sha1,
				value,
			},
		],
	};
};

const mod = (modId: number, overrides: Partial<CurseforgeMod> = {}): CurseforgeMod => {
	return {
		id: modId,
		classId: CURSEFORGE_CLASS_MODS,
		name: "Datafixer",
		slug: "bmc-patcher",
		summary: "",
		downloadCount: 0,
		authors: [],
		categories: [],
		dateModified: null,
		allowModDistribution: true,
		logo: null,
		links: null,
		...overrides,
	};
};

const mirrored = (fileName: string): ModrinthVersion => {
	return {
		id: "v1",
		project_id: MODRINTH_PROJECT,
		version_number: "1.0.0",
		version_type: "release",
		date_published: "2026-01-01T00:00:00Z",
		game_versions: [
			"1.20.1",
		],
		loaders: [
			"fabric",
		],
		files: [
			{
				url: `https://cdn.modrinth.com/data/${MODRINTH_PROJECT}/versions/1.0.0/${fileName}`,
				filename: fileName,
				primary: true,
				size: 2048,
				hashes: {
					sha512: SHA512,
				},
			},
		],
		dependencies: [],
	};
};

interface LadderOptions {
	mods?: CurseforgeMod[];
	matches?: Record<string, ModrinthVersion>;
	unsupported?: string[];
	wanted?: ModpackManifestFile[];
}

const ladder = (entries: CurseforgeFile[], options: LadderOptions = {}) => {
	return ladderCurseforgeEntries({
		installable: entries,
		matches: options.matches ?? {},
		mods: new Map(
			(options.mods ?? []).map((entry) => [
				entry.id,
				entry,
			]),
		),
		partition: partitionCurseforgeEntries(entries),
		unsupported: new Set(options.unsupported ?? []),
		wanted: new Map(
			(options.wanted ?? []).map((entry) => [
				entry.fileId,
				entry,
			]),
		),
	});
};

describe("the source ladder a curseforge modpack file walks", () => {
	test("takes the url curseforge handed us when there is one", () => {
		const result = ladder(
			[
				hashed(file("jei.jar", JADE)),
			],
			{
				mods: [
					mod(JADE),
				],
			},
		);

		expect(result.files).toEqual([
			{
				digest: `sha1:${SHA1}`,
				path: "mods/jei.jar",
				projectId: null,
				sizeBytes: 1024,
				url: "https://edge.forgecdn.net/files/1000/1/jei.jar",
			},
		]);
		expect(result.blocked).toEqual([]);
		expect(result.skipped).toBe(0);
	});

	test("takes the modrinth mirror when curseforge hands us no url", () => {
		const result = ladder(
			[
				hashed(
					file("jade.jar", JADE, {
						downloadUrl: null,
					}),
				),
			],
			{
				matches: {
					[SHA1]: mirrored("jade.jar"),
				},
				mods: [
					mod(JADE),
				],
			},
		);

		expect(result.files).toEqual([
			{
				digest: `sha512:${SHA512}`,
				path: "mods/jade.jar",
				projectId: MODRINTH_PROJECT,
				sizeBytes: 1024,
				url: `https://cdn.modrinth.com/data/${MODRINTH_PROJECT}/versions/1.0.0/jade.jar`,
			},
		]);
	});

	test("falls back to the id split url for a file its author still lets us fetch", () => {
		const result = ladder(
			[
				hashed(
					file("appleskin.jar", APPLESKIN, {
						downloadUrl: null,
					}),
				),
			],
			{
				mods: [
					mod(APPLESKIN),
				],
			},
		);

		expect(result.files.at(0)?.url).toBe("https://edge.forgecdn.net/files/9000/060/appleskin.jar");
		expect(result.blocked).toEqual([]);
	});

	test("skips an optional file its author blocked outside curseforge", () => {
		const entry = hashed(
			file("optional.jar", SEARCHABLES, {
				downloadUrl: null,
			}),
		);

		const result = ladder(
			[
				entry,
			],
			{
				mods: [
					mod(SEARCHABLES, {
						allowModDistribution: false,
					}),
				],
				wanted: [
					{
						fileId: entry.id,
						projectId: SEARCHABLES,
						required: false,
					},
				],
			},
		);

		expect(result.files).toEqual([]);
		expect(result.blocked).toEqual([]);
		expect(result.skipped).toBe(1);
	});

	test("lists a required file its author blocked instead of guessing a url", () => {
		const entry = hashed(
			file("bmcpalegardenpatcher-0.3.0.jar", SEARCHABLES, {
				downloadUrl: null,
			}),
		);

		const result = ladder(
			[
				entry,
			],
			{
				mods: [
					mod(SEARCHABLES, {
						allowModDistribution: false,
						name: "BMC Datafixer",
						slug: "bmc-patcher",
					}),
				],
				wanted: [
					{
						fileId: entry.id,
						projectId: SEARCHABLES,
						required: true,
					},
				],
			},
		);

		expect(result.files).toEqual([]);
		expect(result.skipped).toBe(0);
		expect(result.blocked).toEqual([
			{
				fileId: entry.id,
				fileName: "bmcpalegardenpatcher-0.3.0.jar",
				modId: SEARCHABLES,
				name: "BMC Datafixer",
				pageUrl: "https://www.curseforge.com/minecraft/mc-mods/bmc-patcher",
				sha1: SHA1,
				sizeBytes: 1024,
				slug: "bmc-patcher",
			},
		]);
	});

	test("keeps the page url curseforge published for a blocked mod", () => {
		const entry = hashed(
			file("blocked.jar", SEARCHABLES, {
				downloadUrl: null,
			}),
		);

		const result = ladder(
			[
				entry,
			],
			{
				mods: [
					mod(SEARCHABLES, {
						allowModDistribution: false,
						links: {
							websiteUrl: "https://www.curseforge.com/minecraft/mc-mods/published",
						},
					}),
				],
			},
		);

		expect(result.blocked.at(0)?.pageUrl).toBe("https://www.curseforge.com/minecraft/mc-mods/published");
	});

	test("leaves out a blocked file we could never verify", () => {
		const result = ladder(
			[
				file("nohash.jar", NETHER_PORTAL_FIX, {
					downloadUrl: null,
				}),
			],
			{
				mods: [
					mod(NETHER_PORTAL_FIX, {
						allowModDistribution: false,
					}),
				],
			},
		);

		expect(result.files).toEqual([]);
		expect(result.blocked).toEqual([]);
		expect(result.skipped).toBe(1);
		expect(result.unverifiable).toEqual([
			"nohash.jar",
		]);
	});
});
