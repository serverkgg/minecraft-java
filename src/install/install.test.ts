import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { MOJANG_MANIFEST as MOJANG_MANIFEST_URL } from "../shared";
import { install } from "./install";

const STAMP = {
	variant: "vanilla",
	version: "1.21.4",
	build: null,
	java: 21,
	launch: {
		kind: "jar",
		target: "server.jar",
	},
	rconPassword: "kept-rcon-password",
	rconPasswordNext: null,
};

const bootWith = () => {
	const files = new Map<string, string>([
		[
			".serverk-install.json",
			JSON.stringify(STAMP),
		],
		[
			"server.jar",
			"",
		],
		[
			"server.properties",
			"",
		],
	]);
	const variables: Record<string, string> = {
		SERVER_TYPE: "vanilla",
		MC_VERSION: "1.21.4",
	};
	const reported: Bridge.Activity[] = [];
	const emitted: string[] = [];
	const logged: string[] = [];
	const context = {
		variable: (key: string) => variables[key] ?? null,
		secret: () => null,
		files: {
			exists: async (path: string) => files.has(path),
			read: async (path: string) => files.get(path) ?? "",
			write: async (path: string, text: string) => {
				files.set(path, text);
			},
			ensure: async () => {},
			remove: async (path: string) => {
				files.delete(path);
			},
			list: async () => [],
			size: async () => 0,
			digest: async (path: string) => `digest-of-${files.get(path) ?? ""}`,
		},
		codec: {
			javaProperties: {
				read: async () => {
					return {};
				},
				merge: async () => {},
			},
		},
		net: {
			json: async () => {
				throw new Error("offline");
			},
			text: async () => {
				throw new Error("offline");
			},
		},
		logs: {
			tail: async () => [],
		},
		log: Object.assign(
			(message: string) => {
				logged.push(message);
			},
			{
				warn: () => {},
				error: () => {},
			},
		),
		emit: (event: string) => {
			emitted.push(event);
		},
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		reported,
		emitted,
		logged,
	};
};

describe("starting a server whose install is current", () => {
	it("reports nothing, so a plain start never reads as an install", async () => {
		const { context, reported, logged } = bootWith();

		const outcome = await install.run(context);

		expect(outcome).toBeUndefined();
		expect(logged).toContain("install is current");
		expect(reported).toEqual([]);
	});
});

const FORGE_STAMP = {
	variant: "forge",
	version: "1.20.1",
	build: "47.4.0",
	java: 17,
	launch: {
		kind: "args",
		target: "libraries/net/minecraftforge/forge/1.20.1-47.4.0/unix_args.txt",
	},
	rconPassword: "kept-rcon-password",
	rconPasswordNext: null,
};

const PAPER_STAMP = {
	variant: "paper",
	version: "1.21.4",
	build: "123",
	java: 21,
	launch: {
		kind: "jar",
		target: "server.jar",
	},
	rconPassword: "kept-rcon-password",
	rconPasswordNext: null,
};

const paperBuildOf = (id: number, channel: string) => {
	return {
		id,
		channel,
		downloads: {
			"server:default": {
				url: `https://fill-data.papermc.io/paper-${id}.jar`,
				size: id,
				checksums: {
					sha256: `sha256-of-${id}`,
				},
			},
		},
	};
};

const MANIFEST = {
	latest: {
		release: "1.21.4",
	},
	versions: [
		{
			id: "1.21.4",
			type: "release",
			url: "https://piston-meta.mojang.com/1.21.4.json",
		},
	],
};

interface ServerSetup {
	files: Record<string, string>;
	variables: Record<string, string>;
	net: Record<string, unknown>;
	download?: () => Promise<void>;
}

const serverWith = (setup: ServerSetup) => {
	const files = new Map(Object.entries(setup.files));
	const touched: string[] = [];
	const under = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

	const copy = (from: string, to: string) => {
		for (const [key, value] of [
			...files.entries(),
		]) {
			if (under(key, from)) {
				files.set(`${to}${key.slice(from.length)}`, value);
			}
		}
	};

	const drop = (root: string) => {
		for (const key of [
			...files.keys(),
		]) {
			if (under(key, root)) {
				files.delete(key);
			}
		}
	};

	const answer = (url: string) => {
		const value = setup.net[url];

		if (value === undefined) {
			throw new Error(`offline: ${url}`);
		}

		return value;
	};

	const context = {
		variable: (key: string) => setup.variables[key] ?? null,
		secret: () => null,
		files: {
			exists: async (path: string) =>
				[
					...files.keys(),
				].some((key) => under(key, path)),
			read: async (path: string) => files.get(path) ?? "",
			write: async (path: string, text: string) => {
				touched.push(`write ${path}`);
				files.set(path, text);
			},
			ensure: async () => {},
			remove: async (path: string) => {
				touched.push(`remove ${path}`);
				drop(path);
			},
			move: async (from: string, to: string) => {
				touched.push(`move ${from}`);
				copy(from, to);
				drop(from);
			},
			download: async (path: string) => {
				touched.push(`download ${path}`);
				await setup.download?.();
				files.set(path, "new");
			},
			list: async () => [],
			size: async () => 0,
			digest: async (path: string) => `digest-of-${files.get(path) ?? ""}`,
		},
		exec: async (args: string[]) => {
			touched.push(`exec ${args[0]}`);

			if (args[0] === "cp") {
				const [from, to] = args.slice(-2);

				if (from && to) {
					copy(from, to);
				}
			}

			return {
				code: 0,
				stdout: "",
				stderr: "",
			};
		},
		codec: {
			javaProperties: {
				read: async () => {
					return {};
				},
				merge: async (path: string) => {
					touched.push(`merge ${path}`);
				},
			},
		},
		net: {
			json: async (url: string) => answer(url),
			text: async (url: string) => answer(url),
		},
		logs: {
			tail: async () => [],
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		emit: () => {},
		activity: {
			report: () => {},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		files,
		touched,
	};
};

const errorOf = async (promise: Promise<unknown>) => {
	try {
		await promise;

		return null;
	} catch (error) {
		return error;
	}
};

const changesOf = (touched: string[]) => {
	return touched.filter((entry) => !entry.startsWith("exec find"));
};

const MODPACK_SIDECAR_TEXT = JSON.stringify({
	provider: "modrinth",
	project: "survival-plus",
	versionId: "Xy12",
	version: "1.0.0",
	title: "Survival Plus",
	mcVersion: "1.21.4",
	variant: "paper",
	loaderVersion: "123",
	files: [
		"plugins/essentials.jar",
	],
});

describe("install", () => {
	describe("switching to a server type that has no stable build for the version", () => {
		const incident = () => {
			return serverWith({
				files: {
					".serverk-install.json": JSON.stringify(FORGE_STAMP),
					[FORGE_STAMP.launch.target]: "",
					"libraries/net/minecraftforge/forge/1.20.1-47.4.0/forge.jar": "",
					"mods/create.jar": "",
					"world/level.dat": "",
				},
				variables: {
					SERVER_TYPE: "paper",
					MC_VERSION: "26.3",
				},
				net: {
					"https://fill.papermc.io/v3/projects/paper/versions/26.3/builds": [
						paperBuildOf(157, "BETA"),
						paperBuildOf(3, "ALPHA"),
					],
				},
			});
		};

		it("refuses in the customer's words", async () => {
			const { context } = incident();

			const error = await errorOf(install.run(context));

			expect(error).toBeInstanceOf(BridgeUserError);
			expect((error as BridgeUserError).text.en).toBe(
				"Paper has no stable build for Minecraft 26.3 yet. Pick another version or server type.",
			);
		});

		it("leaves every file and the stamp exactly as they were", async () => {
			const { context, files, touched } = incident();
			const before = new Map(files);

			await errorOf(install.run(context));

			expect(changesOf(touched)).toEqual([]);
			expect(files).toEqual(before);
		});
	});

	describe("an installer that fails after the old runtime was saved", () => {
		const failing = () => {
			return serverWith({
				files: {
					".serverk-install.json": JSON.stringify(PAPER_STAMP),
					"server.jar": "old",
					"plugins/essentials.jar": "",
					"world/level.dat": "",
				},
				variables: {
					SERVER_TYPE: "paper",
					MC_VERSION: "1.21.4",
					LOADER_VERSION: "124",
				},
				net: {
					"https://fill.papermc.io/v3/projects/paper/versions/1.21.4/builds": [
						paperBuildOf(124, "STABLE"),
						paperBuildOf(123, "STABLE"),
					],
					[MOJANG_MANIFEST_URL]: MANIFEST,
				},
				download: async () => {
					throw new Error("the download was cut off");
				},
			});
		};

		it("rethrows the installer's own error", async () => {
			const { context } = failing();

			const error = await errorOf(install.run(context));

			expect(String(error)).toContain("the download was cut off");
		});

		it("puts the previous server jar back and keeps the recorded identity in the stamp", async () => {
			const { context, files } = failing();

			await errorOf(install.run(context));

			expect(files.get("server.jar")).toBe("old");
			expect(JSON.parse(files.get(".serverk-install.json") ?? "{}")).toEqual({
				...PAPER_STAMP,
				launchDigest: null,
			});
			expect(files.has("plugins/essentials.jar")).toBe(true);
			expect(files.has("world/level.dat")).toBe(true);
		});

		it("saves the old runtime before it removes it", async () => {
			const { context, touched } = failing();

			await errorOf(install.run(context));

			const saved = touched.indexOf("exec cp");
			const removed = touched.indexOf("remove server.jar");

			expect(saved).toBeGreaterThan(-1);
			expect(removed).toBeGreaterThan(saved);
		});
	});

	describe("removing a modpack when the installer fails", () => {
		const detaching = () => {
			return serverWith({
				files: {
					".serverk-install.json": JSON.stringify(PAPER_STAMP),
					".serverk-modpack.json": MODPACK_SIDECAR_TEXT,
					"server.jar": "old",
					"server.properties": "level-name=world",
					"plugins/essentials.jar": "",
					"world/level.dat": "",
				},
				variables: {
					SERVER_TYPE: "paper",
					MC_VERSION: "1.21.4",
					LOADER_VERSION: "124",
				},
				net: {
					"https://fill.papermc.io/v3/projects/paper/versions/1.21.4/builds": [
						paperBuildOf(124, "STABLE"),
						paperBuildOf(123, "STABLE"),
					],
					[MOJANG_MANIFEST_URL]: MANIFEST,
				},
				download: async () => {
					throw new Error("the download was cut off");
				},
			});
		};

		it("leaves the world, its level-name and the modpack exactly where they were", async () => {
			const { context, files, touched } = detaching();

			const error = await errorOf(install.run(context));

			expect(String(error)).toContain("the download was cut off");
			expect(files.get("world/level.dat")).toBe("");
			expect(
				[
					...files.keys(),
				].filter((path) => path.startsWith("world-")),
			).toEqual([]);
			expect(touched.filter((entry) => entry.startsWith("merge ") || entry.startsWith("move world"))).toEqual([]);
			expect(files.get(".serverk-modpack.json")).toBe(MODPACK_SIDECAR_TEXT);
		});
	});

	describe("a requested build the loader no longer publishes", () => {
		const unpublished = () => {
			return serverWith({
				files: {
					".serverk-install.json": JSON.stringify(PAPER_STAMP),
					"server.jar": "old",
					"world/level.dat": "",
				},
				variables: {
					SERVER_TYPE: "paper",
					MC_VERSION: "1.21.4",
					LOADER_VERSION: "99",
				},
				net: {
					"https://fill.papermc.io/v3/projects/paper/versions/1.21.4/builds": [
						paperBuildOf(124, "STABLE"),
						paperBuildOf(123, "STABLE"),
					],
					[MOJANG_MANIFEST_URL]: MANIFEST,
				},
			});
		};

		it("refuses in the customer's words instead of installing another build", async () => {
			const { context } = unpublished();

			const error = await errorOf(install.run(context));

			expect(error).toBeInstanceOf(BridgeUserError);
			expect((error as BridgeUserError).text).toEqual({
				ar: "الإصدار 99 من Paper لم يعد منشورًا. اختر إصدارًا آخر من المشغّل.",
				en: "Paper build 99 is no longer published. Pick another loader build.",
			});
		});

		it("leaves every file and the stamp exactly as they were", async () => {
			const { context, files, touched } = unpublished();
			const before = new Map(files);

			await errorOf(install.run(context));

			expect(changesOf(touched)).toEqual([]);
			expect(files).toEqual(before);
		});

		it("still starts a server whose recorded build is current, without asking the catalogue", async () => {
			const { context, touched } = serverWith({
				files: {
					".serverk-install.json": JSON.stringify(PAPER_STAMP),
					"server.jar": "old",
					"server.properties": "",
				},
				variables: {
					SERVER_TYPE: "paper",
					MC_VERSION: "1.21.4",
					LOADER_VERSION: "123",
				},
				net: {},
			});

			const error = await errorOf(install.run(context));

			expect(error).toBeNull();
			expect(touched.filter((entry) => entry.startsWith("download") || entry.startsWith("remove"))).toEqual([]);
		});
	});
});

describe("a restore that put back an older install record than the server jar on disk", () => {
	const RESTORED_STAMP = {
		...PAPER_STAMP,
		launchDigest: "digest-of-1.21.4 jar",
	};

	const restored = (saved: Record<string, string>) => {
		return serverWith({
			files: {
				".serverk-install.json": JSON.stringify(RESTORED_STAMP),
				"server.jar": "1.21.1 jar",
				"server.properties": "",
				"world/level.dat": "",
				...saved,
			},
			variables: {
				SERVER_TYPE: "paper",
			},
			net: {
				"https://fill.papermc.io/v3/projects/paper/versions/1.21.4/builds": [
					paperBuildOf(123, "STABLE"),
				],
				[MOJANG_MANIFEST_URL]: MANIFEST,
			},
		});
	};

	it("puts the saved runtime of the recorded install back instead of booting the other jar", async () => {
		const { context, files, touched } = restored({
			".serverk-staging/runtime-previous/identity.json": JSON.stringify(RESTORED_STAMP),
			".serverk-staging/runtime-previous/server.jar": "1.21.4 jar",
		});

		const error = await errorOf(install.run(context));

		expect(error).toBeNull();
		expect(files.get("server.jar")).toBe("1.21.4 jar");
		expect(touched.some((entry) => entry.startsWith("download"))).toBe(false);
		expect(files.has("world/level.dat")).toBe(true);
	});

	it("installs the recorded version again when no runtime was saved", async () => {
		const { context, files, touched } = restored({});

		const error = await errorOf(install.run(context));

		expect(error).toBeNull();
		expect(touched).toContain("download server.jar");
		expect(files.get("server.jar")).toBe("new");
		expect(JSON.parse(files.get(".serverk-install.json") ?? "{}")).toMatchObject({
			variant: "paper",
			version: "1.21.4",
			launchDigest: "digest-of-new",
		});
		expect(files.has("world/level.dat")).toBe(true);
	});
});

describe("starting a server whose stamp predates the launch digest", () => {
	it("records the digest of the jar it boots, so a later restore can tell the jar apart", async () => {
		const { context } = bootWith();

		await install.run(context);

		expect(JSON.parse(await context.files.read(".serverk-install.json"))).toMatchObject({
			...STAMP,
			launchDigest: "digest-of-",
		});
	});
});
