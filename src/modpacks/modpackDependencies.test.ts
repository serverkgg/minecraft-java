import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import {
	AddonKind,
	type AddonTarget,
	MODRINTH,
	MODRINTH_EMBEDDED,
	MODRINTH_REQUIRED,
	type ModrinthDependency,
	type ModrinthVersion,
} from "../providers";
import { fileNameOf, ServerVariant } from "../shared";
import { type MemoryArchive, memoryContext } from "../testing";
import { missingDependencies, providedProjects, resolveMissingLibraries } from "./modpackDependencies";
import { LIBRARIES_STAGING } from "./modpackDownload";
import { MODS_DIRECTORY, type ModpackFile, modPath, parseModpackIndex } from "./modpackIndex";

const CLIMATE_RIVERS = "DzZWws4q";

const BIOMES_WEVE_GONE = "biomesweve";

const NETHER_PORTAL_FIX = "nPZr02ET";

const FABRIC_API = "P7dR8mSH";

const TRINKETS_COMPAT = "trinketscompat";

const XP_STORAGE_TRINKETS = "xpstoragetrinkets";

const MENU_MOD = "menumod";

const TERRABLENDER = "kkmrDlKT";

const TERRABLENDER_PIN = "J1S3aA8i";

const BALM = "MBAkmtvl";

const TRINKETS = "5aaWibi9";

const MOD_MENU = "modmenu";

const TERRABLENDER_JAR = "TerraBlender-fabric-1.20.1.jar";

const BALM_JAR = "balm-fabric-1.20.1.jar";

const UPLOADED_JAR = "TerraBlender-fabric-1.20.1-uploaded.jar";

const UPLOADED_SIZE = 7331;

const SHA512 = "a".repeat(128);

const TARGET: AddonTarget = {
	kind: AddonKind.Mod,
	variant: ServerVariant.Fabric,
	gameVersion: "1.20.1",
	directory: MODS_DIRECTORY,
};

const requires = (project: string | null, version: string | null = null): ModrinthDependency => ({
	project_id: project,
	version_id: version,
	dependency_type: MODRINTH_REQUIRED,
});

const embeds = (project: string): ModrinthDependency => ({
	project_id: project,
	version_id: null,
	dependency_type: MODRINTH_EMBEDDED,
});

const cdnUrl = (project: string, version: string, filename: string) => {
	return `https://cdn.modrinth.com/data/${project}/versions/${version}/${filename}`;
};

const versionOf = (
	id: string,
	project: string,
	dependencies: ModrinthDependency[],
	filename = `${project}.jar`,
): ModrinthVersion => ({
	id,
	project_id: project,
	version_number: "1.0.0",
	version_type: "release",
	date_published: "2026-10-01T00:00:00Z",
	game_versions: [
		"1.20.1",
	],
	loaders: [
		"fabric",
	],
	files: [
		{
			url: cdnUrl(project, id, filename),
			filename,
			primary: true,
			size: 2048,
			hashes: {
				sha512: SHA512,
			},
		},
	],
	dependencies,
});

const packFile = (project: string | null, url: string): ModpackFile => ({
	path: modPath(fileNameOf(url)),
	url,
	digest: `sha512:${SHA512}`,
	sizeBytes: 2048,
	projectId: project,
});

const keptMod = (project: string, version: string) => {
	return packFile(project, cdnUrl(project, version, `${project}.jar`));
};

const BMC2_KEPT = [
	keptMod(CLIMATE_RIVERS, "climate1"),
	keptMod(BIOMES_WEVE_GONE, "biomes01"),
	keptMod(NETHER_PORTAL_FIX, "portal01"),
	keptMod(FABRIC_API, "fabric01"),
	keptMod(TRINKETS_COMPAT, "compat01"),
	keptMod(XP_STORAGE_TRINKETS, "storage1"),
	keptMod(MENU_MOD, "menu0001"),
	packFile(null, "https://github.com/someone/mod/releases/download/v1/github-mod.jar"),
];

const BMC2_VERSIONS = [
	versionOf("climate1", CLIMATE_RIVERS, [
		requires(TERRABLENDER, TERRABLENDER_PIN),
		requires(FABRIC_API),
	]),
	versionOf("biomes01", BIOMES_WEVE_GONE, [
		requires(TERRABLENDER),
	]),
	versionOf("portal01", NETHER_PORTAL_FIX, [
		requires(BALM),
		requires(null, "orphaned"),
	]),
	versionOf("fabric01", FABRIC_API, []),
	versionOf("compat01", TRINKETS_COMPAT, [
		embeds(TRINKETS),
	]),
	versionOf("storage1", XP_STORAGE_TRINKETS, [
		requires(TRINKETS),
	]),
	versionOf("menu0001", MENU_MOD, [
		requires(MOD_MENU),
	]),
];

const CLIENT_ONLY = new Set([
	MOD_MENU,
]);

const missingFrom = (versions: ModrinthVersion[]) => {
	return missingDependencies(versions, providedProjects(BMC2_KEPT, versions), CLIENT_ONLY);
};

describe("the libraries a modpack's mods require and the pack leaves out", () => {
	it("names the two libraries better mc leaves to its download window", () => {
		expect(missingFrom(BMC2_VERSIONS)).toEqual([
			{
				project: BALM,
				version: null,
			},
			{
				project: TERRABLENDER,
				version: TERRABLENDER_PIN,
			},
		]);
	});

	it("counts a library a kept jar embeds as shipped", () => {
		expect(providedProjects(BMC2_KEPT, BMC2_VERSIONS).has(TRINKETS)).toBe(true);
	});

	it("drops the pin when two mods pin one library to different releases", () => {
		expect(
			missingFrom([
				versionOf("climate1", CLIMATE_RIVERS, [
					requires(TERRABLENDER, TERRABLENDER_PIN),
				]),
				versionOf("biomes01", BIOMES_WEVE_GONE, [
					requires(TERRABLENDER, "Other123"),
				]),
			]),
		).toEqual([
			{
				project: TERRABLENDER,
				version: null,
			},
		]);
	});

	it("asks for nothing without the mods' versions", () => {
		expect(missingFrom([])).toEqual([]);
	});

	it("never asks for a library the pack itself marks unsupported on a server", () => {
		const indexEntry = (project: string, version: string, server: string) => ({
			path: `mods/${project}.jar`,
			downloads: [
				cdnUrl(project, version, `${project}.jar`),
			],
			env: {
				client: "required",
				server,
			},
			hashes: {
				sha512: SHA512,
			},
			fileSize: 2048,
		});
		const index = parseModpackIndex(
			JSON.stringify({
				formatVersion: 1,
				game: "minecraft",
				name: "Better MC",
				dependencies: {
					minecraft: "1.20.1",
					"fabric-loader": "0.16.9",
				},
				files: [
					indexEntry(MENU_MOD, "menu0001", "required"),
					indexEntry(MOD_MENU, "modmenu1", "unsupported"),
				],
			}),
		);
		const versions = [
			versionOf("menu0001", MENU_MOD, [
				requires(MOD_MENU),
			]),
		];

		expect(index.unsupportedProjects).toEqual([
			MOD_MENU,
		]);
		expect(
			missingDependencies(versions, providedProjects(index.files, versions), new Set(index.unsupportedProjects)),
		).toEqual([]);
	});
});

interface Logged {
	message: string;
	details: Record<string, unknown>;
}

const TERRABLENDER_URL = cdnUrl(TERRABLENDER, TERRABLENDER_PIN, TERRABLENDER_JAR);

const BALM_URL = cdnUrl(BALM, "balm0001", BALM_JAR);

const projectOf = (id: string, title: string) => ({
	id,
	title,
	slug: title.toLowerCase(),
	icon_url: null,
	server_side: "required",
});

const SERVER_VERSIONS = [
	versionOf("climate1", CLIMATE_RIVERS, [
		requires(TERRABLENDER, TERRABLENDER_PIN),
		requires(FABRIC_API),
	]),
	versionOf("portal01", NETHER_PORTAL_FIX, [
		requires(BALM),
	]),
];

const MODRINTH_ANSWERS: Record<string, unknown> = {
	[`${MODRINTH}/project/${TERRABLENDER}`]: projectOf(TERRABLENDER, "TerraBlender"),
	[`${MODRINTH}/version/${TERRABLENDER_PIN}`]: versionOf(TERRABLENDER_PIN, TERRABLENDER, [], TERRABLENDER_JAR),
	[`${MODRINTH}/project/${BALM}`]: projectOf(BALM, "Balm"),
	[`${MODRINTH}/project/${BALM}/version`]: [
		versionOf(
			"balm0001",
			BALM,
			[
				requires(FABRIC_API),
			],
			BALM_JAR,
		),
	],
	[`${MODRINTH}/project/${FABRIC_API}`]: projectOf(FABRIC_API, "Fabric API"),
	[`${MODRINTH}/project/${FABRIC_API}/version`]: [
		versionOf("fabric01", FABRIC_API, []),
	],
};

const modrinthAnswer = (overrides: Record<string, unknown>) => {
	const answers = {
		...MODRINTH_ANSWERS,
		...overrides,
	};

	return (url: string) => {
		const parsed = new URL(url);
		const endpoint = `${parsed.origin}${parsed.pathname}`;

		if (endpoint === `${MODRINTH}/versions`) {
			const ids = JSON.parse(parsed.searchParams.get("ids") ?? "[]") as string[];

			return SERVER_VERSIONS.filter((version) => ids.includes(version.id));
		}

		if (!(endpoint in answers)) {
			throw new Error(`no stub for ${url}`);
		}

		return answers[endpoint];
	};
};

const declaring = (id: string): MemoryArchive => ({
	"fabric.mod.json": JSON.stringify({
		id,
	}),
});

interface ServerOptions {
	answers?: Record<string, unknown>;
	modrinth?: boolean;
	uploaded?: boolean;
}

const serverWith = (options: ServerOptions = {}) => {
	const memory = memoryContext({
		files: options.uploaded
			? {
					[modPath(UPLOADED_JAR)]: "",
				}
			: {},
		archives: options.uploaded
			? {
					[modPath(UPLOADED_JAR)]: declaring("TerraBlender"),
				}
			: {},
		sizes: {
			[modPath(UPLOADED_JAR)]: UPLOADED_SIZE,
		},
		served: {
			[TERRABLENDER_URL]: declaring("terrablender"),
			[BALM_URL]: declaring("balm"),
		},
		...(options.modrinth === false
			? {}
			: {
					json: modrinthAnswer(options.answers ?? {}),
				}),
	});
	const logged: Logged[] = [];
	const warnings: Logged[] = [];
	const context = {
		...memory.context,
		log: Object.assign(
			(message: string, details: Record<string, unknown> = {}) => {
				logged.push({
					message,
					details,
				});
			},
			{
				warn: (message: string, details: Record<string, unknown> = {}) => {
					warnings.push({
						message,
						details,
					});
				},
				error: () => {},
			},
		),
	} as unknown as Bridge.Context;

	return {
		...memory,
		context,
		logged,
		warnings,
	};
};

const SERVER_KEPT = [
	keptMod(CLIMATE_RIVERS, "climate1"),
	keptMod(NETHER_PORTAL_FIX, "portal01"),
	keptMod(FABRIC_API, "fabric01"),
];

const ADDING = "adding the libraries the modpack's mods need but the pack left out";

describe("installing the libraries a modpack left out", () => {
	it("fetches both missing libraries into mods and says how many it added", async () => {
		const { archives, context, downloads, logged } = serverWith();
		const libraries = await resolveMissingLibraries(context, SERVER_KEPT, new Set(), TARGET);

		expect(libraries.map((library) => library.path)).toEqual([
			modPath(BALM_JAR),
			modPath(TERRABLENDER_JAR),
		]);
		expect(archives.has(modPath(BALM_JAR))).toBe(true);
		expect(archives.has(modPath(TERRABLENDER_JAR))).toBe(true);
		expect(
			[
				...downloads,
			].sort(),
		).toEqual(
			[
				BALM_URL,
				TERRABLENDER_URL,
			].sort(),
		);
		expect(logged.find((line) => line.message === ADDING)?.details.files).toBe(2);
	});

	it("leaves out a library a jar already in mods declares, and names that jar", async () => {
		const { archives, context, logged, warnings } = serverWith({
			uploaded: true,
		});
		const libraries = await resolveMissingLibraries(
			context,
			[
				keptMod(CLIMATE_RIVERS, "climate1"),
				keptMod(FABRIC_API, "fabric01"),
			],
			new Set(),
			TARGET,
		);

		expect(libraries).toEqual([]);
		expect(archives.has(modPath(TERRABLENDER_JAR))).toBe(false);
		expect(archives.has(`${LIBRARIES_STAGING}/${TERRABLENDER_JAR}`)).toBe(false);
		expect(warnings.find((line) => line.details.jar !== undefined)?.details).toEqual({
			file: TERRABLENDER_JAR,
			jar: UPLOADED_JAR,
		});
		expect(logged.some((line) => line.message === ADDING)).toBe(false);
	});

	it("skips a library modrinth has no release of and still adds the other", async () => {
		const { archives, context, logged, warnings } = serverWith({
			answers: {
				[`${MODRINTH}/project/${BALM}/version`]: [],
			},
		});
		const libraries = await resolveMissingLibraries(context, SERVER_KEPT, new Set(), TARGET);

		expect(libraries.map((library) => library.path)).toEqual([
			modPath(TERRABLENDER_JAR),
		]);
		expect(archives.has(modPath(BALM_JAR))).toBe(false);
		expect(warnings.find((line) => line.details.project === BALM)).toBeDefined();
		expect(logged.find((line) => line.message === ADDING)?.details.files).toBe(1);
	});

	it("leaves out a pinned release built for another loader and still adds the other", async () => {
		const { archives, context, warnings } = serverWith({
			answers: {
				[`${MODRINTH}/version/${TERRABLENDER_PIN}`]: {
					...versionOf(TERRABLENDER_PIN, TERRABLENDER, [], TERRABLENDER_JAR),
					loaders: [
						"forge",
					],
				},
			},
		});
		const libraries = await resolveMissingLibraries(context, SERVER_KEPT, new Set(), TARGET);

		expect(libraries.map((library) => library.path)).toEqual([
			modPath(BALM_JAR),
		]);
		expect(archives.has(modPath(TERRABLENDER_JAR))).toBe(false);
		expect(warnings.find((line) => line.details.project === TERRABLENDER)?.message).toBe(
			"left out a library the modpack's mods need, its release is for another loader or version",
		);
	});

	it("leaves out a library's own dependency the pack marks unsupported on a server", async () => {
		const subDependency = "clientlib";
		const { archives, context, downloads, warnings } = serverWith({
			answers: {
				[`${MODRINTH}/project/${BALM}/version`]: [
					versionOf(
						"balm0001",
						BALM,
						[
							requires(FABRIC_API),
							requires(subDependency),
						],
						BALM_JAR,
					),
				],
				[`${MODRINTH}/project/${subDependency}`]: projectOf(subDependency, "Client Lib"),
				[`${MODRINTH}/project/${subDependency}/version`]: [
					versionOf("client01", subDependency, []),
				],
			},
		});
		const libraries = await resolveMissingLibraries(
			context,
			SERVER_KEPT,
			new Set([
				subDependency,
			]),
			TARGET,
		);

		expect(libraries.map((library) => library.path)).toEqual([
			modPath(BALM_JAR),
			modPath(TERRABLENDER_JAR),
		]);
		expect(archives.has(modPath(`${subDependency}.jar`))).toBe(false);
		expect(downloads).not.toContain(cdnUrl(subDependency, "client01", `${subDependency}.jar`));
		expect(warnings.find((line) => line.details.project === subDependency)?.message).toBe(
			"left out a library the modpack's mods need, it only runs on a player's pc",
		);
	});

	it("installs the pack as published when modrinth does not answer", async () => {
		const { context, downloads, warnings } = serverWith({
			modrinth: false,
		});
		const libraries = await resolveMissingLibraries(context, SERVER_KEPT, new Set(), TARGET);

		expect(libraries).toEqual([]);
		expect(downloads).toEqual([]);
		expect(warnings.map((line) => line.message)).toEqual([
			"could not read which libraries the modpack's mods need, installing the pack as published",
		]);
	});
});
