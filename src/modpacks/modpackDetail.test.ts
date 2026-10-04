import { describe, expect, it } from "bun:test";
import { ServerVariant } from "../shared";
import { detachPinnedBuild } from "./applyModpack";
import { ModpackFreshness } from "./modpackFreshness";
import { type ModpackSidecar, modpackModCount, type PendingFile, parseModpackSidecar } from "./modpackSidecar";
import { MODPACK_UPDATE_ACTION, modpackUpdateOf, pendingBadges } from "./modpackStatus";

const pending = (overrides: Partial<PendingFile> = {}): PendingFile => ({
	fileId: 6_620_555,
	fileName: "bmcpalegardenpatcher-0.3.0.jar",
	modId: 1_226_037,
	name: "BMC Datafixer",
	pageUrl: "https://www.curseforge.com/minecraft/mc-mods/bmc-patcher",
	sha1: "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33",
	sizeBytes: 4096,
	slug: "bmc-patcher",
	...overrides,
});

const sidecar = (overrides: Partial<ModpackSidecar> = {}): ModpackSidecar => ({
	provider: "modrinth",
	project: "AABBCC",
	versionId: "v2",
	version: "1.21.1-5.0",
	title: "Better MC",
	icon: null,
	pageUrl: null,
	description: null,
	author: null,
	downloads: null,
	mcVersion: "1.21.1",
	variant: ServerVariant.NeoForge,
	loaderVersion: "21.1.176",
	appliedAt: "2026-09-01T12:00:00.000Z",
	fileCount: 3,
	files: [
		"mods/create.jar",
		"mods/jei.jar",
		"config/create-server.toml",
		"kubejs/server_scripts/recipes.js",
	],
	pending: [],
	...overrides,
});

describe("counting the mods a modpack laid down", () => {
	it("counts only the jars under mods", () => {
		expect(modpackModCount(sidecar())).toBe(2);
	});

	it("falls back to the recorded file count when the pack predates file tracking", () => {
		expect(
			modpackModCount(
				sidecar({
					files: null,
					fileCount: 17,
				}),
			),
		).toBe(17);
	});
});

describe("reading a modpack sidecar", () => {
	it("accepts a sidecar written before the pack carried a description, author or downloads", () => {
		const parsed = parseModpackSidecar(
			JSON.stringify({
				provider: "curseforge",
				project: "123",
				versionId: "456",
				version: "BMC5 v40",
				title: "Better MC",
				icon: null,
				pageUrl: null,
				mcVersion: "1.21.1",
				variant: "neoforge",
				loaderVersion: "21.1.176",
				appliedAt: "2026-08-01T00:00:00.000Z",
				fileCount: 2,
				files: [
					"mods/a.jar",
				],
			}),
		);

		expect(parsed).toMatchObject({
			provider: "curseforge",
			project: "123",
			description: null,
			author: null,
			downloads: null,
		});
	});

	it("keeps the description, author and downloads a newer pack recorded", () => {
		const parsed = parseModpackSidecar(
			JSON.stringify(
				sidecar({
					description: "A kitchen-sink pack",
					author: "someone",
					downloads: 12_345,
				}),
			),
		);

		expect(parsed).toMatchObject({
			description: "A kitchen-sink pack",
			author: "someone",
			downloads: 12_345,
		});
	});

	it("rejects a sidecar naming a server type we do not run", () => {
		expect(
			parseModpackSidecar(
				JSON.stringify(
					sidecar({
						variant: "quilt" as ServerVariant,
					}),
				),
			),
		).toBeNull();
	});

	it("rejects text that is not json", () => {
		expect(parseModpackSidecar("{")).toBeNull();
	});

	it("reads back the files still waiting on the player", () => {
		const pending = {
			fileId: 6_620_555,
			fileName: "bmcpalegardenpatcher-0.3.0.jar",
			modId: 1_226_037,
			name: "BMC Datafixer",
			pageUrl: "https://www.curseforge.com/minecraft/mc-mods/bmc-patcher",
			sha1: "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33",
			sizeBytes: 4096,
			slug: "bmc-patcher",
		};

		const parsed = parseModpackSidecar(
			JSON.stringify(
				sidecar({
					pending: [
						pending,
					],
				}),
			),
		);

		expect(parsed?.pending).toEqual([
			pending,
		]);
	});

	it("fills in what a pending entry left out and lowers its checksum", () => {
		const parsed = parseModpackSidecar(
			JSON.stringify(
				sidecar({
					pending: [
						{
							fileId: 1,
							fileName: "patcher.jar",
							modId: 2,
							sha1: "0BEEC7B5EA3F0FDBC95D0DD47F3C5BC275DA8A33",
						} as PendingFile,
					],
				}),
			),
		);

		expect(parsed?.pending).toEqual([
			{
				fileId: 1,
				fileName: "patcher.jar",
				modId: 2,
				name: "patcher.jar",
				pageUrl: null,
				sha1: "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33",
				sizeBytes: null,
				slug: "",
			},
		]);
	});

	it("drops the pending entries it cannot make sense of", () => {
		const parsed = parseModpackSidecar(
			JSON.stringify({
				...sidecar(),
				pending: [
					null,
					"patcher.jar",
					{
						fileId: 1,
						modId: 2,
					},
					{
						fileId: 1,
						fileName: "patcher.jar",
						modId: 2,
						sha1: "",
					},
				],
			}),
		);

		expect(parsed?.pending).toEqual([]);
	});

	it("accepts a sidecar written before the pack tracked pending files", () => {
		const { pending: _pending, ...rest } = sidecar();

		expect(parseModpackSidecar(JSON.stringify(rest))?.pending).toEqual([]);
	});
});

describe("the loader build a detach keeps", () => {
	it("keeps the pack's loader build when the server stays on the same type", () => {
		expect(detachPinnedBuild(sidecar(), ServerVariant.NeoForge)).toBe("21.1.176");
	});

	it("drops the pack's loader build when the server moves to another type", () => {
		expect(detachPinnedBuild(sidecar(), ServerVariant.Paper)).toBeNull();
	});

	it("pins nothing without a sidecar", () => {
		expect(detachPinnedBuild(null, ServerVariant.NeoForge)).toBeNull();
	});
});

describe("showing the files a held modpack waits for", () => {
	it("shows no badge while nothing is pending", () => {
		expect(pendingBadges([])).toEqual([]);
	});

	it("counts one missing file in the singular", () => {
		expect(
			pendingBadges([
				pending(),
			]).at(0)?.label,
		).toEqual({
			ar: "ملف واحد ناقص",
			en: "1 file missing",
		});
	});

	it("counts more than one missing file", () => {
		expect(
			pendingBadges([
				pending(),
				pending({
					fileId: 2,
				}),
			]).at(0)?.label,
		).toEqual({
			ar: "ملفان ناقصان",
			en: "2 files missing",
		});
	});
});

describe("when a modpack can be updated", () => {
	it("offers the update whenever a newer release exists, even on a pack that no longer matches the server", () => {
		for (const mismatched of [
			false,
			true,
		]) {
			expect(modpackUpdateOf(mismatched, ModpackFreshness.Behind)).toEqual({
				actions: [
					MODPACK_UPDATE_ACTION,
				],
			});
		}
	});

	it("a pack on its latest release says so in the words the update refusal uses", () => {
		expect(modpackUpdateOf(false, ModpackFreshness.Current)).toEqual({
			actions: [],
			unavailable: {
				[MODPACK_UPDATE_ACTION]: {
					ar: "المودباك على آخر إصدار.",
					en: "This modpack is already on its latest release.",
				},
			},
		});
	});

	it("a pack on its latest release that no longer matches the server points to installing it again", () => {
		expect(modpackUpdateOf(true, ModpackFreshness.Current).unavailable?.[MODPACK_UPDATE_ACTION]?.en).toBe(
			"This modpack is on its latest release but doesn't match your server's type or version. Install it again from the Modpacks tab.",
		);
	});

	it("leaves the update to the handler when the provider could not say which release is latest", () => {
		for (const mismatched of [
			false,
			true,
		]) {
			expect(modpackUpdateOf(mismatched, ModpackFreshness.Unknown)).toEqual({
				actions: [
					MODPACK_UPDATE_ACTION,
				],
			});
		}
	});
});
