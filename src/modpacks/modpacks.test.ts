import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeNetError, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { CatalogProviderId, encodeProviderRef } from "../providers";
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
	test("reports the modpack as selected, not yet installed", async () => {
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

	test("previewing the same modpack reports nothing", async () => {
		const { context, reported } = catalogContext();

		await modpacks.preview?.(context, encodeProviderRef(CatalogProviderId.Modrinth, "atm9"));

		expect(reported).toEqual([]);
	});

	test("updating an installed modpack reports the versions it moves between", async () => {
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

	test("a modpack the source no longer has is named as not found", async () => {
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
			"We could not find this modpack at its source. Search for it again or pick another modpack.",
		);
		expect((error as BridgeUserError).cause).toBe(original);
	});

	test("a source failing on its side is not read as not found", async () => {
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

		expect((error as BridgeUserError).text.en).toBe("The source of the modpack is down right now. Try again in a bit.");
	});
});
