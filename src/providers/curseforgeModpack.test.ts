import { describe, expect, test } from "bun:test";
import type { CurseforgeFile } from "@serverkgg/bridge/catalogs";
import {
	curseforgeFilesExhausted,
	curseforgeReleaseOf,
	curseforgeServerPackOf,
	curseforgeServerPacksOf,
	SERVER_PACK_CANDIDATES,
} from "./curseforgeModpack";

const entry = (overrides: Partial<CurseforgeFile> = {}): CurseforgeFile => {
	return {
		id: 4_712_868,
		modId: 238_222,
		fileName: "jei-1.20.1-forge-15.3.0.4.jar",
		displayName: "JEI 15.3.0.4",
		downloadUrl: "https://edge.forgecdn.net/files/4712/868/jei-1.20.1-forge-15.3.0.4.jar",
		fileLength: 1234,
		fileDate: "2026-01-01T00:00:00Z",
		isAvailable: true,
		releaseType: 1,
		gameVersions: [
			"1.20.1",
			"Forge",
		],
		hashes: [
			{
				algo: 1,
				value: "0BEEC7B5EA3F0FDBC95D0DD47F3C5BC275DA8A33",
			},
		],
		dependencies: [],
		...overrides,
	};
};

describe("reading a curseforge modpack release", () => {
	test("lowers the loader tag out of the game versions so the server type resolves", () => {
		const release = curseforgeReleaseOf(
			entry({
				gameVersions: [
					"1.20.1",
					"Forge",
					"Client",
					"Server",
				],
			}),
		);

		expect(release?.loaders).toEqual([
			"forge",
		]);
		expect(release?.gameVersions).toEqual([
			"1.20.1",
		]);
	});

	test("marks a release build stable and carries the file id as the version", () => {
		const release = curseforgeReleaseOf(entry());

		expect(release?.stable).toBe(true);
		expect(release?.versionId).toBe("4712868");
		expect(release?.file.digest).toBe("sha1:0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33");
	});

	test("treats a beta build as unstable", () => {
		expect(
			curseforgeReleaseOf(
				entry({
					releaseType: 2,
				}),
			)?.stable,
		).toBe(false);
	});

	test("leaves out the author's own server pack", () => {
		expect(
			curseforgeReleaseOf(
				entry({
					isServerPack: true,
				}),
			),
		).toBeNull();
	});

	test("leaves out a file curseforge no longer serves", () => {
		expect(
			curseforgeReleaseOf(
				entry({
					isAvailable: false,
				}),
			),
		).toBeNull();
	});

	test("prefers the url curseforge handed us over the id split", () => {
		const release = curseforgeReleaseOf(
			entry({
				downloadUrl: "https://edge.forgecdn.net/files/7000/123/BMC5 [NEOFORGE] 1.21.1 v52.zip",
			}),
		);

		expect(release?.file.url).toBe("https://edge.forgecdn.net/files/7000/123/BMC5%20%5BNEOFORGE%5D%201.21.1%20v52.zip");
	});

	test("falls back to the id split url when the pack blocks direct downloads", () => {
		const release = curseforgeReleaseOf(
			entry({
				downloadUrl: null,
			}),
		);

		expect(release?.file.url).toBe("https://edge.forgecdn.net/files/4712/868/jei-1.20.1-forge-15.3.0.4.jar");
	});

	test("refuses a blocked file we could not checksum", () => {
		expect(
			curseforgeReleaseOf(
				entry({
					downloadUrl: null,
					hashes: [],
				}),
			),
		).toBeNull();
	});

	test("refuses a download from a host that is not curseforge", () => {
		const release = curseforgeReleaseOf(
			entry({
				downloadUrl: "https://example.com/files/jei.jar",
			}),
		);

		expect(release?.file.url).toBe("https://edge.forgecdn.net/files/4712/868/jei-1.20.1-forge-15.3.0.4.jar");
	});
});

const PAGE_SIZE = 50;

const page = (count: number, totalCount?: number) => {
	return {
		data: Array.from(
			{
				length: count,
			},
			(_unused, index) => {
				return entry({
					id: 1000 + index,
				});
			},
		),
		...(totalCount === undefined
			? {}
			: {
					pagination: {
						totalCount,
					},
				}),
	};
};

describe("paging through every file a curseforge project published", () => {
	test("stops on a page shorter than the page size", () => {
		expect(curseforgeFilesExhausted(PAGE_SIZE + 3, page(3, 400))).toBe(true);
	});

	test("stops on an empty page", () => {
		expect(curseforgeFilesExhausted(PAGE_SIZE, page(0, 400))).toBe(true);
	});

	test("keeps going while the project has more files than we hold", () => {
		expect(curseforgeFilesExhausted(PAGE_SIZE, page(PAGE_SIZE, 120))).toBe(false);
	});

	test("stops once we hold everything the project counts", () => {
		expect(curseforgeFilesExhausted(PAGE_SIZE * 2, page(PAGE_SIZE, 100))).toBe(true);
	});

	test("keeps going when the project counts nothing", () => {
		expect(curseforgeFilesExhausted(PAGE_SIZE, page(PAGE_SIZE))).toBe(false);
	});
});

describe("pairing a curseforge modpack file with the author's server pack", () => {
	const client = entry({
		id: 7000,
		serverPackFileId: 7001,
	});

	const serverPack = entry({
		id: 7001,
		fileName: "BMC5-Server.zip",
		downloadUrl: "https://edge.forgecdn.net/files/7000/1/BMC5-Server.zip",
		isServerPack: true,
		parentProjectFileId: 7000,
	});

	test("takes the server pack the client file points at", () => {
		expect(
			curseforgeServerPackOf(client, [
				entry({
					id: 6999,
				}),
				serverPack,
			])?.id,
		).toBe(7001);
	});

	test("takes the server pack that points back at the client file", () => {
		expect(
			curseforgeServerPackOf(
				entry({
					id: 7000,
				}),
				[
					serverPack,
				],
			)?.id,
		).toBe(7001);
	});

	test("finds nothing when no file links either way", () => {
		expect(
			curseforgeServerPackOf(client, [
				entry({
					id: 6999,
					isServerPack: true,
					parentProjectFileId: 123,
				}),
			]),
		).toBeNull();
	});

	test("carries the server pack onto the release", () => {
		const release = curseforgeReleaseOf(client, [
			serverPack,
		]);

		expect(release?.serverPacks.at(0)?.url).toBe("https://edge.forgecdn.net/files/7000/1/BMC5-Server.zip");
		expect(release?.serverPacks.at(0)?.digest).toBe("sha1:0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33");
	});

	test("refuses a server pack curseforge hands us no direct url for", () => {
		expect(
			curseforgeReleaseOf(client, [
				entry({
					id: 7001,
					downloadUrl: null,
					isServerPack: true,
				}),
			])?.serverPacks,
		).toEqual([]);
	});

	test("leaves the server packs out when the release has none", () => {
		expect(curseforgeReleaseOf(entry())?.serverPacks).toEqual([]);
	});
});

describe("choosing which server packs a blocked file may be rescued from", () => {
	const client = entry({
		id: 7000,
		gameVersions: [
			"1.21.1",
			"NeoForge",
		],
	});

	const pack = (overrides: Partial<CurseforgeFile> = {}): CurseforgeFile => {
		return entry({
			fileName: "pack-server.zip",
			downloadUrl: "https://edge.forgecdn.net/files/7100/1/pack-server.zip",
			gameVersions: [
				"1.21.1",
				"NeoForge",
			],
			isServerPack: true,
			...overrides,
		});
	};

	const idsOf = (candidates: CurseforgeFile[]) => {
		return candidates.map((candidate) => candidate.id);
	};

	test("keeps the server pack the client file links first", () => {
		expect(
			idsOf(
				curseforgeServerPacksOf(
					entry({
						id: 7000,
						gameVersions: [
							"1.21.1",
							"NeoForge",
						],
						serverPackFileId: 7001,
					}),
					[
						pack({
							id: 7100,
							fileDate: "2026-06-01T00:00:00Z",
						}),
						pack({
							id: 7001,
							fileDate: "2024-01-01T00:00:00Z",
						}),
					],
				),
			),
		).toEqual([
			7001,
			7100,
		]);
	});

	test("takes only the server packs built for the client file's minecraft version", () => {
		expect(
			idsOf(
				curseforgeServerPacksOf(client, [
					pack({
						id: 7100,
					}),
					pack({
						id: 7101,
						gameVersions: [
							"1.20.1",
							"NeoForge",
						],
					}),
				]),
			),
		).toEqual([
			7100,
		]);
	});

	test("takes the newest server pack first", () => {
		expect(
			idsOf(
				curseforgeServerPacksOf(client, [
					pack({
						id: 7100,
						fileDate: "2025-01-01T00:00:00Z",
					}),
					pack({
						id: 7101,
						fileDate: "2026-03-01T00:00:00Z",
					}),
				]),
			),
		).toEqual([
			7101,
			7100,
		]);
	});

	test("never takes more than the candidate cap", () => {
		expect(
			curseforgeServerPacksOf(client, [
				pack({
					id: 7100,
					fileDate: "2026-03-01T00:00:00Z",
				}),
				pack({
					id: 7101,
					fileDate: "2026-02-01T00:00:00Z",
				}),
				pack({
					id: 7102,
					fileDate: "2026-01-01T00:00:00Z",
				}),
			]).length,
		).toBe(SERVER_PACK_CANDIDATES);
	});

	test("takes the linked server pack once", () => {
		expect(
			idsOf(
				curseforgeServerPacksOf(
					entry({
						id: 7000,
						gameVersions: [
							"1.21.1",
							"NeoForge",
						],
						serverPackFileId: 7100,
					}),
					[
						pack({
							id: 7100,
						}),
					],
				),
			),
		).toEqual([
			7100,
		]);
	});

	test("leaves out a server pack curseforge hands us no direct url for", () => {
		expect(
			idsOf(
				curseforgeServerPacksOf(client, [
					pack({
						downloadUrl: null,
						id: 7100,
					}),
					pack({
						id: 7101,
					}),
				]),
			),
		).toEqual([
			7101,
		]);
	});

	test("finds nothing when the project publishes no server pack", () => {
		expect(
			curseforgeServerPacksOf(client, [
				entry({
					id: 7100,
				}),
			]),
		).toEqual([]);
	});
});
