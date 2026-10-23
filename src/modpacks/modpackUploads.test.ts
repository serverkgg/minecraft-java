import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import {
	MODPACK_UPLOAD_STAGING,
	PACK_INDEX,
	type PackEntry,
	PackFormat,
	parsePackIndex,
	ServerVariant,
} from "../shared";
import { type MemoryArchive, type MemoryContextOptions, memoryContext } from "../testing";
import { MODPACK_SIDECAR } from "./modpackSidecar";
import { MANIFEST_STAGING, modpackUploads, PACK_APPLIED } from "./modpackUploads";

const SHA1 = "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33";

const ZIP_UPLOAD = `${MODPACK_UPLOAD_STAGING}/a1/Better MC-v42.zip`;

const MRPACK_UPLOAD = `${MODPACK_UPLOAD_STAGING}/a1/Cozy.mrpack`;

const STORED_ZIP = ".serverk-packs/better-mc-0beec7b5.zip";

const CURSEFORGE_EXPORT: MemoryArchive = {
	"manifest.json": JSON.stringify({
		manifestType: "minecraftModpack",
		manifestVersion: 1,
		name: "Better MC",
		version: "v42",
		minecraft: {
			version: "1.20.1",
			modLoaders: [
				{
					id: "forge-47.3.0",
					primary: true,
				},
			],
		},
		files: [
			{
				projectID: 1,
				fileID: 2,
				required: true,
			},
			{
				projectID: 3,
				fileID: 4,
				required: true,
			},
		],
		overrides: "overrides",
	}),
	"modlist.html": "",
	"overrides/config/better.toml": "",
};

const QUILT_PACK: MemoryArchive = {
	"modrinth.index.json": JSON.stringify({
		formatVersion: 1,
		game: "minecraft",
		versionId: "1.0.0",
		name: "Quilted",
		dependencies: {
			minecraft: "1.21.1",
			"quilt-loader": "0.26.4",
		},
		files: [],
	}),
};

const STORED: PackEntry = {
	sha1: SHA1,
	format: PackFormat.CurseForge,
	path: STORED_ZIP,
	name: "Better MC",
	version: "v42",
	mcVersion: "1.20.1",
	variant: ServerVariant.Forge,
	loaderVersion: "47.3.0",
	fileCount: 2,
	sizeBytes: 4096,
	uploadedAt: "2026-10-20T09:00:00.000Z",
};

const uploading = (path: string, archive: MemoryArchive, options: MemoryContextOptions = {}) => {
	return memoryContext({
		...options,
		archives: {
			...options.archives,
			[path]: archive,
		},
		digests: {
			[path]: SHA1.toUpperCase(),
		},
		sizes: {
			[path]: 4096,
		},
	});
};

const storedContext = (options: MemoryContextOptions = {}) => {
	return memoryContext({
		...options,
		files: {
			[PACK_INDEX]: JSON.stringify([
				STORED,
			]),
			[STORED_ZIP]: "",
			...options.files,
		},
	});
};

const refusalOf = async (run: Promise<unknown>) => {
	try {
		await run;
	} catch (error) {
		return error;
	}

	return null;
};

const row = (id: string): Bridge.Row => ({
	id,
});

describe("uploading a modpack the owner built", () => {
	it("stores a curseforge export under its name and checksum and names its version and loader", async () => {
		const { context, archives, files } = uploading(ZIP_UPLOAD, CURSEFORGE_EXPORT);

		expect(await modpackUploads.add?.(context, ZIP_UPLOAD)).toEqual({
			notice: {
				ar: "تم رفع مودباك Better MC (1.20.1 · Forge)",
				en: "Uploaded modpack Better MC (1.20.1 · Forge)",
			},
		});

		expect(archives.has(STORED_ZIP)).toBe(true);
		expect(archives.has(ZIP_UPLOAD)).toBe(false);
		expect(
			[
				...files.keys(),
			].some((path) => path.startsWith(MANIFEST_STAGING)),
		).toBe(false);
		expect(parsePackIndex(files.get(PACK_INDEX) ?? "")).toEqual([
			{
				...STORED,
				uploadedAt: expect.any(String),
			},
		]);
	});

	it("keeps the archive byte for byte, so players import the same file", async () => {
		const { context, archives } = uploading(ZIP_UPLOAD, CURSEFORGE_EXPORT);

		await modpackUploads.add?.(context, ZIP_UPLOAD);

		expect(archives.get(STORED_ZIP)).toBe(CURSEFORGE_EXPORT);
	});

	it("titles a pack that declares no name after the uploaded file, stores it as modpack and versions it by the checksum", async () => {
		const { context, files } = uploading(MRPACK_UPLOAD, {
			"modrinth.index.json": JSON.stringify({
				formatVersion: 1,
				game: "minecraft",
				dependencies: {
					minecraft: "1.21.1",
					"fabric-loader": "0.16.5",
				},
				files: [],
			}),
		});

		await modpackUploads.add?.(context, MRPACK_UPLOAD);

		expect(parsePackIndex(files.get(PACK_INDEX) ?? "")).toMatchObject([
			{
				format: PackFormat.Modrinth,
				path: ".serverk-packs/modpack-0beec7b5.mrpack",
				name: "Cozy",
				version: "0beec7b5",
				variant: ServerVariant.Fabric,
				loaderVersion: "0.16.5",
				fileCount: 0,
			},
		]);
	});

	it("refuses a path outside the modpack drop point", async () => {
		const outside = ".serverk-uploads/world/a1/Better MC-v42.zip";

		for (const input of [
			outside,
			`${MODPACK_UPLOAD_STAGING}/../world/a1/pack.zip`,
			`/${ZIP_UPLOAD}`,
		]) {
			const { context, archives } = uploading(outside, CURSEFORGE_EXPORT);
			const error = await refusalOf(modpackUploads.add?.(context, input) ?? Promise.resolve());

			expect(error).toBeInstanceOf(BridgeUserError);
			expect((error as BridgeUserError).text.en).toBe("We couldn't find the uploaded file. Upload it again.");
			expect(archives.has(outside)).toBe(true);
		}
	});

	it("refuses a zip with no manifest.json and drops the upload", async () => {
		const { context, archives } = uploading(ZIP_UPLOAD, {
			"mods/sodium.jar": "",
		});
		const error = await refusalOf(modpackUploads.add?.(context, ZIP_UPLOAD) ?? Promise.resolve());

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"The uploaded file has no manifest.json. Export the modpack from the CurseForge app and upload the ZIP it makes as it is.",
		);
		expect((error as BridgeUserError).text.ar).toContain("manifest.json");
		expect(archives.has(ZIP_UPLOAD)).toBe(false);
	});

	it("refuses a quilt pack the way the catalog does", async () => {
		const { context, files } = uploading(MRPACK_UPLOAD, QUILT_PACK);
		const error = await refusalOf(modpackUploads.add?.(context, MRPACK_UPLOAD) ?? Promise.resolve());

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toContain("This modpack runs on Quilt");
		expect(files.has(PACK_INDEX)).toBe(false);
	});

	it("refuses a file that is not an archive in a way the owner can act on", async () => {
		const { context } = memoryContext({
			files: {
				[ZIP_UPLOAD]: "not a zip",
			},
		});
		const error = await refusalOf(modpackUploads.add?.(context, ZIP_UPLOAD) ?? Promise.resolve());

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"We couldn't open the uploaded file as an archive. Export the modpack again and upload it.",
		);
	});

	it("keeps one copy of a pack uploaded twice and says it is already there", async () => {
		const { context, archives, files } = uploading(ZIP_UPLOAD, CURSEFORGE_EXPORT, {
			files: {
				[PACK_INDEX]: JSON.stringify([
					STORED,
				]),
			},
			archives: {
				[STORED_ZIP]: CURSEFORGE_EXPORT,
			},
		});

		expect(await modpackUploads.add?.(context, ZIP_UPLOAD)).toEqual({
			notice: {
				ar: "مودباك Better MC موجود مسبقًا في مودباكاتك المرفوعة",
				en: "Modpack Better MC is already in your uploads",
			},
		});
		expect(archives.has(ZIP_UPLOAD)).toBe(false);
		expect(parsePackIndex(files.get(PACK_INDEX) ?? "")).toEqual([
			STORED,
		]);
	});

	it("stores the pack again when its index entry outlived the archive", async () => {
		const { context, archives, files } = uploading(ZIP_UPLOAD, CURSEFORGE_EXPORT, {
			files: {
				[PACK_INDEX]: JSON.stringify([
					STORED,
				]),
			},
		});

		await modpackUploads.add?.(context, ZIP_UPLOAD);

		expect(archives.has(STORED_ZIP)).toBe(true);
		expect(parsePackIndex(files.get(PACK_INDEX) ?? "")).toHaveLength(1);
	});
});

describe("listing the modpacks the owner uploaded", () => {
	it("offers the stored archive itself for download", async () => {
		const rows = await modpackUploads.list(storedContext().context);

		expect(rows).toEqual([
			{
				id: SHA1,
				name: "Better MC",
				version: "v42",
				mcVersion: "1.20.1",
				loader: "Forge 47.3.0",
				files: 2,
				size: "4.0 KB",
				uploadedAt: "2026-10-20",
				applied: "",
				path: STORED_ZIP,
			},
		]);
	});

	it("marks the pack the server is set to run", async () => {
		const rows = await modpackUploads.list(
			storedContext({
				variables: {
					MODPACK: `upload:${SHA1}:${SHA1}`,
				},
			}).context,
		);

		expect(rows.at(0)?.applied).toBe("✓");
	});

	it("leaves out a pack whose archive is gone", async () => {
		const { context, files } = storedContext();

		files.delete(STORED_ZIP);

		expect(await modpackUploads.list(context)).toEqual([]);
	});
});

describe("deleting an uploaded modpack", () => {
	it("removes the archive and its index entry", async () => {
		const { context, files } = storedContext();

		await modpackUploads.actions?.remove?.(context, row(SHA1), {});

		expect(files.has(STORED_ZIP)).toBe(false);
		expect(parsePackIndex(files.get(PACK_INDEX) ?? "")).toEqual([]);
	});

	it("removes the file at the path the index recorded", async () => {
		const recorded = ".serverk-packs/first-name-0beec7b5.zip";
		const { context, files } = memoryContext({
			files: {
				[PACK_INDEX]: JSON.stringify([
					{
						...STORED,
						path: recorded,
					},
				]),
				[recorded]: "",
				[STORED_ZIP]: "",
			},
		});

		await modpackUploads.actions?.remove?.(context, row(SHA1), {});

		expect(files.has(recorded)).toBe(false);
		expect(files.has(STORED_ZIP)).toBe(true);
	});

	it("refuses while the server is set to run it", async () => {
		const { context, files } = storedContext({
			variables: {
				MODPACK: `upload:${SHA1}:${SHA1}`,
			},
		});
		const error = await refusalOf(modpackUploads.actions?.remove?.(context, row(SHA1), {}) ?? Promise.resolve());

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text).toEqual(PACK_APPLIED);
		expect(files.has(STORED_ZIP)).toBe(true);
	});

	it("refuses while the installed modpack is still this one", async () => {
		const { context } = storedContext({
			files: {
				[MODPACK_SIDECAR]: JSON.stringify({
					provider: "upload",
					project: SHA1,
					versionId: SHA1,
					mcVersion: "1.20.1",
					variant: "forge",
				}),
			},
		});
		const error = await refusalOf(modpackUploads.actions?.remove?.(context, row(SHA1), {}) ?? Promise.resolve());

		expect((error as BridgeUserError).text).toEqual(PACK_APPLIED);
	});

	it("explains on the row why the pack in use cannot be deleted", async () => {
		const { context } = storedContext();

		expect(
			await modpackUploads.unavailable?.(context, {
				id: SHA1,
				applied: "✓",
			}),
		).toEqual({
			remove: PACK_APPLIED,
		});
		expect(await modpackUploads.unavailable?.(context, row(SHA1))).toEqual({});
	});

	it("names a pack it cannot find", async () => {
		const error = await refusalOf(
			modpackUploads.actions?.remove?.(storedContext().context, row("nope"), {}) ?? Promise.resolve(),
		);

		expect((error as BridgeUserError).text.en).toBe("We couldn't find that modpack. Refresh the list and try again.");
	});
});
