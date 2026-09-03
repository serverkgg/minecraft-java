import { describe, expect, test } from "bun:test";
import type { BlockedFile } from "./modpackIndex";
import { serverPackAllowed, serverPackMerged, serverPackRescued, serverPackSelects } from "./modpackServerPack";

const blocked = (overrides: Partial<BlockedFile> = {}): BlockedFile => ({
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

describe("picking the blocked jars out of a server pack", () => {
	test("matches the jar wherever the author put the mods folder", () => {
		expect(
			serverPackSelects([
				blocked(),
				blocked({
					fileName: "another.jar",
				}),
			]),
		).toEqual([
			"**/mods/bmcpalegardenpatcher-0.3.0.jar",
			"**/mods/another.jar",
		]);
	});

	test("selects nothing when nothing is blocked", () => {
		expect(serverPackSelects([])).toEqual([]);
	});
});

describe("verifying a jar taken from a server pack", () => {
	test("accepts the jar the modpack asks for", () => {
		expect(serverPackRescued(blocked(), "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33")).toBe(true);
	});

	test("accepts an upper case checksum", () => {
		expect(serverPackRescued(blocked(), "0BEEC7B5EA3F0FDBC95D0DD47F3C5BC275DA8A33")).toBe(true);
	});

	test("refuses a jar with another checksum", () => {
		expect(serverPackRescued(blocked(), "da39a3ee5e6b4b0d3255bfef95601890afd80709")).toBe(false);
	});

	test("refuses a jar we could not hash", () => {
		expect(serverPackRescued(blocked(), null)).toBe(false);
	});
});

describe("where a server pack may be downloaded from", () => {
	test("takes the curseforge cdn over https", () => {
		expect(serverPackAllowed("https://edge.forgecdn.net/files/6620/555/pack.zip")).toBe(true);
	});

	test("takes any curseforge cdn host", () => {
		expect(serverPackAllowed("https://mediafilez.forgecdn.net/files/6620/555/pack.zip")).toBe(true);
	});

	test("refuses the same host over plain http", () => {
		expect(serverPackAllowed("http://edge.forgecdn.net/files/6620/555/pack.zip")).toBe(false);
	});

	test("refuses another host", () => {
		expect(serverPackAllowed("https://example.com/pack.zip")).toBe(false);
	});

	test("refuses a host that only ends in the cdn name", () => {
		expect(serverPackAllowed("https://evilforgecdn.net.example.com/pack.zip")).toBe(false);
	});

	test("refuses text that is not a url", () => {
		expect(serverPackAllowed("pack.zip")).toBe(false);
	});
});

describe("carrying what is still missing to the next server pack", () => {
	const first = blocked();

	const second = blocked({
		fileId: 6_620_556,
		fileName: "another.jar",
		name: "Another Mod",
	});

	test("carries only the files the last server pack could not hand us", () => {
		expect(
			serverPackMerged(
				{
					missing: [
						first,
						second,
					],
					rescued: [],
				},
				{
					missing: [
						second,
					],
					rescued: [
						first,
					],
				},
			),
		).toEqual({
			missing: [
				second,
			],
			rescued: [
				first,
			],
		});
	});

	test("keeps what every server pack rescued in the order they rescued it", () => {
		expect(
			serverPackMerged(
				{
					missing: [
						second,
					],
					rescued: [
						first,
					],
				},
				{
					missing: [],
					rescued: [
						second,
					],
				},
			),
		).toEqual({
			missing: [],
			rescued: [
				first,
				second,
			],
		});
	});

	test("leaves the carried list alone when a server pack rescued nothing", () => {
		expect(
			serverPackMerged(
				{
					missing: [
						first,
						second,
					],
					rescued: [],
				},
				{
					missing: [
						first,
						second,
					],
					rescued: [],
				},
			),
		).toEqual({
			missing: [
				first,
				second,
			],
			rescued: [],
		});
	});
});
