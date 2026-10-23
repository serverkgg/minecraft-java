import { describe, expect, it } from "bun:test";
import { memoryContext } from "../testing";
import {
	PACK_INDEX,
	type PackEntry,
	PackFormat,
	packArchivePath,
	packFormatOf,
	parsePackIndex,
	readPackIndex,
	safePackName,
	writePackIndex,
} from "./packIndex";
import { ServerVariant } from "./variant";

const entry = (overrides: Partial<PackEntry> = {}): PackEntry => ({
	sha1: "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33",
	format: PackFormat.CurseForge,
	path: ".serverk-packs/better-mc-0beec7b5.zip",
	name: "Better MC",
	version: "v42",
	mcVersion: "1.20.1",
	variant: ServerVariant.Forge,
	loaderVersion: "47.3.0",
	fileCount: 212,
	sizeBytes: 4096,
	uploadedAt: "2026-10-23T09:00:00.000Z",
	...overrides,
});

describe("the index of the modpacks an owner uploaded", () => {
	it("reads back exactly what it wrote", async () => {
		const { context } = memoryContext();
		const entries = [
			entry(),
			entry({
				sha1: "62cdb7020ff920e5aa642c3d4066950dd1f01f4d",
				format: PackFormat.Modrinth,
				path: ".serverk-packs/cozy-pack-62cdb702.mrpack",
				variant: ServerVariant.Fabric,
			}),
		];

		await writePackIndex(context, entries);

		expect(await readPackIndex(context)).toEqual(entries);
	});

	it("is empty before anything was uploaded", async () => {
		expect(await readPackIndex(memoryContext().context)).toEqual([]);
	});

	it("is empty when the file is not json", () => {
		expect(parsePackIndex("{not json")).toEqual([]);
		expect(parsePackIndex('{"packs":[]}')).toEqual([]);
	});

	it("drops an entry whose checksum could walk out of the packs folder", () => {
		expect(
			parsePackIndex(
				JSON.stringify([
					entry({
						sha1: "../../server",
					}),
				]),
			),
		).toEqual([]);
	});

	it("drops an entry whose stored file is not a pack file in the packs folder", () => {
		for (const path of [
			"../better-mc-0beec7b5.zip",
			".serverk-packs/../server.jar",
			".serverk-packs/sub/better-mc-0beec7b5.zip",
			".serverk-packs/Better MC.zip",
			".serverk-packs/better-mc-0beec7b5.mrpack",
			".serverk-packs/index.json",
		]) {
			expect(
				parsePackIndex(
					JSON.stringify([
						entry({
							path,
						}),
					]),
				),
			).toEqual([]);
		}
	});

	it("drops an entry on a format or a server type we do not install", () => {
		expect(
			parsePackIndex(
				JSON.stringify([
					{
						...entry(),
						format: "technic",
					},
					entry({
						variant: ServerVariant.Paper,
					}),
				]),
			),
		).toEqual([]);
	});

	it("keeps one entry per checksum", () => {
		expect(
			parsePackIndex(
				JSON.stringify([
					entry(),
					entry({
						name: "Copy",
					}),
				]),
			).map((pack) => pack.name),
		).toEqual([
			"Better MC",
		]);
	});

	it("fills in the counts and texts an entry left out", () => {
		const { sha1, format, path, mcVersion, variant } = entry();

		expect(
			parsePackIndex(
				JSON.stringify([
					{
						sha1,
						format,
						path,
						mcVersion,
						variant,
					},
				]),
			),
		).toEqual([
			{
				sha1,
				format,
				path,
				name: "",
				version: "",
				mcVersion,
				variant,
				loaderVersion: "",
				fileCount: 0,
				sizeBytes: 0,
				uploadedAt: "",
			},
		]);
	});

	it("lives inside the packs folder", () => {
		expect(PACK_INDEX).toBe(".serverk-packs/index.json");
	});
});

describe("where an uploaded modpack is kept", () => {
	const SHA1 = "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33";

	it("names a curseforge export after the pack and the start of its checksum, so players get a readable zip", () => {
		expect(packArchivePath("Better MC", SHA1, PackFormat.CurseForge)).toBe(".serverk-packs/better-mc-0beec7b5.zip");
	});

	it("keeps a modrinth pack as an mrpack", () => {
		expect(packArchivePath("Cozy Pack", SHA1, PackFormat.Modrinth)).toBe(".serverk-packs/cozy-pack-0beec7b5.mrpack");
	});

	it("keeps only lowercase letters, digits and single hyphens in the name", () => {
		expect(safePackName("  All the Mods 9: To the Sky!! (ATM9sky) ")).toBe("all-the-mods-9-to-the-sky-atm9sky");
		expect(safePackName("../../server.jar")).toBe("server-jar");
	});

	it("falls back to modpack when nothing readable is left of the name", () => {
		expect(safePackName("")).toBe("modpack");
		expect(safePackName("مودباك سيرفري")).toBe("modpack");
		expect(packArchivePath("", SHA1, PackFormat.CurseForge)).toBe(".serverk-packs/modpack-0beec7b5.zip");
	});

	it("caps a long name and never ends it on a hyphen", () => {
		const name = safePackName(`${"a".repeat(47)} b`);

		expect(name).toBe("a".repeat(47));
		expect(name.length).toBeLessThanOrEqual(48);
	});
});

describe("telling the pack format from the uploaded file name", () => {
	it("reads a zip as a curseforge export and an mrpack as a modrinth pack, in any case", () => {
		expect(packFormatOf("Better MC-v42.zip")).toBe(PackFormat.CurseForge);
		expect(packFormatOf("pack.ZIP")).toBe(PackFormat.CurseForge);
		expect(packFormatOf("Cozy 1.4.0.mrpack")).toBe(PackFormat.Modrinth);
	});

	it("knows no other format", () => {
		expect(packFormatOf("pack.rar")).toBeNull();
		expect(packFormatOf("mrpack")).toBeNull();
	});
});
