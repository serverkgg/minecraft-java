import { describe, expect, test } from "bun:test";
import type { ModpackRelease } from "../providers";
import { serverRelease } from "./modpackFreshness";

const release = (overrides: Partial<ModpackRelease> = {}): ModpackRelease => ({
	versionId: "6620555",
	version: "BMC5 v40",
	stable: true,
	loaders: [
		"neoforge",
	],
	gameVersions: [
		"1.21.1",
	],
	file: {
		filename: "bmc5-v40.mrpack",
		url: "https://example.invalid/bmc5-v40.mrpack",
		sizeBytes: 4096,
		digest: null,
	},
	serverPacks: [],
	...overrides,
});

describe("choosing the modpack release a server gets", () => {
	test("the newest stable release wins", () => {
		const stable = release({
			versionId: "2",
		});

		expect(
			serverRelease([
				release({
					versionId: "1",
					stable: false,
				}),
				stable,
				release({
					versionId: "3",
				}),
			]),
		).toEqual(stable);
	});

	test("a beta is taken when the pack has published nothing stable", () => {
		const beta = release({
			versionId: "1",
			stable: false,
		});

		expect(
			serverRelease([
				beta,
				release({
					versionId: "2",
					stable: false,
				}),
			]),
		).toEqual(beta);
	});

	test("a release on a loader we cannot run is never chosen", () => {
		const neoforge = release({
			versionId: "2",
		});

		expect(
			serverRelease([
				release({
					versionId: "1",
					loaders: [
						"quilt",
					],
				}),
				neoforge,
			]),
		).toEqual(neoforge);
	});

	test("a pack with no release we can run answers with nothing", () => {
		expect(
			serverRelease([
				release({
					loaders: [
						"quilt",
					],
				}),
				release({
					loaders: [],
				}),
			]),
		).toBeNull();
		expect(serverRelease([])).toBeNull();
	});

	test("a release that also lists a loader we cannot run is still usable", () => {
		const mixed = release({
			loaders: [
				"quilt",
				"fabric",
			],
		});

		expect(
			serverRelease([
				mixed,
			]),
		).toEqual(mixed);
	});
});
