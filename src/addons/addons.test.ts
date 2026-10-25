import { describe, expect, it } from "bun:test";
import {
	type Bridge,
	BridgeFailureCode,
	BridgeFailureError,
	BridgeNetError,
	type BridgeRequestOptions,
	BridgeSecretError,
	BridgeUserError,
} from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { CatalogProviderId, encodeProviderRef } from "../providers";
import { addons } from "./addons";

const SODIUM = encodeProviderRef(CatalogProviderId.Modrinth, "AANobbMI");

const versionOf = (project: string, number: string, dependencies: string[]) => {
	return {
		id: `${project}-v`,
		project_id: project,
		version_number: number,
		version_type: "release",
		game_versions: [
			"1.21.1",
		],
		loaders: [
			"fabric",
		],
		date_published: "2026-09-01T00:00:00Z",
		files: [
			{
				primary: true,
				filename: `${project}-${number}.jar`,
				url: `https://cdn.modrinth.com/data/${project}/versions/${number}/${project}-${number}.jar`,
				size: 2048,
				hashes: {},
			},
		],
		dependencies: dependencies.map((dependency) => {
			return {
				project_id: dependency,
				version_id: null,
				dependency_type: "required",
			};
		}),
	};
};

const MODRINTH_ANSWERS: Record<string, unknown> = {
	lithium: {
		id: "lithium",
		title: "Lithium",
		slug: "lithium",
		icon_url: null,
		server_side: "optional",
	},
	"lithium/version": [
		versionOf("lithium", "0.14.3", [
			"fabric-api",
		]),
	],
	"fabric-api": {
		id: "fabric-api",
		title: "Fabric API",
		slug: "fabric-api",
		icon_url: null,
		server_side: "required",
	},
	"fabric-api/version": [
		versionOf("fabric-api", "0.110.0", []),
	],
};

const modrinthAnswer = async (url: string) => {
	const path = new URL(url).pathname.replace(/^\/v2\/project\//, "");

	if (!(path in MODRINTH_ANSWERS)) {
		throw new Error(`no stub for ${url}`);
	}

	return MODRINTH_ANSWERS[path];
};

const INSTALLED_TEXT = {
	ar: "تم تثبيت مود Lithium (0.14.3) مع متطلب واحد",
	en: "Installed mod Lithium (0.14.3) with 1 dependency",
};

const serverWith = () => {
	const files = new Map<string, string>([
		[
			".serverk-install.json",
			JSON.stringify({
				variant: "fabric",
				version: "1.21.1",
				build: "0.16.0",
				java: 21,
				launch: {
					kind: "jar",
					target: "server.jar",
				},
			}),
		],
		[
			"mods/.serverk-catalog.json",
			JSON.stringify({
				"sodium-0.5.8.jar": {
					provider: CatalogProviderId.Modrinth,
					project: "AANobbMI",
					version: "0.5.8",
					title: "Sodium",
					gameVersion: "1.21.1",
					icon: null,
					pageUrl: null,
				},
			}),
		],
		[
			"mods/sodium-0.5.8.jar",
			"",
		],
		[
			"mods/custom.jar",
			"",
		],
	]);
	const reported: Bridge.Activity[] = [];
	const context = {
		variable: (key: string) => (key === "SERVER_TYPE" ? "fabric" : null),
		files: {
			exists: async (path: string) => files.has(path),
			read: async (path: string) => files.get(path) ?? "",
			write: async (path: string, text: string) => {
				files.set(path, text);
			},
			remove: async (path: string) => {
				files.delete(path);
			},
			move: async (from: string, to: string) => {
				files.set(to, files.get(from) ?? "");
				files.delete(from);
			},
			ensure: async () => {},
			download: async (path: string) => {
				files.set(path, "");
			},
		},
		secret: () => null,
		net: {
			json: modrinthAnswer,
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		files,
		reported,
	};
};

describe("what the addon catalog reports", () => {
	it("disabling and enabling a tracked mod names it", async () => {
		const { context, files, reported } = serverWith();

		await addons.toggle?.(context, SODIUM, false);

		expect(files.has("mods/sodium-0.5.8.jar.disabled")).toBe(true);

		await addons.toggle?.(context, SODIUM, true);

		expect(reported).toEqual([
			{
				name: BridgeEventName.ModDisabled,
				text: {
					ar: "تم إيقاف مود Sodium",
					en: "Disabled mod Sodium",
				},
				subject: "Sodium",
				details: {
					kind: "mod",
					title: "Sodium",
				},
			},
			{
				name: BridgeEventName.ModEnabled,
				text: {
					ar: "تم تفعيل مود Sodium",
					en: "Enabled mod Sodium",
				},
				subject: "Sodium",
				details: {
					kind: "mod",
					title: "Sodium",
				},
			},
		]);
	});

	it("removing a tracked mod reports its title, an untracked jar its file name", async () => {
		const { context, files, reported } = serverWith();

		await addons.remove?.(context, SODIUM);
		await addons.remove?.(context, "custom.jar");

		expect(files.has("mods/sodium-0.5.8.jar")).toBe(false);
		expect(files.has("mods/custom.jar")).toBe(false);
		expect(
			reported.map((entry) => [
				entry.name,
				entry.subject,
				entry.text.en,
			]),
		).toEqual([
			[
				BridgeEventName.ModRemoved,
				"Sodium",
				"Removed mod Sodium",
			],
			[
				BridgeEventName.ModRemoved,
				"custom.jar",
				"Removed mod custom.jar",
			],
		]);
	});

	it("installing a mod names it, its version and how many dependencies came with it", async () => {
		const { context, files, reported } = serverWith();

		await addons.install(context, encodeProviderRef(CatalogProviderId.Modrinth, "lithium"));

		expect(files.has("mods/lithium-0.14.3.jar")).toBe(true);
		expect(files.has("mods/fabric-api-0.110.0.jar")).toBe(true);
		expect(reported).toEqual([
			{
				name: BridgeEventName.ModInstalled,
				text: INSTALLED_TEXT,
				subject: "Lithium",
				details: {
					kind: "mod",
					title: "Lithium",
					version: "0.14.3",
					provider: CatalogProviderId.Modrinth,
					dependencies: 1,
				},
			},
		]);
	});

	it("enabling a mod that is already enabled reports nothing", async () => {
		const { context, reported } = serverWith();

		await addons.toggle?.(context, SODIUM, true);

		expect(reported).toEqual([]);
	});

	it("a mod the source no longer has is named as not found, and staff keep the answer", async () => {
		const { context } = serverWith();
		const original = new BridgeNetError(404, "api.modrinth.com answered 404");
		const failing = {
			...context,
			net: {
				json: async () => {
					throw original;
				},
			},
		} as unknown as Bridge.Context;

		const error = await addons.install(failing, encodeProviderRef(CatalogProviderId.Modrinth, "gone")).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"We couldn't find this mod or one of its dependencies at its source. Search for it again or pick another mod.",
		);
		expect((error as BridgeUserError).cause).toBe(original);
	});

	it("a source failing on its side says the source is down", async () => {
		const { context } = serverWith();
		const failing = {
			...context,
			net: {
				json: async () => {
					throw new BridgeNetError(500, "api.modrinth.com answered 500");
				},
			},
		} as unknown as Bridge.Context;

		const error = await addons.install(failing, encodeProviderRef(CatalogProviderId.Modrinth, "lithium")).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect((error as BridgeUserError).text.en).toBe("The source of the mod is down right now. Try again in a moment.");
	});

	it("curseforge without a key stays a secret error so the platform flags it", async () => {
		const { context } = serverWith();

		const error = await addons.install(context, encodeProviderRef(CatalogProviderId.CurseForge, "238222")).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeSecretError);
	});

	it("a hangar plugin that is gone is named as not found", async () => {
		const context = {
			variable: (key: string) => {
				return (
					{
						SERVER_TYPE: "paper",
						MC_VERSION: "1.21.4",
					}[key] ?? null
				);
			},
			secret: () => null,
			files: {
				exists: async () => false,
			},
			net: {
				json: async () => {
					throw new BridgeNetError(404, "hangar.papermc.io answered 404");
				},
			},
		} as unknown as Bridge.Context;

		const error = await addons.install(context, encodeProviderRef(CatalogProviderId.Hangar, "someone/Gone")).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect((error as BridgeUserError).text).toEqual({
			ar: "تعذّر العثور على الإضافة أو أحد متطلباتها لدى مصدرها. ابحث عنها مرة ثانية أو اختر إضافة أخرى.",
			en: "We couldn't find this plugin or one of its dependencies at its source. Search for it again or pick another plugin.",
		});
	});

	it("a hangar rate limit keeps its failure code", async () => {
		const context = {
			variable: (key: string) => {
				return (
					{
						SERVER_TYPE: "paper",
						MC_VERSION: "1.21.4",
					}[key] ?? null
				);
			},
			secret: () => null,
			files: {
				exists: async () => false,
			},
			net: {
				json: async () => {
					throw new BridgeNetError(429, "hangar.papermc.io answered 429");
				},
			},
		} as unknown as Bridge.Context;

		const error = await addons.install(context, encodeProviderRef(CatalogProviderId.Hangar, "someone/Busy")).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeFailureError);
		expect((error as BridgeFailureError).code).toBe(BridgeFailureCode.CatalogRateLimited);
	});
});

const NEOFORGE_STAMP = JSON.stringify({
	variant: "neoforge",
	version: "26.3",
	build: "26.3.12",
	java: 25,
	launch: {
		kind: "jar",
		target: "server.jar",
	},
});

const JEI = "238222";

const APPLESKIN = "248787";

const FERRITECORE = "uXXizFIs";

const MODERNFIX = "nmDcB62a";

const JADE = "nvQzSEkH";

const CLUMPS = "Wnxd13zP";

const LITHOSTITCHED = "XaDC71GB";

const UPDATE_SIDECAR = {
	"jei-26.3-neoforge-31.16.0.89.jar": {
		provider: CatalogProviderId.CurseForge,
		project: JEI,
		version: "jei-26.3-neoforge-31.16.0.89",
		versionId: "7100100",
		title: "Just Enough Items (JEI)",
		gameVersion: "26.3",
		icon: null,
		pageUrl: null,
	},
	"appleskin-neoforge-26.3-3.0.6.jar": {
		provider: CatalogProviderId.CurseForge,
		project: APPLESKIN,
		version: "appleskin-neoforge-26.3-3.0.6",
		versionId: "7000000",
		title: "AppleSkin",
		gameVersion: "26.3",
		icon: null,
		pageUrl: null,
	},
	"ferritecore-8.0.0-neoforge.jar": {
		provider: CatalogProviderId.Modrinth,
		project: FERRITECORE,
		version: "8.0.0",
		versionId: "fcOld",
		title: "FerriteCore",
		gameVersion: "26.3",
		gameVersions: [
			"26.3",
		],
		icon: null,
		pageUrl: null,
	},
	"modernfix-neoforge-5.24.0.jar": {
		provider: CatalogProviderId.Modrinth,
		project: MODERNFIX,
		version: "5.24.0",
		versionId: "mfOld",
		title: "ModernFix",
		gameVersion: "26.3",
		gameVersions: [
			"26.3",
		],
		icon: null,
		pageUrl: null,
	},
	"jade-26.3-neoforge-19.4.0.jar": {
		provider: CatalogProviderId.Modrinth,
		project: JADE,
		version: "19.4.0",
		versionId: "jadeNow",
		title: "Jade",
		gameVersion: "26.3",
		gameVersions: [
			"26.3",
		],
		icon: null,
		pageUrl: null,
	},
	"clumps-neoforge-26.3-22.0.0.jar": {
		provider: CatalogProviderId.Modrinth,
		project: CLUMPS,
		version: "22.0.0",
		title: "Clumps",
		gameVersion: "26.3",
		icon: null,
		pageUrl: null,
	},
	"lithostitched-neoforge-26.2-1.4.jar": {
		provider: CatalogProviderId.Modrinth,
		project: LITHOSTITCHED,
		version: "1.4",
		versionId: "lsOld",
		title: "Lithostitched",
		gameVersion: "26.2",
		gameVersions: [
			"26.2",
		],
		icon: null,
		pageUrl: null,
	},
};

const UPDATE_JARS = [
	"jei-26.3-neoforge-31.16.0.89.jar",
	"appleskin-neoforge-26.3-3.0.6.jar",
	"ferritecore-8.0.0-neoforge.jar",
	"modernfix-neoforge-5.24.0.jar.disabled",
	"jade-26.3-neoforge-19.4.0.jar",
	"clumps-neoforge-26.3-22.0.0.jar",
	"lithostitched-neoforge-26.2-1.4.jar",
	"custom.jar",
];

const DIGESTS: Record<string, string> = {
	"mods/ferritecore-8.0.0-neoforge.jar": "AAAA000000000000000000000000000000000001",
	"mods/modernfix-neoforge-5.24.0.jar.disabled": "bbbb000000000000000000000000000000000002",
	"mods/jade-26.3-neoforge-19.4.0.jar": "cccc000000000000000000000000000000000003",
	"mods/clumps-neoforge-26.3-22.0.0.jar": "dddd000000000000000000000000000000000004",
	"mods/lithostitched-neoforge-26.2-1.4.jar": "eeee000000000000000000000000000000000005",
};

const fileIndexOf = (
	fileId: number,
	filename: string,
	releaseType: number,
	modLoader: number,
	gameVersion = "26.3",
) => {
	return {
		gameVersion,
		fileId,
		filename,
		releaseType,
		gameVersionTypeId: 0,
		modLoader,
	};
};

const CURSEFORGE_MODS = {
	data: [
		{
			id: Number(JEI),
			name: "Just Enough Items (JEI)",
			latestFiles: [
				{
					id: 7_100_200,
					displayName: "jei-26.3-neoforge-31.16.0.90",
				},
			],
			latestFilesIndexes: [
				fileIndexOf(7_100_300, "jei-26.3-neoforge-31.17.0.1.jar", 2, 6),
				fileIndexOf(7_100_200, "jei-26.3-neoforge-31.16.0.90.jar", 1, 6),
				fileIndexOf(7_100_400, "jei-26.3-fabric-31.16.0.91.jar", 1, 4),
				fileIndexOf(7_100_500, "jei-26.4-neoforge-32.0.0.1.jar", 1, 6, "26.4"),
			],
		},
		{
			id: Number(APPLESKIN),
			name: "AppleSkin",
			latestFilesIndexes: [
				fileIndexOf(7_000_000, "appleskin-neoforge-26.3-3.0.6.jar", 1, 6),
			],
		},
	],
};

const modrinthLatestOf = (id: string, number: string, sha1: string) => {
	return {
		id,
		project_id: "",
		version_number: number,
		version_type: "release",
		date_published: "2026-10-20T00:00:00Z",
		game_versions: [
			"26.3",
		],
		loaders: [
			"neoforge",
		],
		files: [
			{
				primary: true,
				filename: `${id}.jar`,
				url: `https://cdn.modrinth.com/data/x/versions/${id}/${id}.jar`,
				size: 1024,
				hashes: {
					sha1,
				},
			},
		],
		dependencies: [],
	};
};

const MODRINTH_LATEST = {
	aaaa000000000000000000000000000000000001: modrinthLatestOf(
		"fcNew",
		"8.0.1",
		"aaaa0000000000000000000000000000000000ff",
	),
	bbbb000000000000000000000000000000000002: modrinthLatestOf(
		"mfNew",
		"5.25.0",
		"bbbb0000000000000000000000000000000000ff",
	),
	cccc000000000000000000000000000000000003: modrinthLatestOf(
		"jadeNow",
		"19.4.0",
		"cccc000000000000000000000000000000000003",
	),
	dddd000000000000000000000000000000000004: modrinthLatestOf(
		"clumpsNow",
		"22.0.0",
		"dddd000000000000000000000000000000000004",
	),
	eeee000000000000000000000000000000000005: modrinthLatestOf(
		"lsNew",
		"1.5",
		"eeee0000000000000000000000000000000000ff",
	),
};

interface NetCall {
	url: string;
	body: unknown;
	cacheSeconds: number | undefined;
}

interface UpdatingServer {
	curseforge?: () => unknown;
	modrinth?: () => unknown;
	key?: string | null;
}

const updatingServer = (overrides: UpdatingServer = {}) => {
	const files = new Map<string, string>([
		[
			".serverk-install.json",
			NEOFORGE_STAMP,
		],
		[
			"mods/.serverk-catalog.json",
			JSON.stringify(UPDATE_SIDECAR),
		],
		...UPDATE_JARS.map(
			(
				name,
			): [
				string,
				string,
			] => [
				`mods/${name}`,
				"",
			],
		),
	]);
	const calls: NetCall[] = [];
	const digested: string[] = [];
	const warnings: string[] = [];
	const key = overrides.key === undefined ? "test-key" : overrides.key;
	const context = {
		variable: (name: string) => (name === "SERVER_TYPE" ? "neoforge" : null),
		secret: (name: string) => (name === "CURSEFORGE_API_KEY" ? key : null),
		files: {
			exists: async (path: string) => files.has(path),
			read: async (path: string) => files.get(path) ?? "",
			list: async (glob: string) => {
				const suffix = glob.slice(glob.indexOf("*") + 1);

				return [
					...files.keys(),
				]
					.filter((path) => path.startsWith("mods/") && path.endsWith(suffix))
					.map((path) => {
						return {
							path,
							name: path.slice("mods/".length),
							directory: false,
							sizeBytes: 1024,
							modifiedAt: "2026-10-20T00:00:00Z",
						};
					});
			},
			digest: async (path: string) => {
				digested.push(path);

				return DIGESTS[path] ?? "ffff000000000000000000000000000000000000";
			},
		},
		net: {
			json: async (url: string, options: BridgeRequestOptions = {}) => {
				calls.push({
					url,
					body: options.body === undefined ? null : JSON.parse(options.body),
					cacheSeconds: options.cacheSeconds,
				});

				if (url.startsWith("https://api.curseforge.com/")) {
					return (overrides.curseforge ?? (() => CURSEFORGE_MODS))();
				}

				return (overrides.modrinth ?? (() => MODRINTH_LATEST))();
			},
		},
		log: Object.assign(() => {}, {
			warn: (message: string) => {
				warnings.push(message);
			},
			error: () => {},
		}),
	} as unknown as Bridge.Context;

	return {
		context,
		calls,
		digested,
		warnings,
	};
};

const updatesOf = (entries: Bridge.CatalogEntry[]) => {
	return Object.fromEntries(
		entries.map((entry) => [
			entry.title,
			entry.update ?? null,
		]),
	);
};

const NO_UPDATES = {
	"Just Enough Items (JEI)": null,
	AppleSkin: null,
	FerriteCore: null,
	ModernFix: null,
	Jade: null,
	Clumps: null,
	Lithostitched: null,
	"custom.jar": null,
};

describe("how the addon catalog finds updates", () => {
	it("offers the newer compatible release of each tracked mod and nothing for the rest", async () => {
		const { context } = updatingServer();

		const entries = await addons.installed(context);

		expect(updatesOf(entries)).toEqual({
			...NO_UPDATES,
			"Just Enough Items (JEI)": {
				version: "jei-26.3-neoforge-31.16.0.90",
				releaseId: "7100200",
			},
			FerriteCore: {
				version: "8.0.1",
				releaseId: "fcNew",
			},
			ModernFix: {
				version: "5.25.0",
				releaseId: "mfNew",
			},
			Lithostitched: {
				version: "1.5",
				releaseId: "lsNew",
			},
		});
	});

	it("picks the curseforge release for the server's game version and loader over a newer beta", async () => {
		const { context } = updatingServer();

		const entries = await addons.installed(context);

		expect(entries.find((entry) => entry.title === "Just Enough Items (JEI)")?.update?.releaseId).toBe("7100200");
	});

	it("checks a disabled jar by its parked file and keeps it disabled", async () => {
		const { context, digested } = updatingServer();

		const entries = await addons.installed(context);
		const modernfix = entries.find((entry) => entry.title === "ModernFix");

		expect(digested).toContain("mods/modernfix-neoforge-5.24.0.jar.disabled");
		expect(modernfix?.enabled).toBe(false);
		expect(modernfix?.update?.releaseId).toBe("mfNew");
	});

	it("keeps a mod built for another game version stale while offering the build for this one", async () => {
		const { context } = updatingServer();

		const entries = await addons.installed(context);
		const lithostitched = entries.find((entry) => entry.title === "Lithostitched");

		expect(lithostitched?.stale).toBe(true);
		expect(lithostitched?.update?.releaseId).toBe("lsNew");
	});

	it("asks each provider once for every tracked mod, for this loader and game version, inside ten minutes", async () => {
		const { context, calls, digested } = updatingServer();

		await addons.installed(context);

		expect(digested).toHaveLength(5);
		expect(calls).toEqual([
			{
				url: "https://api.curseforge.com/v1/mods",
				body: {
					modIds: [
						Number(JEI),
						Number(APPLESKIN),
					],
				},
				cacheSeconds: 600,
			},
			{
				url: "https://api.modrinth.com/v2/version_files/update",
				body: {
					algorithm: "sha1",
					game_versions: [
						"26.3",
					],
					hashes: Object.keys(MODRINTH_LATEST),
					loaders: [
						"neoforge",
					],
				},
				cacheSeconds: 600,
			},
		]);
	});

	it("leaves the mods of a failing provider without an update, logs once and keeps the other provider's", async () => {
		const CASES = [
			{
				name: "a rate limit",
				server: updatingServer({
					curseforge: () => {
						throw new BridgeNetError(429, "api.curseforge.com answered 429");
					},
				}),
			},
			{
				name: "a network failure",
				server: updatingServer({
					curseforge: () => {
						throw new BridgeNetError(null, "api.curseforge.com could not be reached");
					},
				}),
			},
			{
				name: "no api key",
				server: updatingServer({
					key: null,
				}),
			},
		];

		for (const item of CASES) {
			const entries = await addons.installed(item.server.context);
			const updates = updatesOf(entries);

			expect([
				item.name,
				updates["Just Enough Items (JEI)"],
				updates.FerriteCore?.releaseId,
				item.server.warnings,
			]).toEqual([
				item.name,
				null,
				"fcNew",
				[
					"could not check the installed addons for updates",
				],
			]);
		}
	});

	it("lists every mod without an update when modrinth fails", async () => {
		const { context, warnings } = updatingServer({
			modrinth: () => {
				throw new BridgeNetError(503, "api.modrinth.com answered 503");
			},
		});

		const entries = await addons.installed(context);

		expect(updatesOf(entries)).toEqual({
			...NO_UPDATES,
			"Just Enough Items (JEI)": {
				version: "jei-26.3-neoforge-31.16.0.90",
				releaseId: "7100200",
			},
		});
		expect(warnings).toHaveLength(1);
	});
});
