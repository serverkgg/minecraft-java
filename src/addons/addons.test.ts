import { describe, expect, it } from "bun:test";
import {
	type Bridge,
	BridgeFailureCode,
	BridgeFailureError,
	BridgeNetError,
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
