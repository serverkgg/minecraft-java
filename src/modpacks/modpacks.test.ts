import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeNetError, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { CatalogProviderId, encodeProviderRef } from "../providers";
import { PACK_INDEX, PackFormat, ServerVariant } from "../shared";
import { memoryContext } from "../testing";
import { MODPACK_SIDECAR } from "./modpackSidecar";
import { MODPACK_UPDATE_ACTION, modpackStatus } from "./modpackStatus";
import { modpacks } from "./modpacks";

const VERSION = {
	id: "Xy12",
	version_number: "0.3.2",
	version_type: "release",
	loaders: [
		"neoforge",
	],
	game_versions: [
		"1.21.1",
	],
	date_published: "2026-09-01T00:00:00Z",
	files: [
		{
			primary: true,
			filename: "atm9-0.3.2.mrpack",
			url: "https://cdn.modrinth.com/data/atm9/versions/Xy12/atm9-0.3.2.mrpack",
			size: 1024,
			hashes: {},
		},
	],
};

const PROJECT = {
	id: "atm9",
	title: "All the Mods 9",
	slug: "all-the-mods-9",
	icon_url: null,
	description: "kitchen sink",
	downloads: 10,
};

const INSTALLED = JSON.stringify({
	provider: CatalogProviderId.Modrinth,
	project: "atm9",
	versionId: "Old1",
	version: "0.3.1",
	title: "All the Mods 9",
	mcVersion: "1.21.1",
	variant: "neoforge",
	pending: [],
});

const catalogContext = (sidecar: string | null = null) => {
	const reported: Bridge.Activity[] = [];
	const context = {
		secret: () => null,
		variable: () => null,
		files: {
			exists: async (path: string) => sidecar !== null && path === MODPACK_SIDECAR,
			read: async () => sidecar ?? "",
		},
		net: {
			json: async (url: string) => {
				if (url.endsWith("/version")) {
					return [
						VERSION,
					];
				}

				if (url.endsWith("/members")) {
					return [];
				}

				return PROJECT;
			},
		},
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		reported,
	};
};

describe("choosing a modpack from the catalog", () => {
	it("reads the server type from the modpack itself when its release is tagged with two", async () => {
		const removed: string[] = [];
		const downloaded: string[] = [];
		const context = {
			secret: () => null,
			variable: () => null,
			files: {
				remove: async (path: string) => {
					removed.push(path);
				},
				download: async (_path: string, url: string) => {
					downloaded.push(url);
				},
				extract: async () => {},
				read: async () => {
					return JSON.stringify({
						formatVersion: 1,
						game: "minecraft",
						name: "All the Mods 9",
						dependencies: {
							minecraft: "1.21.1",
							neoforge: "21.1.255",
						},
						files: [],
					});
				},
			},
			net: {
				json: async (url: string) => {
					if (url.endsWith("/version")) {
						return [
							{
								...VERSION,
								loaders: [
									"forge",
									"neoforge",
								],
							},
						];
					}

					return url.endsWith("/members") ? [] : PROJECT;
				},
			},
		} as unknown as Bridge.Context;

		const preview = await modpacks.preview?.(context, encodeProviderRef(CatalogProviderId.Modrinth, "atm9"));

		expect(preview?.variables).toMatchObject({
			SERVER_TYPE: "neoforge",
			MC_VERSION: "1.21.1",
		});
		expect(downloaded).toEqual([
			"https://cdn.modrinth.com/data/atm9/versions/Xy12/atm9-0.3.2.mrpack",
		]);
		expect(removed).toEqual([
			".serverk-staging/pack-identity",
			".serverk-staging/pack-identity",
		]);
	});

	it("reports the modpack as selected, not yet installed", async () => {
		const { context, reported } = catalogContext();

		await modpacks.install(context, encodeProviderRef(CatalogProviderId.Modrinth, "atm9"));

		expect(reported).toEqual([
			{
				name: BridgeEventName.ModpackSelected,
				text: {
					ar: "تم اختيار مودباك All the Mods 9 (0.3.2) للتثبيت",
					en: "Selected modpack All the Mods 9 (0.3.2) to install",
				},
				subject: "All the Mods 9",
				details: {
					title: "All the Mods 9",
					version: "0.3.2",
					provider: CatalogProviderId.Modrinth,
					server: "1.21.1 · NeoForge",
				},
			},
		]);
	});

	it("previewing the same modpack reports nothing", async () => {
		const { context, reported } = catalogContext();

		await modpacks.preview?.(context, encodeProviderRef(CatalogProviderId.Modrinth, "atm9"));

		expect(reported).toEqual([]);
	});

	it("updating an installed modpack reports the versions it moves between", async () => {
		const { context, reported } = catalogContext(INSTALLED);

		const answer = await modpackStatus.actions?.[MODPACK_UPDATE_ACTION]?.(context, {});

		expect(answer).toMatchObject({
			variables: {
				MODPACK: expect.stringContaining("Xy12"),
			},
		});
		expect(reported).toEqual([
			{
				name: BridgeEventName.ModpackSelected,
				text: {
					ar: "تم اختيار تحديث مودباك All the Mods 9 من 0.3.1 إلى 0.3.2",
					en: "Selected the update of modpack All the Mods 9 from 0.3.1 to 0.3.2",
				},
				subject: "All the Mods 9",
				details: {
					title: "All the Mods 9",
					provider: CatalogProviderId.Modrinth,
					from: "0.3.1",
					to: "0.3.2",
				},
			},
		]);
	});

	it("a modpack the source no longer has is named as not found", async () => {
		const original = new BridgeNetError(404, "api.modrinth.com answered 404");
		const context = {
			secret: () => null,
			variable: () => null,
			net: {
				json: async () => {
					throw original;
				},
			},
		} as unknown as Bridge.Context;

		const error = await modpacks.install(context, encodeProviderRef(CatalogProviderId.Modrinth, "gone")).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"We couldn't find this modpack at its source. Search for it again or pick another modpack.",
		);
		expect((error as BridgeUserError).cause).toBe(original);
	});

	it("a source failing on its side is not read as not found", async () => {
		const context = {
			secret: () => null,
			variable: () => null,
			net: {
				json: async () => {
					throw new BridgeNetError(502, "api.modrinth.com answered 502");
				},
			},
		} as unknown as Bridge.Context;

		const error = await modpacks.install(context, encodeProviderRef(CatalogProviderId.Modrinth, "atm9")).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect((error as BridgeUserError).text.en).toBe(
			"The source of the modpack is down right now. Try again in a moment.",
		);
	});
});

const UPLOADED_SHA1 = "62cdb7020ff920e5aa642c3d4066950dd1f01f4d";

const UPLOADED_PATH = ".serverk-packs/cozy-pack-62cdb702.mrpack";

const UPLOADED_PACK = {
	sha1: UPLOADED_SHA1,
	format: PackFormat.Modrinth,
	path: UPLOADED_PATH,
	name: "Cozy Pack",
	version: "1.4.0",
	mcVersion: "1.21.1",
	variant: ServerVariant.Fabric,
	loaderVersion: "0.16.5",
	fileCount: 1,
	sizeBytes: 2048,
	uploadedAt: "2026-10-22T09:00:00.000Z",
};

const uploadedContext = (sidecar: boolean) => {
	return memoryContext({
		variables: {
			SERVER_TYPE: "fabric",
			MC_VERSION: "1.21.1",
		},
		files: {
			[PACK_INDEX]: JSON.stringify([
				UPLOADED_PACK,
			]),
			[UPLOADED_PATH]: "",
			...(sidecar
				? {
						[MODPACK_SIDECAR]: JSON.stringify({
							provider: CatalogProviderId.Upload,
							project: UPLOADED_SHA1,
							versionId: UPLOADED_SHA1,
							version: "1.4.0",
							title: "Cozy Pack",
							mcVersion: "1.21.1",
							variant: "fabric",
							loaderVersion: "0.16.5",
							pending: [],
						}),
					}
				: {}),
		},
	}).context;
};

describe("installing a modpack the owner uploaded", () => {
	it("points the server at the upload by its checksum, on the type and version it declared", async () => {
		const entry = await modpacks.install(
			uploadedContext(false),
			encodeProviderRef(CatalogProviderId.Upload, UPLOADED_SHA1),
		);

		expect(entry.variables).toEqual({
			MODPACK: `upload:${UPLOADED_SHA1}:${UPLOADED_SHA1}`,
			SERVER_TYPE: "fabric",
			MC_VERSION: "1.21.1",
			LOADER_VERSION: "",
		});
		expect(entry.pageUrl).toBeNull();
	});

	it("lists the uploads as their own source in the catalog", async () => {
		const page = await modpacks.search(uploadedContext(false), {
			query: "",
			page: 0,
			provider: CatalogProviderId.Upload,
			category: null,
			sort: null,
		});

		expect(page.hits.map((hit) => hit.id)).toEqual([
			encodeProviderRef(CatalogProviderId.Upload, UPLOADED_SHA1),
		]);
		expect(page.providers.map((provider) => provider.id)).toContain(CatalogProviderId.Upload);
	});

	it("shows the installed upload as the owner's own, with no page, author, downloads or update check", async () => {
		const detail = await modpackStatus.read(uploadedContext(true));

		expect(detail?.badges.map((badge) => badge.label.en)).toEqual([
			"Uploaded by you",
		]);
		expect(detail?.links).toEqual([]);
		expect(detail?.stats.map((stat) => stat.key)).not.toContain("downloads");
		expect(detail?.stats.map((stat) => stat.key)).not.toContain("author");
		expect(detail?.actions).toEqual([]);
		expect(detail?.unavailable?.[MODPACK_UPDATE_ACTION]?.en).toContain("Upload its new release");
	});

	it("refuses to look for an update of an upload", async () => {
		const error = await modpackStatus.actions?.[MODPACK_UPDATE_ACTION]?.(uploadedContext(true), {}).then(
			() => null,
			(thrown: unknown) => thrown,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toContain("we don't check it for updates");
	});
});
