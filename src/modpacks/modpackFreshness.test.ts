import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { type ModpackRelease, type ModpackSource, uploadModpackSource } from "../providers";
import { freshnessOf, ModpackFreshness, serverRelease } from "./modpackFreshness";

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
	it("the newest stable release wins", () => {
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

	it("a beta is taken when the pack has published nothing stable", () => {
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

	it("a release on a loader we cannot run is never chosen", () => {
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

	it("a pack with no release we can run answers with nothing", () => {
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

	it("a release that also lists a loader we cannot run is still usable", () => {
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

describe("telling whether a modpack is behind its latest release", () => {
	const context = {} as Bridge.Context;

	const sourceOf = (releases: () => Promise<ModpackRelease[]>) => {
		return {
			releases: async () => await releases(),
		} as unknown as ModpackSource;
	};

	it("a newer server release makes it behind", async () => {
		const source = sourceOf(async () => [
			release({
				versionId: "2",
			}),
		]);

		expect(await freshnessOf(context, source, "AABBCC", "1")).toBe(ModpackFreshness.Behind);
	});

	it("the installed release being the latest makes it current", async () => {
		const source = sourceOf(async () => [
			release({
				versionId: "2",
			}),
		]);

		expect(await freshnessOf(context, source, "AABBCC", "2")).toBe(ModpackFreshness.Current);
	});

	it("a provider that cannot be reached leaves it unknown rather than current", async () => {
		const source = sourceOf(async () => {
			throw new Error("rate limited");
		});

		expect(await freshnessOf(context, source, "AABBCC", "2")).toBe(ModpackFreshness.Unknown);
	});

	it("an uploaded modpack is current without reading anything, because nobody publishes its updates", async () => {
		expect(await freshnessOf(context, uploadModpackSource, "AABBCC", "AABBCC")).toBe(ModpackFreshness.Current);
	});
});
