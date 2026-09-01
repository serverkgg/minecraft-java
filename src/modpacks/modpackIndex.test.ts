import { describe, expect, test } from "bun:test";
import { parseModpackIndex } from "./modpackIndex";

const SHA512 = "a".repeat(128);

const index = (file: Record<string, unknown>) => {
	return JSON.stringify({
		formatVersion: 1,
		game: "minecraft",
		name: "a pack",
		dependencies: {
			minecraft: "1.20.1",
			"fabric-loader": "0.16.9",
		},
		files: [
			file,
		],
	});
};

const entry = (overrides: Record<string, unknown> = {}) => {
	return {
		path: "mods/alpha.jar",
		downloads: [
			"https://cdn.modrinth.com/data/aKCwCJlY/versions/FkaSuQb0/alpha.jar",
		],
		hashes: {
			sha512: SHA512,
		},
		fileSize: 1_286_460,
		...overrides,
	};
};

describe("reading a modpack index", () => {
	test("takes a file the pack describes properly", () => {
		const parsed = parseModpackIndex(index(entry()));

		expect(parsed.files).toEqual([
			{
				path: "mods/alpha.jar",
				url: "https://cdn.modrinth.com/data/aKCwCJlY/versions/FkaSuQb0/alpha.jar",
				digest: `sha512:${SHA512}`,
				sizeBytes: 1_286_460,
				projectId: "aKCwCJlY",
			},
		]);
	});

	test("keeps the file when the pack forgot its size, because the checksum is what we verify", () => {
		const parsed = parseModpackIndex(
			index(
				entry({
					fileSize: undefined,
				}),
			),
		);

		expect(parsed.files.at(0)?.sizeBytes).toBe(null);
		expect(parsed.files.at(0)?.digest).toBe(`sha512:${SHA512}`);
	});

	test("refuses a file with no checksum we can verify", () => {
		expect(() => {
			parseModpackIndex(
				index(
					entry({
						hashes: {},
					}),
				),
			);
		}).toThrow("no checksum we can verify");
	});

	test("refuses a file whose checksum is not a sha512", () => {
		expect(() => {
			parseModpackIndex(
				index(
					entry({
						hashes: {
							sha512: "not a hash",
						},
					}),
				),
			);
		}).toThrow("no checksum we can verify");
	});

	test("refuses a file downloaded from a host we do not install from", () => {
		expect(() => {
			parseModpackIndex(
				index(
					entry({
						downloads: [
							"https://cdn.example.com/alpha.jar",
						],
					}),
				),
			);
		}).toThrow("from a host we do not install from");
	});

	test("refuses a host that only looks like one we allow", () => {
		expect(() => {
			parseModpackIndex(
				index(
					entry({
						downloads: [
							"https://cdn.modrinth.com.example.com/alpha.jar",
						],
					}),
				),
			);
		}).toThrow("from a host we do not install from");
	});

	test("skips past a host we refuse to reach one we allow", () => {
		const parsed = parseModpackIndex(
			index(
				entry({
					downloads: [
						"https://cdn.example.com/alpha.jar",
						"https://raw.githubusercontent.com/owner/repo/main/alpha.jar",
					],
				}),
			),
		);

		expect(parsed.files.at(0)?.url).toBe("https://raw.githubusercontent.com/owner/repo/main/alpha.jar");
	});

	test("refuses a plain http download from a host we otherwise allow", () => {
		expect(() => {
			parseModpackIndex(
				index(
					entry({
						downloads: [
							"http://cdn.modrinth.com/data/aKCwCJlY/versions/FkaSuQb0/alpha.jar",
						],
					}),
				),
			);
		}).toThrow("from a host we do not install from");
	});

	test("installs a file even when the pack marks it unsupported on a server", () => {
		const parsed = parseModpackIndex(
			index(
				entry({
					env: {
						server: "unsupported",
					},
				}),
			),
		);

		expect(parsed.files.at(0)?.path).toBe("mods/alpha.jar");
	});
});
