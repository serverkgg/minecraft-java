import { describe, expect, test } from "bun:test";
import type { PendingFile } from "../modpacks";
import { pendingFileOf } from "./pending";

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

describe("describing a file the player still owes us", () => {
	test("names the file id, the jar and the mod's page", () => {
		expect(pendingFileOf(pending())).toMatchObject({
			id: "6620555",
			fileName: "bmcpalegardenpatcher-0.3.0.jar",
			sizeBytes: 4096,
			sourceUrl: "https://www.curseforge.com/minecraft/mc-mods/bmc-patcher",
		});
	});

	test("hands the checksum over with the algorithm that produced it", () => {
		expect(pendingFileOf(pending()).digest).toBe("sha1:0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33");
	});

	test("titles the file with the mod name in both languages", () => {
		expect(pendingFileOf(pending()).title).toEqual({
			ar: "BMC Datafixer",
			en: "BMC Datafixer",
		});
	});

	test("explains in both languages why the player has to fetch it", () => {
		const note = pendingFileOf(pending()).note;

		expect(note?.ar).toContain("كيرس فورج");
		expect(note?.en).toContain("CurseForge");
	});

	test("leaves the size out when the pack never told us", () => {
		expect(
			pendingFileOf(
				pending({
					sizeBytes: null,
				}),
			).sizeBytes,
		).toBeNull();
	});

	test("leaves the page out when we do not know it", () => {
		expect(
			pendingFileOf(
				pending({
					pageUrl: null,
				}),
			).sourceUrl,
		).toBeNull();
	});
});
