import { describe, expect, test } from "bun:test";
import { BridgeHoldReason } from "@serverkgg/bridge";
import { ServerVariant } from "../shared";
import { matchPendingFile, pendingHold, pendingMismatchMessage, settlePendingSidecar } from "./modpackPendingFiles";
import type { ModpackSidecar, PendingFile } from "./modpackSidecar";

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
	provider: "curseforge",
	project: "1226037",
	versionId: "6620555",
	version: "BMC5 v40",
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
	fileCount: 1,
	files: [
		"mods/create.jar",
	],
	pending: [
		pending(),
	],
	...overrides,
});

describe("matching an uploaded jar against the files we wait for", () => {
	test("finds the entry whatever its place in the list", () => {
		const wanted = pending({
			fileId: 2,
			fileName: "second.jar",
			sha1: "da39a3ee5e6b4b0d3255bfef95601890afd80709",
		});

		expect(
			matchPendingFile(
				[
					pending(),
					wanted,
				],
				"da39a3ee5e6b4b0d3255bfef95601890afd80709",
			),
		).toEqual(wanted);
	});

	test("reads an upper case checksum the same way", () => {
		expect(
			matchPendingFile(
				[
					pending(),
				],
				"0BEEC7B5EA3F0FDBC95D0DD47F3C5BC275DA8A33",
			)?.fileName,
		).toBe("bmcpalegardenpatcher-0.3.0.jar");
	});

	test("finds nothing for a jar the pack never asked for", () => {
		expect(
			matchPendingFile(
				[
					pending(),
				],
				"5ba93c9db0cff93f52b521d7420e43f6eda2784f",
			),
		).toBeNull();
	});
});

describe("telling the player which jar we wait for", () => {
	test("names every file we still need in both languages", () => {
		const message = pendingMismatchMessage([
			pending(),
			pending({
				fileName: "second.jar",
			}),
		]);

		expect(message.ar).toContain("المطلوب: bmcpalegardenpatcher-0.3.0.jar، second.jar");
		expect(message.en).toContain("we need: bmcpalegardenpatcher-0.3.0.jar، second.jar");
	});
});

describe("holding the install until the files arrive", () => {
	test("holds nothing when nothing is pending", () => {
		expect(pendingHold([])).toBeUndefined();
	});

	test("holds the install and counts the files we wait for", () => {
		expect(
			pendingHold([
				pending(),
				pending({
					fileId: 2,
				}),
			]),
		).toEqual({
			hold: {
				count: 2,
				reason: BridgeHoldReason.PendingFiles,
			},
		});
	});
});

describe("recording a pending file that arrived", () => {
	test("tracks the jar's path and drops it from the waiting list", () => {
		expect(
			settlePendingSidecar(sidecar(), {
				pending: [],
				present: [
					"mods/bmcpalegardenpatcher-0.3.0.jar",
				],
			}),
		).toMatchObject({
			files: [
				"mods/create.jar",
				"mods/bmcpalegardenpatcher-0.3.0.jar",
			],
			pending: [],
		});
	});

	test("never records the same path twice", () => {
		expect(
			settlePendingSidecar(sidecar(), {
				pending: [],
				present: [
					"mods/create.jar",
				],
			}).files,
		).toEqual([
			"mods/create.jar",
		]);
	});

	test("leaves an untracked pack untracked", () => {
		expect(
			settlePendingSidecar(
				sidecar({
					files: null,
				}),
				{
					pending: [],
					present: [
						"mods/bmcpalegardenpatcher-0.3.0.jar",
					],
				},
			).files,
		).toBeNull();
	});
});
