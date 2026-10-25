import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { CurseforgeHash } from "@serverkgg/bridge/catalogs";
import { simplify } from "prismarine-nbt";
import type { SidecarEntry } from "../addons";
import { MODPACK_VARIABLE } from "../modpacks";
import { CatalogProviderId } from "../providers";
import { parseLevel } from "../worlds";
import {
	CLIENT_PACK_BUILD,
	CLIENT_PACK_DECODE_SCRIPT,
	CLIENT_PACK_DIRECTORY,
	CLIENT_PACK_SERVERS_DAT,
	CLIENT_PACK_SIDECAR,
	CLIENT_PACK_STAGING,
	CLIENT_PACK_ZIP_SCRIPT,
	ClientPackFormat,
	clientPack,
	clientPackFormat,
	clientPackName,
	modCountText,
} from "./clientPack";

const MODS_SIDECAR = "mods/.serverk-catalog.json";

const CURSEFORGE_FILES = "https://api.curseforge.com/v1/mods/files";

const MODRINTH_HASHES = "https://api.modrinth.com/v2/version_files";

const ADDRESS = "ahmed.srvk.gg";

const SODIUM: SidecarEntry = {
	provider: CatalogProviderId.Modrinth,
	project: "AANobbMI",
	version: "0.5.8",
	versionId: "OihdIimA",
	title: "Sodium",
	gameVersion: "1.20.1",
	icon: null,
	pageUrl: "https://modrinth.com/mod/sodium",
};

const LITHIUM: SidecarEntry = {
	provider: CatalogProviderId.Modrinth,
	project: "gvQqBUqZ",
	version: "0.11.2",
	versionId: "ZSNsJrPI",
	title: "Lithium",
	gameVersion: "1.20.1",
	icon: null,
	pageUrl: "https://modrinth.com/mod/lithium",
};

const JEI: SidecarEntry = {
	provider: CatalogProviderId.CurseForge,
	project: "238222",
	version: "15.3.0.4",
	versionId: "4712868",
	title: "Just Enough Items",
	gameVersion: "1.20.1",
	icon: null,
	pageUrl: "https://www.curseforge.com/minecraft/mc-mods/jei",
};

const CREATE: SidecarEntry = {
	provider: CatalogProviderId.CurseForge,
	project: "328085",
	version: "0.5.1.f",
	versionId: "4835191",
	title: "Create",
	gameVersion: "1.20.1",
	icon: null,
	pageUrl: null,
};

const JARS: Record<string, string> = {
	"fabric-api.jar": "b",
	"create.jar": "c",
	"jei.jar": "d",
	"lithium.jar": "e",
	"sodium.jar": "f",
};

const sha1Of = (jar: string) => {
	return (JARS[jar] ?? "0").repeat(40);
};

const sha512Of = (jar: string) => {
	return (JARS[jar] ?? "0").repeat(128);
};

const modrinthFile = (jar: string, project: string, version: string) => {
	return {
		url: `https://cdn.modrinth.com/data/${project}/versions/${version}/${jar}`,
		filename: jar,
		primary: true,
		size: 1000,
		hashes: {
			sha1: sha1Of(jar),
			sha512: sha512Of(jar),
		},
	};
};

const modrinthVersion = (jar: string, project: string, version: string) => {
	return {
		id: version,
		project_id: project,
		version_number: "1",
		version_type: "release",
		date_published: "2026-09-01T00:00:00Z",
		game_versions: [
			"1.20.1",
		],
		loaders: [
			"fabric",
		],
		files: [
			{
				...modrinthFile(`${jar}-sources`, project, version),
				primary: false,
			},
			modrinthFile(jar, project, version),
		],
		dependencies: [],
	};
};

const MODRINTH_MATCHES: Record<string, unknown> = {
	[sha1Of("sodium.jar")]: modrinthVersion("sodium.jar", SODIUM.project, "OihdIimA"),
	[sha1Of("lithium.jar")]: modrinthVersion("lithium.jar", LITHIUM.project, "ZSNsJrPI"),
};

const curseforgeFile = (jar: string, entry: SidecarEntry, downloadUrl: string | null) => {
	return {
		id: Number(entry.versionId),
		modId: Number(entry.project),
		fileName: jar,
		displayName: jar,
		downloadUrl,
		fileLength: 1000,
		fileDate: null,
		isAvailable: true,
		releaseType: 1,
		gameVersions: [],
		hashes: [
			{
				value: sha1Of(jar),
				algo: CurseforgeHash.Sha1,
			},
		],
		dependencies: [],
	};
};

interface ServerOptions {
	variant?: string;
	build?: string;
	mods?: Record<string, SidecarEntry>;
	jars?: string[];
	variables?: Record<string, string>;
	modrinth?: Record<string, unknown>;
	curseforge?: unknown[];
	zipCode?: number;
	decodeCode?: number;
	files?: Record<string, string>;
	address?: string | null;
}

const serverWith = (options: ServerOptions = {}) => {
	const variant = options.variant ?? "forge";
	const files = new Map<string, string>([
		[
			".serverk-install.json",
			JSON.stringify({
				variant,
				version: "1.20.1",
				build: options.build ?? "47.2.0",
				java: 17,
				launch: {
					kind: "jar",
					target: "server.jar",
				},
			}),
		],
		[
			MODS_SIDECAR,
			JSON.stringify(options.mods ?? {}),
		],
		...(options.jars ?? Object.keys(options.mods ?? {})).map(
			(
				jar,
			): [
				string,
				string,
			] => [
				`mods/${jar}`,
				"",
			],
		),
		...Object.entries(options.files ?? {}),
	]);
	const written = new Map<string, string>();
	const decoded = new Map<string, Uint8Array>();
	const ensured: string[] = [];
	const commands: string[][] = [];
	const requests: string[] = [];
	const variables: Record<string, string> = {
		SERVER_TYPE: variant,
		...options.variables,
	};

	const json = async (
		url: string,
		request?: {
			body?: string;
		},
	) => {
		requests.push(url);

		const body = JSON.parse(request?.body ?? "{}") as {
			hashes?: string[];
			fileIds?: number[];
		};

		if (url === MODRINTH_HASHES) {
			const answers = options.modrinth ?? MODRINTH_MATCHES;

			return Object.fromEntries(
				(body.hashes ?? []).flatMap((hash) =>
					hash in answers
						? [
								[
									hash,
									answers[hash],
								],
							]
						: [],
				),
			);
		}

		if (url === CURSEFORGE_FILES) {
			return {
				data: options.curseforge ?? [],
			};
		}

		throw new Error(`no stub for ${url}`);
	};

	const context = {
		server: {
			playerAddress: options.address === undefined ? ADDRESS : options.address,
		},
		variable: (key: string) => variables[key] ?? null,
		secret: (key: string) => (key === "CURSEFORGE_API_KEY" ? "key" : null),
		files: {
			exists: async (path: string) => files.has(path) || ensured.includes(path),
			read: async (path: string) => files.get(path) ?? "",
			write: async (path: string, text: string) => {
				files.set(path, text);
				written.set(path, text);
			},
			list: async (glob: string) => {
				const directory = glob.split("/").slice(0, -1).join("/");

				return [
					...files.keys(),
				]
					.filter((path) => path.startsWith(`${directory}/`) && path.endsWith(".jar"))
					.map((path) => {
						return {
							path,
							name: path.slice(directory.length + 1),
							directory: false,
							sizeBytes: 0,
							modifiedAt: "",
						};
					});
			},
			remove: async (path: string) => {
				for (const key of [
					...files.keys(),
				]) {
					if (key === path || key.startsWith(`${path}/`)) {
						files.delete(key);
					}
				}
			},
			move: async (from: string, to: string) => {
				files.set(to, files.get(from) ?? "");
				files.delete(from);
			},
			ensure: async (...paths: string[]) => {
				ensured.push(...paths);
			},
			digest: async (path: string, algorithm: string) => {
				const jar = path.split("/").at(-1) ?? "";

				return algorithm === "sha1" ? sha1Of(jar) : sha512Of(jar);
			},
			size: async () => 1000,
		},
		exec: async (argv: string[]) => {
			commands.push(argv);

			if (argv.at(2) === CLIENT_PACK_DECODE_SCRIPT) {
				const code = options.decodeCode ?? 0;

				if (code === 0) {
					decoded.set(argv.at(5) ?? "", new Uint8Array(Buffer.from(files.get(argv.at(4) ?? "") ?? "", "base64")));
				}

				return {
					stdout: "",
					stderr: code === 0 ? "" : "no space left on device",
					code,
				};
			}

			const code = options.zipCode ?? 0;

			if (code === 0) {
				files.set(`${CLIENT_PACK_STAGING}/${(argv.at(5) ?? "").replace("../", "")}`, "zip");
			}

			return {
				stdout: "",
				stderr: code === 0 ? "" : "zip error",
				code,
			};
		},
		net: {
			json,
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
	} as unknown as Bridge.Context;

	return {
		context,
		files,
		written,
		decoded,
		ensured,
		commands,
		requests,
	};
};

const build = async (context: Bridge.Context, name = "Friends SMP") => {
	const outcome = await clientPack.add?.(context, name);

	return outcome?.notice ?? null;
};

const refusalOf = async (run: () => Promise<unknown>) => {
	try {
		await run();
	} catch (error) {
		if (error instanceof BridgeUserError) {
			return error.text;
		}

		throw error;
	}

	throw new Error("expected a refusal");
};

const staged = (files: Map<string, string>) => {
	return [
		...files.keys(),
	].filter((path) => path.startsWith(`${CLIENT_PACK_STAGING}/`));
};

const writtenJson = (written: Map<string, string>, name: string) => {
	return JSON.parse(written.get(`${CLIENT_PACK_BUILD}/${name}`) ?? "null");
};

describe("choosing the client pack format", () => {
	it("picks the curseforge zip when every mod came from curseforge", () => {
		expect(
			clientPackFormat([
				JEI,
				CREATE,
			]),
		).toBe(ClientPackFormat.CurseForge);
	});

	it("picks the modrinth pack when every mod came from modrinth", () => {
		expect(
			clientPackFormat([
				SODIUM,
				LITHIUM,
			]),
		).toBe(ClientPackFormat.Modrinth);
	});

	it("picks the modrinth pack for a mix, because the curseforge app reads only curseforge ids", () => {
		expect(
			clientPackFormat([
				JEI,
				SODIUM,
			]),
		).toBe(ClientPackFormat.Modrinth);
	});

	it("picks the modrinth pack when a jar has no catalog record", () => {
		expect(
			clientPackFormat([
				JEI,
				null,
			]),
		).toBe(ClientPackFormat.Modrinth);
	});

	it("picks the modrinth pack when a curseforge mod carries no file id", () => {
		const legacy: SidecarEntry = {
			provider: JEI.provider,
			project: JEI.project,
			version: JEI.version,
			title: JEI.title,
			gameVersion: JEI.gameVersion,
			icon: null,
			pageUrl: null,
		};

		expect(
			clientPackFormat([
				legacy,
				CREATE,
			]),
		).toBe(ClientPackFormat.Modrinth);
	});
});

describe("building a curseforge client pack", () => {
	it("writes the manifest and the mod list, zips them with an empty overrides folder, and needs no network", async () => {
		const { context, files, written, ensured, commands, requests } = serverWith({
			mods: {
				"jei.jar": JEI,
				"create.jar": CREATE,
			},
		});

		const notice = await build(context);

		expect(writtenJson(written, "manifest.json").files).toEqual([
			{
				projectID: 328_085,
				fileID: 4_835_191,
				required: true,
			},
			{
				projectID: 238_222,
				fileID: 4_712_868,
				required: true,
			},
		]);
		expect(writtenJson(written, "manifest.json").name).toBe("Friends SMP");
		expect(written.get(`${CLIENT_PACK_BUILD}/modlist.html`)).toContain(">Just Enough Items</a>");
		expect(ensured).toContain(`${CLIENT_PACK_BUILD}/overrides`);
		expect(commands).toEqual([
			[
				"sh",
				"-c",
				CLIENT_PACK_DECODE_SCRIPT,
				"client-pack",
				`${CLIENT_PACK_STAGING}/servers.dat.b64`,
				CLIENT_PACK_SERVERS_DAT,
			],
			[
				"sh",
				"-c",
				CLIENT_PACK_ZIP_SCRIPT,
				"client-pack",
				CLIENT_PACK_BUILD,
				"../client-pack.zip",
				"manifest.json",
				"modlist.html",
				"overrides",
			],
		]);
		expect(requests).toEqual([]);
		expect(files.has(`${CLIENT_PACK_DIRECTORY}/client-pack.zip`)).toBe(true);
		expect(staged(files)).toEqual([]);
		expect(notice).toEqual({
			ar: "تم تجهيز مودباك CurseForge يضم مودين. نزّله وأرسله للاعبين ليستوردوه في لانشر CurseForge. وسيرفرك مضاف إلى المودباك، فيجده اللاعبون في قائمة السيرفرات.",
			en: "Built a CurseForge pack with 2 mods. Download it and send it to players to import in the CurseForge app. Your server is already in the pack, so players find it in their server list.",
		});
	});

	it("lists the built pack with its download path, and removing it deletes the file", async () => {
		const { context, files } = serverWith({
			mods: {
				"jei.jar": JEI,
			},
		});

		await build(context, "  Friends SMP  ");

		const rows = await clientPack.list(context);

		expect(rows).toHaveLength(1);
		expect(rows.at(0)).toMatchObject({
			id: "client-pack",
			name: "Friends SMP",
			app: {
				ar: "لانشر CurseForge",
				en: "CurseForge app",
			},
			mods: 1,
			path: `${CLIENT_PACK_DIRECTORY}/client-pack.zip`,
		});
		expect(rows.at(0)?.built).toMatch(/^\d{4}-\d{2}-\d{2}$/);

		const row = rows.at(0);

		if (!row) {
			throw new Error("expected a row");
		}

		await clientPack.actions?.remove?.(context, row, {});

		expect(files.has(`${CLIENT_PACK_DIRECTORY}/client-pack.zip`)).toBe(false);
		expect(files.has(CLIENT_PACK_SIDECAR)).toBe(false);
		expect(await clientPack.list(context)).toEqual([]);
	});

	it("leaves out a catalog entry whose jar is no longer in the mods folder", async () => {
		const { context, written } = serverWith({
			mods: {
				"jei.jar": JEI,
				"create.jar": CREATE,
			},
			jars: [
				"jei.jar",
			],
		});

		const notice = await build(context);

		expect(writtenJson(written, "manifest.json").files).toEqual([
			{
				projectID: 238_222,
				fileID: 4_712_868,
				required: true,
			},
		]);
		expect(notice?.en).toStartWith("Built a CurseForge pack with 1 mod.");
	});

	it("names a jar no launcher can download, and leaves a server-only companion unnamed", async () => {
		const { context, written, requests } = serverWith({
			variant: "fabric",
			build: "0.15.3",
			mods: {
				"jei.jar": JEI,
			},
			jars: [
				"jei.jar",
				"custom.jar",
				"geyser-fabric.jar",
			],
		});

		const notice = await build(context);

		expect(writtenJson(written, "manifest.json").files).toHaveLength(1);
		expect(requests).toEqual([
			MODRINTH_HASHES,
		]);
		expect(notice).toEqual({
			ar: "تم تجهيز مودباك CurseForge يضم مودًا واحدًا. نزّله وأرسله للاعبين ليستوردوه في لانشر CurseForge. وسيرفرك مضاف إلى المودباك، فيجده اللاعبون في قائمة السيرفرات. الملف custom.jar ليس في المودباك لأن اللانشر لا يستطيع تنزيله من Modrinth أو CurseForge، فأرسله للاعبين بنفسك.",
			en: "Built a CurseForge pack with 1 mod. Download it and send it to players to import in the CurseForge app. Your server is already in the pack, so players find it in their server list. custom.jar isn't in the pack because a launcher can't download it from Modrinth or CurseForge, so send it to players yourself.",
		});
	});

	it("names only the first few jars left out and counts the rest", async () => {
		const extra = [
			"a.jar",
			"b.jar",
			"c.jar",
			"d.jar",
			"e.jar",
			"f.jar",
			"g.jar",
		];
		const { context } = serverWith({
			mods: {
				"jei.jar": JEI,
			},
			jars: [
				"jei.jar",
				...extra,
			],
		});

		const notice = await build(context);

		expect(notice?.en).toContain("a.jar, b.jar, c.jar, d.jar, e.jar and more (7) aren't in the pack");
		expect(notice?.ar).toContain("الملفات a.jar، b.jar، c.jar، d.jar، e.jar وغيرها (7) ليست في المودباك");
	});

	it("keeps the previous pack when zip fails", async () => {
		const { context, files } = serverWith({
			mods: {
				"jei.jar": JEI,
			},
			zipCode: 12,
			files: {
				[`${CLIENT_PACK_DIRECTORY}/client-pack.zip`]: "previous",
			},
		});

		const refusal = await refusalOf(() => build(context));

		expect(refusal.en).toBe("We couldn't build the pack file. Check disk space and try again.");
		expect(files.get(`${CLIENT_PACK_DIRECTORY}/client-pack.zip`)).toBe("previous");
		expect(staged(files)).toEqual([]);
	});
});

describe("building a modrinth client pack", () => {
	it("hashes each installed jar and takes its address from the modrinth file with the same sha1", async () => {
		const { context, files, written, commands } = serverWith({
			variant: "fabric",
			build: "0.15.3",
			mods: {
				"sodium.jar": SODIUM,
				"lithium.jar": LITHIUM,
			},
		});

		const notice = await build(context);
		const index = writtenJson(written, "modrinth.index.json");

		expect(index.dependencies).toEqual({
			minecraft: "1.20.1",
			"fabric-loader": "0.15.3",
		});
		expect(index.files).toEqual([
			{
				path: "mods/lithium.jar",
				hashes: {
					sha1: sha1Of("lithium.jar"),
					sha512: sha512Of("lithium.jar"),
				},
				env: {
					client: "required",
					server: "required",
				},
				downloads: [
					"https://cdn.modrinth.com/data/gvQqBUqZ/versions/ZSNsJrPI/lithium.jar",
				],
				fileSize: 1000,
			},
			{
				path: "mods/sodium.jar",
				hashes: {
					sha1: sha1Of("sodium.jar"),
					sha512: sha512Of("sodium.jar"),
				},
				env: {
					client: "required",
					server: "required",
				},
				downloads: [
					"https://cdn.modrinth.com/data/AANobbMI/versions/OihdIimA/sodium.jar",
				],
				fileSize: 1000,
			},
		]);
		expect(commands.at(-1)?.slice(5)).toEqual([
			"../client-pack.mrpack",
			"modrinth.index.json",
			"overrides",
		]);
		expect(files.has(`${CLIENT_PACK_DIRECTORY}/client-pack.mrpack`)).toBe(true);
		expect(notice).toEqual({
			ar: "تم تجهيز مودباك Modrinth يضم مودين. نزّله وأرسله للاعبين ليستوردوه في لانشر Modrinth أو Prism. وسيرفرك مضاف إلى المودباك، فيجده اللاعبون في قائمة السيرفرات.",
			en: "Built a Modrinth pack with 2 mods. Download it and send it to players to import in the Modrinth app or Prism. Your server is already in the pack, so players find it in their server list.",
		});
	});

	it("takes a curseforge mod's address from modrinth when modrinth has the same file", async () => {
		const { context, written, requests } = serverWith({
			mods: {
				"sodium.jar": SODIUM,
				"jei.jar": JEI,
			},
			modrinth: {
				...MODRINTH_MATCHES,
				[sha1Of("jei.jar")]: modrinthVersion("jei.jar", "u6dRKJwZ", "jei-version"),
			},
		});

		await build(context);

		expect(writtenJson(written, "modrinth.index.json").files.at(0).downloads).toEqual([
			"https://cdn.modrinth.com/data/u6dRKJwZ/versions/jei-version/jei.jar",
		]);
		expect(requests).toEqual([
			MODRINTH_HASHES,
		]);
	});

	it("includes a jar the catalog did not install when modrinth has the same file", async () => {
		const { context, written } = serverWith({
			variant: "fabric",
			build: "0.15.3",
			mods: {
				"lithium.jar": LITHIUM,
			},
			jars: [
				"lithium.jar",
				"fabric-api.jar",
			],
			modrinth: {
				...MODRINTH_MATCHES,
				[sha1Of("fabric-api.jar")]: modrinthVersion("fabric-api.jar", "P7dR8mSH", "fabric-api-version"),
			},
		});

		const notice = await build(context);

		expect(
			writtenJson(written, "modrinth.index.json").files.map((file: { path: string; downloads: string[] }) => [
				file.path,
				file.downloads.at(0),
			]),
		).toEqual([
			[
				"mods/fabric-api.jar",
				"https://cdn.modrinth.com/data/P7dR8mSH/versions/fabric-api-version/fabric-api.jar",
			],
			[
				"mods/lithium.jar",
				"https://cdn.modrinth.com/data/gvQqBUqZ/versions/ZSNsJrPI/lithium.jar",
			],
		]);
		expect(notice?.en).toBe(
			"Built a Modrinth pack with 2 mods. Download it and send it to players to import in the Modrinth app or Prism. Your server is already in the pack, so players find it in their server list.",
		);
	});

	it("turns a curseforge-only server into a modrinth pack with forgecdn links once crossplay adds fabric api", async () => {
		const { context, written, requests } = serverWith({
			variant: "fabric",
			build: "0.15.3",
			mods: {
				"jei.jar": JEI,
				"create.jar": CREATE,
			},
			jars: [
				"jei.jar",
				"create.jar",
				"fabric-api.jar",
				"geyser-fabric.jar",
			],
			modrinth: {
				[sha1Of("fabric-api.jar")]: modrinthVersion("fabric-api.jar", "P7dR8mSH", "fabric-api-version"),
			},
			curseforge: [
				curseforgeFile("jei.jar", JEI, "https://edge.forgecdn.net/files/4712/868/jei.jar"),
				curseforgeFile("create.jar", CREATE, "https://edge.forgecdn.net/files/4835/191/create.jar"),
			],
		});

		const notice = await build(context);

		expect(
			writtenJson(written, "modrinth.index.json").files.map((file: { path: string; downloads: string[] }) => [
				file.path,
				file.downloads.at(0),
			]),
		).toEqual([
			[
				"mods/create.jar",
				"https://edge.forgecdn.net/files/4835/191/create.jar",
			],
			[
				"mods/fabric-api.jar",
				"https://cdn.modrinth.com/data/P7dR8mSH/versions/fabric-api-version/fabric-api.jar",
			],
			[
				"mods/jei.jar",
				"https://edge.forgecdn.net/files/4712/868/jei.jar",
			],
		]);
		expect(requests).toEqual([
			MODRINTH_HASHES,
			CURSEFORGE_FILES,
		]);
		expect(notice?.en).toBe(
			"Built a Modrinth pack with 3 mods. Download it and send it to players to import in the Modrinth app or Prism. Your server is already in the pack, so players find it in their server list.",
		);
	});

	it("names a catalog jar modrinth no longer recognizes and builds the rest", async () => {
		const { context, written } = serverWith({
			variant: "fabric",
			build: "0.15.3",
			mods: {
				"sodium.jar": SODIUM,
				"lithium.jar": LITHIUM,
			},
			modrinth: {
				[sha1Of("lithium.jar")]: MODRINTH_MATCHES[sha1Of("lithium.jar")],
			},
		});

		const notice = await build(context);

		expect(writtenJson(written, "modrinth.index.json").files).toHaveLength(1);
		expect(notice?.en).toBe(
			"Built a Modrinth pack with 1 mod. Download it and send it to players to import in the Modrinth app or Prism. Your server is already in the pack, so players find it in their server list. sodium.jar isn't in the pack because a launcher can't download it from Modrinth or CurseForge, so send it to players yourself.",
		);
	});

	it("falls back to the curseforge download address when modrinth lacks the file", async () => {
		const { context, written, requests } = serverWith({
			mods: {
				"sodium.jar": SODIUM,
				"jei.jar": JEI,
			},
			curseforge: [
				curseforgeFile("jei.jar", JEI, "https://edge.forgecdn.net/files/4712/868/jei.jar"),
			],
		});

		await build(context);

		expect(writtenJson(written, "modrinth.index.json").files.at(0).downloads).toEqual([
			"https://edge.forgecdn.net/files/4712/868/jei.jar",
		]);
		expect(requests).toEqual([
			MODRINTH_HASHES,
			CURSEFORGE_FILES,
		]);
	});

	it("refuses the whole pack when a curseforge author allows downloads only from curseforge, naming the mod", async () => {
		const { context, files } = serverWith({
			mods: {
				"sodium.jar": SODIUM,
				"jei.jar": JEI,
			},
			curseforge: [
				curseforgeFile("jei.jar", JEI, null),
			],
		});

		const refusal = await refusalOf(() => build(context));

		expect(refusal).toEqual({
			ar: "صاحب مود Just Enough Items لا يسمح بتنزيله إلا من CurseForge، ولذلك لا يمكن وضعه في مودباك Modrinth. احذفه أو استبدله بمود من Modrinth، ثم جرب مرة ثانية.",
			en: "The author of Just Enough Items allows downloads only from CurseForge, so it can't go in a Modrinth pack. Remove it or replace it with a mod from Modrinth, then try again.",
		});
		expect(files.has(`${CLIENT_PACK_DIRECTORY}/client-pack.mrpack`)).toBe(false);
	});

	it("refuses a curseforge jar that differs from its curseforge copy, because the player's launcher would reject it", async () => {
		const { context } = serverWith({
			mods: {
				"sodium.jar": SODIUM,
				"jei.jar": JEI,
			},
			curseforge: [
				{
					...curseforgeFile("jei.jar", JEI, "https://edge.forgecdn.net/files/4712/868/jei.jar"),
					hashes: [
						{
							value: "9".repeat(40),
							algo: CurseforgeHash.Sha1,
						},
					],
				},
			],
		});

		const refusal = await refusalOf(() => build(context));

		expect(refusal.en).toBe(
			"We couldn't match the Just Enough Items file in the mods folder with its copy in the catalog, so players' launchers would reject it. Install it again from the catalog, then try again.",
		);
	});
});

describe("putting the server in the players' server list", () => {
	it("writes the server into the zipped overrides/servers.dat under the pack name, with arabic intact", async () => {
		const { context, decoded, commands } = serverWith({
			mods: {
				"jei.jar": JEI,
			},
		});

		await build(context, "سيرفر الأصحاب");

		const parsed = await parseLevel(decoded.get(CLIENT_PACK_SERVERS_DAT) ?? new Uint8Array());

		expect(parsed === null ? null : simplify(parsed)).toEqual({
			servers: [
				{
					name: "سيرفر الأصحاب",
					ip: ADDRESS,
				},
			],
		});
		expect(commands.at(-1)?.slice(6)).toEqual([
			"manifest.json",
			"modlist.html",
			"overrides",
		]);
	});

	it("puts the server in a modrinth pack as well", async () => {
		const { context, decoded, commands } = serverWith({
			variant: "fabric",
			build: "0.15.3",
			mods: {
				"sodium.jar": SODIUM,
			},
			address: "203.0.113.7:25570",
		});

		await build(context);

		const parsed = await parseLevel(decoded.get(CLIENT_PACK_SERVERS_DAT) ?? new Uint8Array());

		expect(parsed === null ? null : simplify(parsed)).toEqual({
			servers: [
				{
					name: "Friends SMP",
					ip: "203.0.113.7:25570",
				},
			],
		});
		expect(commands.at(-1)?.slice(5)).toEqual([
			"../client-pack.mrpack",
			"modrinth.index.json",
			"overrides",
		]);
	});

	it("refuses and keeps the previous pack when servers.dat can't be written", async () => {
		const { context, files, commands } = serverWith({
			mods: {
				"jei.jar": JEI,
			},
			decodeCode: 1,
			files: {
				[`${CLIENT_PACK_DIRECTORY}/client-pack.zip`]: "previous",
			},
		});

		const refusal = await refusalOf(() => build(context));

		expect(refusal.en).toBe("We couldn't build the pack file. Check disk space and try again.");
		expect(commands).toHaveLength(1);
		expect(files.get(`${CLIENT_PACK_DIRECTORY}/client-pack.zip`)).toBe("previous");
		expect(staged(files)).toEqual([]);
	});

	it("writes no servers.dat while the server has no address, and says so", async () => {
		const { context, decoded, commands } = serverWith({
			mods: {
				"jei.jar": JEI,
			},
			address: null,
		});

		const notice = await build(context);

		expect(decoded.size).toBe(0);
		expect(commands.map((argv) => argv.at(2))).toEqual([
			CLIENT_PACK_ZIP_SCRIPT,
		]);
		expect(notice).toEqual({
			ar: "تم تجهيز مودباك CurseForge يضم مودًا واحدًا. نزّله وأرسله للاعبين ليستوردوه في لانشر CurseForge. لا يوجد لسيرفرك عنوان بعد، ولذلك لا يضيفه المودباك إلى قائمة السيرفرات عند اللاعبين.",
			en: "Built a CurseForge pack with 1 mod. Download it and send it to players to import in the CurseForge app. Your server has no address yet, so the pack doesn't add it to the players' server list.",
		});
	});
});

describe("when no client pack can be built", () => {
	it("refuses while a modpack is applied and lists no pack, because that modpack is the one players need", async () => {
		const { context } = serverWith({
			mods: {
				"jei.jar": JEI,
			},
			variables: {
				[MODPACK_VARIABLE]: "modrinth:abc",
			},
			files: {
				[CLIENT_PACK_SIDECAR]: JSON.stringify({
					name: "Old",
					format: "curseforge",
					mods: 1,
					builtAt: "2026-10-01T00:00:00.000Z",
				}),
				[`${CLIENT_PACK_DIRECTORY}/client-pack.zip`]: "old",
			},
		});

		const refusal = await refusalOf(() => build(context));

		expect(refusal.en).toBe(
			"Your server runs a modpack, and players need that same modpack. Its name is in the Version tab, so send it to them to install in their launcher.",
		);
		expect(await clientPack.list(context)).toEqual([]);
	});

	it("refuses a paper server, which runs no mods", async () => {
		const { context } = serverWith({
			variant: "paper",
			build: "196",
			mods: {
				"jei.jar": JEI,
			},
		});

		const refusal = await refusalOf(() => build(context));

		expect(refusal.en).toBe(
			"A Paper server runs no mods, so we can't build a modpack from it. Modpacks are for Fabric, Forge and NeoForge servers.",
		);
		expect(await clientPack.list(context)).toEqual([]);
	});

	it("refuses when no jar in the mods folder can be downloaded by a launcher", async () => {
		const { context } = serverWith({
			variant: "fabric",
			build: "0.15.3",
			mods: {
				"sodium.jar": SODIUM,
			},
			jars: [
				"sodium.jar",
				"custom.jar",
			],
			modrinth: {},
		});

		const refusal = await refusalOf(() => build(context));

		expect(refusal).toEqual({
			ar: "لا توجد في مجلد mods مودات يستطيع اللانشر تنزيلها من Modrinth أو CurseForge، ولذلك لا يوجد ما نضعه في المودباك. ثبّت مودات من تبويب المودات، ثم جرب مرة ثانية.",
			en: "The mods folder has no mods a launcher can download from Modrinth or CurseForge, so there's nothing to put in the pack. Install mods from the Mods tab, then try again.",
		});
	});

	it("refuses an empty mods folder without asking modrinth, and lists no pack", async () => {
		const { context, requests } = serverWith({
			variant: "fabric",
			build: "0.15.3",
			jars: [
				"geyser-fabric.jar",
			],
			files: {
				[CLIENT_PACK_SIDECAR]: JSON.stringify({
					name: "Old",
					format: "modrinth",
					mods: 1,
					builtAt: "2026-10-01T00:00:00.000Z",
				}),
				[`${CLIENT_PACK_DIRECTORY}/client-pack.mrpack`]: "old",
			},
		});

		const refusal = await refusalOf(() => build(context));

		expect(refusal.en).toStartWith("The mods folder has no mods a launcher can download");
		expect(requests).toEqual([]);
		expect(await clientPack.list(context)).toEqual([]);
	});

	it("refuses an empty or overlong pack name", () => {
		expect(() => clientPackName("   ")).toThrow(BridgeUserError);
		expect(() => clientPackName("x".repeat(65))).toThrow(BridgeUserError);
		expect(clientPackName(" Friends SMP ")).toBe("Friends SMP");
	});
});

describe("counting mods in arabic", () => {
	it("agrees the noun with the number", () => {
		expect(
			[
				1,
				2,
				3,
				10,
				11,
				99,
				100,
				103,
				112,
			].map((count) => modCountText(count).ar),
		).toEqual([
			"مودًا واحدًا",
			"مودين",
			"3 مودات",
			"10 مودات",
			"11 مودًا",
			"99 مودًا",
			"100 مود",
			"103 مودات",
			"112 مودًا",
		]);
	});
});
