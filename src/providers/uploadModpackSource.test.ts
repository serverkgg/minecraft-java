import { describe, expect, it } from "bun:test";
import { BridgeUserError } from "@serverkgg/bridge";
import { PACK_INDEX, type PackEntry, PackFormat, ServerVariant } from "../shared";
import { memoryContext } from "../testing";
import { CatalogProviderId } from "./provider";
import { UPLOAD_MISSING, uploadModpackSource } from "./uploadModpackSource";

const BETTER_MC = "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33";

const COZY = "62cdb7020ff920e5aa642c3d4066950dd1f01f4d";

const BETTER_MC_PATH = ".serverk-packs/better-mc-0beec7b5.zip";

const COZY_PATH = ".serverk-packs/cozy-pack-62cdb702.mrpack";

const pack = (overrides: Partial<PackEntry> = {}): PackEntry => ({
	sha1: BETTER_MC,
	format: PackFormat.CurseForge,
	path: BETTER_MC_PATH,
	name: "Better MC",
	version: "v42",
	mcVersion: "1.20.1",
	variant: ServerVariant.Forge,
	loaderVersion: "47.3.0",
	fileCount: 212,
	sizeBytes: 4096,
	uploadedAt: "2026-10-20T09:00:00.000Z",
	...overrides,
});

const COZY_PACK = pack({
	sha1: COZY,
	format: PackFormat.Modrinth,
	path: COZY_PATH,
	name: "Cozy Pack",
	version: "1.4.0",
	mcVersion: "1.21.1",
	variant: ServerVariant.Fabric,
	loaderVersion: "0.16.5",
	uploadedAt: "2026-10-22T09:00:00.000Z",
});

const uploads = (stored = true) => {
	return memoryContext({
		files: {
			[PACK_INDEX]: JSON.stringify([
				pack(),
				COZY_PACK,
			]),
			...(stored
				? {
						[BETTER_MC_PATH]: "",
						[COZY_PATH]: "",
					}
				: {}),
		},
	}).context;
};

const refusalOf = async (run: Promise<unknown>) => {
	try {
		await run;
	} catch (error) {
		return error;
	}

	return null;
};

describe("reading an uploaded modpack as a release", () => {
	it("describes the stored archive with the type and version the pack declared", async () => {
		expect(await uploadModpackSource.release(uploads(), BETTER_MC, BETTER_MC)).toEqual({
			versionId: BETTER_MC,
			version: "v42",
			stable: true,
			loaders: [
				"forge",
			],
			gameVersions: [
				"1.20.1",
			],
			file: {
				filename: "better-mc-0beec7b5.zip",
				url: "",
				sizeBytes: 4096,
				digest: `sha1:${BETTER_MC}`,
			},
			serverPacks: [],
			local: {
				path: BETTER_MC_PATH,
				format: CatalogProviderId.CurseForge,
			},
		});
	});

	it("reads a modrinth pack in the modrinth format", async () => {
		const release = await uploadModpackSource.release(uploads(), COZY, COZY);

		expect(release?.local).toEqual({
			path: COZY_PATH,
			format: CatalogProviderId.Modrinth,
		});
	});

	it("reads the archive from the path the index recorded, never one rebuilt from the name", async () => {
		const recorded = ".serverk-packs/first-name-0beec7b5.zip";
		const { context } = memoryContext({
			files: {
				[PACK_INDEX]: JSON.stringify([
					pack({
						path: recorded,
						name: "Renamed",
					}),
				]),
				[recorded]: "",
			},
		});

		expect((await uploadModpackSource.release(context, BETTER_MC, BETTER_MC))?.local?.path).toBe(recorded);
	});

	it("answers nothing once the stored archive is gone", async () => {
		expect(await uploadModpackSource.release(uploads(false), BETTER_MC, BETTER_MC)).toBeNull();
	});

	it("answers nothing for a checksum the owner never uploaded", async () => {
		expect(await uploadModpackSource.release(uploads(), COZY, BETTER_MC)).toBeNull();
		expect(await uploadModpackSource.release(uploads(), "nope", "nope")).toBeNull();
	});

	it("names the pack itself as the project, with no page, author or downloads", async () => {
		expect(await uploadModpackSource.project(uploads(), COZY)).toEqual({
			id: COZY,
			title: "Cozy Pack",
			icon: null,
			pageUrl: null,
			description: null,
			author: null,
			downloads: null,
		});
	});

	it("offers exactly one release, the upload itself", async () => {
		expect((await uploadModpackSource.releases(uploads(), COZY)).map((release) => release.versionId)).toEqual([
			COZY,
		]);
	});

	it("asks for the upload again when it is no longer in the index", async () => {
		for (const run of [
			uploadModpackSource.project(uploads(), "nope"),
			uploadModpackSource.releases(uploads(), "nope"),
		]) {
			const error = await refusalOf(run);

			expect(error).toBeInstanceOf(BridgeUserError);
			expect((error as BridgeUserError).text).toEqual(UPLOAD_MISSING);
		}
	});
});

describe("listing uploaded modpacks in the catalog", () => {
	const search = (query: string, page = 0, pageSize = 20) => {
		return uploadModpackSource.search(uploads(), {
			query,
			page,
			pageSize,
			category: null,
			sort: null,
		});
	};

	it("shows the newest upload first, with the type and version it runs on", async () => {
		const results = await search("");

		expect(results.total).toBe(2);
		expect(
			results.hits.map((hit) => ({
				id: hit.id,
				description: hit.description,
				pageUrl: hit.pageUrl,
			})),
		).toEqual([
			{
				id: COZY,
				description: "1.21.1 · Fabric",
				pageUrl: null,
			},
			{
				id: BETTER_MC,
				description: "1.20.1 · Forge",
				pageUrl: null,
			},
		]);
	});

	it("filters by name in any case", async () => {
		expect((await search("better")).hits.map((hit) => hit.title)).toEqual([
			"Better MC",
		]);
	});

	it("pages through the uploads", async () => {
		const second = await search("", 1, 1);

		expect(second.total).toBe(2);
		expect(second.hits.map((hit) => hit.id)).toEqual([
			BETTER_MC,
		]);
	});

	it("is always ready, because it needs no key", () => {
		expect(uploadModpackSource.ready(uploads())).toBe(true);
	});
});
