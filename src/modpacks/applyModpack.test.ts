import { describe, expect, it } from "bun:test";
import {
	type Bridge,
	BridgeDownloadError,
	BridgeFailureCode,
	BridgeFailureError,
	BridgeNetError,
	BridgeSecretError,
	BridgeUserError,
	describeDownloadFailure,
} from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { CatalogProviderId, type ModpackRelease } from "../providers";
import { ServerVariant, STAGING_ROOT } from "../shared";
import {
	downloadFailure,
	modpackInstalledText,
	modpackRemovedActivity,
	parentDirectoriesOf,
	placePreparedFiles,
	releaseIdentity,
	stageModpack,
} from "./applyModpack";
import type { ModpackFile } from "./modpackIndex";

const file = (path: string): ModpackFile => ({
	path,
	url: `https://cdn.modrinth.com/${path}`,
	digest: "sha1:da39a3ee5e6b4b0d3255bfef95601890afd80709",
	sizeBytes: 1,
	projectId: null,
});

const fixture = () => {
	const directories = new Set<string>();
	const moves: [
		string,
		string,
	][] = [];
	const context = {
		files: {
			ensure: async (...paths: string[]) => {
				for (const path of paths) {
					directories.add(path);
				}
			},
			move: async (from: string, to: string) => {
				const parent = to.split("/").slice(0, -1).join("/");

				if (parent.length > 0 && !directories.has(parent)) {
					throw new Error(`ENOENT: no such file or directory, rename '${from}' -> '${to}'`);
				}

				moves.push([
					from,
					to,
				]);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		directories,
		moves,
	};
};

describe("the folders a modpack's files land in", () => {
	it("lists every distinct parent folder once and skips files at the root", () => {
		expect(
			parentDirectoriesOf([
				"mods/a.jar",
				"mods/b.jar",
				"config/x/y.toml",
				"README.md",
			]),
		).toEqual([
			"mods",
			"config/x",
		]);
	});
});

describe("placing the staged modpack files", () => {
	it("creates the mods folder and every parent folder before moving, so a wiped server takes the pack", async () => {
		const { context, directories, moves } = fixture();

		await placePreparedFiles(context, [
			file("mods/modnametooltip_1.16.2-1.15.0.jar"),
			file("config/kubejs/client.toml"),
		]);

		expect([
			...directories,
		]).toEqual([
			"mods",
			"config/kubejs",
		]);
		expect(moves).toEqual([
			[
				`${STAGING_ROOT}/pack/content/mods/modnametooltip_1.16.2-1.15.0.jar`,
				"mods/modnametooltip_1.16.2-1.15.0.jar",
			],
			[
				`${STAGING_ROOT}/pack/content/config/kubejs/client.toml`,
				"config/kubejs/client.toml",
			],
		]);
	});

	it("still creates the mods folder when the pack ships nothing for it, so a rescued jar has a home", async () => {
		const { context, directories } = fixture();

		await placePreparedFiles(context, []);

		expect(directories.has("mods")).toBe(true);
	});
});

const release = (loaders: string[], gameVersions: string[]): ModpackRelease => ({
	versionId: "8902446",
	version: "4.1.0",
	stable: true,
	loaders,
	gameVersions,
	file: {
		filename: "pack.zip",
		url: "https://edge.forgecdn.net/files/8902/446/pack.zip",
		sizeBytes: null,
		digest: null,
	},
	serverPacks: [],
});

describe("naming the type and version a modpack release runs on", () => {
	it("drops the family tag and labels the loader the way the panel does", () => {
		expect(
			releaseIdentity(
				release(
					[
						"fabric",
					],
					[
						"1.20.1",
						"1.20",
					],
				),
				"1.21.1",
			),
		).toEqual({
			ar: "1.20.1 · Fabric",
			en: "1.20.1 · Fabric",
		});
	});

	it("keeps the raw loader ids when the release runs on a loader we have no server type for", () => {
		expect(
			releaseIdentity(
				release(
					[
						"quilt",
					],
					[
						"1.20.1",
					],
				),
				"1.20.1",
			),
		).toEqual({
			ar: "1.20.1 · quilt",
			en: "1.20.1 · quilt",
		});
	});

	it("falls back to the raw tags when none of them is a release version", () => {
		expect(
			releaseIdentity(
				release(
					[
						"fabric",
					],
					[
						"23w31a",
					],
				),
				"1.21.1",
			),
		).toEqual({
			ar: "23w31a · Fabric",
			en: "23w31a · Fabric",
		});
	});

	it("says so in both languages when the release names neither a version nor a loader", () => {
		expect(releaseIdentity(release([], []), "1.21.1")).toEqual({
			ar: "إصدار غير معروف · مشغّل غير معروف",
			en: "an unknown version · an unknown loader",
		});
	});
});

const stagingContext = (release: unknown) => {
	return {
		secret: () => null,
		variable: () => null,
		net: {
			json: async () => release,
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
	} as unknown as Bridge.Context;
};

const refusalOf = async (run: Promise<unknown>) => {
	try {
		await run;
	} catch (error) {
		return error;
	}

	return null;
};

describe("why a modpack cannot be staged", () => {
	it("a source we do not install from is named as such", async () => {
		const error = await refusalOf(
			stageModpack(
				stagingContext(null),
				{
					provider: "somewhere",
					project: "pack",
					versionId: "v1",
				},
				ServerVariant.Fabric,
				"1.21.1",
			),
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"This modpack comes from a source we can't install from. Pick another modpack from the Modpacks tab. Your files weren't changed.",
		);
		expect((error as BridgeUserError).text.ar).toContain("مصدر لا نثبّت منه");
	});

	it("a source that is not set up names the source", async () => {
		const error = await refusalOf(
			stageModpack(
				stagingContext(null),
				{
					provider: CatalogProviderId.CurseForge,
					project: "123",
					versionId: "456",
				},
				ServerVariant.Forge,
				"1.20.1",
			),
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"The modpack source CurseForge isn't available right now. Try again in a moment or pick a modpack from another source. Your files weren't changed.",
		);
		expect((error as BridgeUserError).text.ar).toContain("CurseForge");
	});

	it("a release the source no longer has asks for the modpack again", async () => {
		const error = await refusalOf(
			stageModpack(
				stagingContext({
					id: "v1",
					version_number: "0.3.2",
					files: [],
				}),
				{
					provider: CatalogProviderId.Modrinth,
					project: "pack",
					versionId: "v1",
				},
				ServerVariant.Fabric,
				"1.21.1",
			),
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"We couldn't find this modpack version at its source. Pick the modpack again from the Modpacks tab. Your files weren't changed.",
		);
	});
});

describe("a modpack download that fails", () => {
	for (const status of [
		404,
		410,
		401,
		403,
		503,
		null,
	]) {
		it(`answering ${String(status)} becomes the customer's reason and keeps the original`, () => {
			const original = new BridgeDownloadError(status, "cdn.modrinth.com answered");
			const mapped = downloadFailure(original, "All the Mods 9 0.3.2");

			expect(mapped).toBeInstanceOf(BridgeUserError);
			expect((mapped as BridgeUserError).text).toEqual(describeDownloadFailure(original, "All the Mods 9 0.3.2"));
			expect((mapped as BridgeUserError).cause).toBe(original);
		});
	}

	it("anything that is not a download answer passes through untouched", () => {
		const original = new Error("digest mismatch");

		expect(downloadFailure(original, "mod.jar")).toBe(original);
	});
});

describe("what installing a modpack reports", () => {
	it("names the modpack and its version", () => {
		expect(modpackInstalledText("All the Mods 9", "0.3.2", 0)).toEqual({
			ar: "تم تثبيت مودباك All the Mods 9 (0.3.2)",
			en: "Installed modpack All the Mods 9 (0.3.2)",
		});
	});

	it("says how many files the owner still has to upload", () => {
		expect(modpackInstalledText("All the Mods 9", "0.3.2", 1).en).toBe(
			"Installed modpack All the Mods 9 (0.3.2), 1 file is missing and need to be uploaded manually",
		);
		expect(modpackInstalledText("All the Mods 9", "0.3.2", 3).ar).toBe(
			"تم تثبيت مودباك All the Mods 9 (0.3.2)، ويلزم رفع 3 ملفات ناقصة يدويًا",
		);
	});

	it("removing the modpack names it", () => {
		expect(modpackRemovedActivity("All the Mods 9", null)).toEqual({
			name: BridgeEventName.ModpackRemoved,
			text: {
				ar: "تمت إزالة مودباك All the Mods 9 وموداته، وبدأ السيرفر بماب جديد",
				en: "Removed modpack All the Mods 9 and its mods, and the server started over with a fresh world",
			},
			subject: "All the Mods 9",
			details: {
				title: "All the Mods 9",
			},
		});
		expect(modpackRemovedActivity("", null).subject).toBeUndefined();
	});

	it("removing the modpack says where the old world was kept", () => {
		expect(modpackRemovedActivity("All the Mods 9", "world-all-the-mods-9-old").text).toEqual({
			ar: "تمت إزالة مودباك All the Mods 9 وموداته، وحُفظ الماب القديم باسم «world-all-the-mods-9-old» في تبويب المابات، وبدأ السيرفر بماب جديد",
			en: 'Removed modpack All the Mods 9 and its mods, kept the old world as "world-all-the-mods-9-old" in the Worlds tab, and the server started over with a fresh world',
		});
	});
});

const failingContext = (error: unknown, key: string | null = null) => {
	return {
		secret: () => key,
		variable: () => null,
		net: {
			json: async () => {
				throw error;
			},
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
	} as unknown as Bridge.Context;
};

const MODRINTH_REF = {
	provider: CatalogProviderId.Modrinth,
	project: "Aa5L6RtV",
	versionId: "NoSuchRel",
};

const CURSEFORGE_REF = {
	provider: CatalogProviderId.CurseForge,
	project: "123",
	versionId: "456",
};

const RELEASE_MISSING =
	"We couldn't find this modpack version at its source. Pick the modpack again from the Modpacks tab. Your files weren't changed.";

const stagingFailure = (context: Bridge.Context, ref: typeof MODRINTH_REF) => {
	return refusalOf(stageModpack(context, ref, ServerVariant.Fabric, "1.21.1"));
};

describe("a modpack source that answers with an error", () => {
	for (const status of [
		404,
		410,
	]) {
		it(`modrinth answering ${status} for the release is release not found, and staff keep the answer`, async () => {
			const original = new BridgeNetError(status, `api.modrinth.com answered ${status}`);
			const error = await stagingFailure(failingContext(original), MODRINTH_REF);

			expect(error).toBeInstanceOf(BridgeUserError);
			expect((error as BridgeUserError).text.en).toBe(RELEASE_MISSING);
			expect((error as BridgeUserError).cause).toBe(original);
		});
	}

	it("modrinth refusing us is the source not being available", async () => {
		const error = await stagingFailure(failingContext(new BridgeNetError(401, "answered 401")), MODRINTH_REF);

		expect((error as BridgeUserError).text.en).toBe(
			"The modpack source Modrinth isn't available right now. Try again in a moment or pick a modpack from another source. Your files weren't changed.",
		);
	});

	it("modrinth failing on its side is never read as not found", async () => {
		const original = new BridgeNetError(500, "api.modrinth.com answered 500");
		const error = await stagingFailure(failingContext(original), MODRINTH_REF);

		expect((error as BridgeUserError).text).toEqual({
			ar: "يواجه مصدر المودباك عطلًا حاليًا، جرب مرة ثانية بعد لحظة.",
			en: "The source of the modpack is down right now. Try again in a moment.",
		});
		expect((error as BridgeUserError).cause).toBe(original);
	});

	it("an unreachable modrinth says so", async () => {
		const error = await stagingFailure(failingContext(new BridgeNetError(null, "connection refused")), MODRINTH_REF);

		expect((error as BridgeUserError).text.en).toBe("We couldn't reach the source to download the modpack. Try again.");
	});

	it("a modrinth rate limit keeps its failure code", async () => {
		const error = await stagingFailure(failingContext(new BridgeNetError(429, "answered 429")), MODRINTH_REF);

		expect(error).toBeInstanceOf(BridgeFailureError);
		expect((error as BridgeFailureError).code).toBe(BridgeFailureCode.CatalogRateLimited);
	});

	it("curseforge answering 404 for the file is release not found", async () => {
		const error = await stagingFailure(
			failingContext(new BridgeNetError(404, "api.curseforge.com answered 404"), "key"),
			CURSEFORGE_REF,
		);

		expect((error as BridgeUserError).text.en).toBe(RELEASE_MISSING);
	});

	it("curseforge rejecting the key is the source not being available", async () => {
		const error = await stagingFailure(
			failingContext(new BridgeNetError(403, "api.curseforge.com answered 403"), "key"),
			CURSEFORGE_REF,
		);

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toContain("The modpack source CurseForge isn't available right now");
		expect((error as BridgeUserError).cause).toBeInstanceOf(BridgeSecretError);
	});

	it("a curseforge rate limit keeps its failure code", async () => {
		const error = await stagingFailure(failingContext(new BridgeNetError(429, "answered 429"), "key"), CURSEFORGE_REF);

		expect((error as BridgeFailureError).code).toBe(BridgeFailureCode.CatalogRateLimited);
	});
});
