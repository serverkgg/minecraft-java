import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { MODPACK_SIDECAR, type PendingFile } from "../modpacks";
import { PENDING_STAGING } from "../shared";
import { pendingFileOf, pending as pendingModule } from "./pending";

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

describe("uploading a file the modpack was waiting for", () => {
	test("reports the file, the mod and the modpack it completes", async () => {
		const upload = `${PENDING_STAGING}/a1/bmcpalegardenpatcher-0.3.0.jar`;
		const files = new Map<string, string>([
			[
				MODPACK_SIDECAR,
				JSON.stringify({
					provider: "curseforge",
					project: "123",
					versionId: "456",
					version: "1.4.0",
					title: "Better MC",
					mcVersion: "1.21.1",
					variant: "fabric",
					pending: [
						pending(),
						pending({
							fileId: 7,
							fileName: "other.jar",
							sha1: "ffffffffffffffffffffffffffffffffffffffff",
						}),
					],
				}),
			],
			[
				upload,
				"",
			],
		]);
		const reported: Bridge.Activity[] = [];
		const context = {
			files: {
				exists: async (path: string) => files.has(path),
				read: async (path: string) => files.get(path) ?? "",
				write: async (path: string, text: string) => {
					files.set(path, text);
				},
				move: async (from: string, to: string) => {
					files.set(to, files.get(from) ?? "");
					files.delete(from);
				},
				digest: async () => "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33",
			},
			log: () => {},
			activity: {
				report: (entry: Bridge.Activity) => {
					reported.push(entry);
				},
			},
		} as unknown as Bridge.Context;

		await pendingModule.add(context, upload);

		expect(files.has("mods/bmcpalegardenpatcher-0.3.0.jar")).toBe(true);
		expect(reported).toEqual([
			{
				name: BridgeEventName.ModInstalled,
				text: {
					ar: "تم رفع bmcpalegardenpatcher-0.3.0.jar الناقص لمودباك Better MC",
					en: "Uploaded the missing bmcpalegardenpatcher-0.3.0.jar for modpack Better MC",
				},
				subject: "BMC Datafixer",
				details: {
					kind: "mod",
					file: "bmcpalegardenpatcher-0.3.0.jar",
					title: "BMC Datafixer",
					modpack: "Better MC",
					remaining: 1,
				},
			},
		]);
	});
});
