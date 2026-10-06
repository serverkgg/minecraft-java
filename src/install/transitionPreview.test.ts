import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeConfirm, BridgeNetError } from "@serverkgg/bridge";
import { transitionPreview } from "./transitionPreview";

const FORGE_STAMP = {
	variant: "forge",
	version: "1.20.1",
	build: "47.4.0",
	java: 17,
	launch: {
		kind: "args",
		target: "libraries/net/minecraftforge/forge/1.20.1-47.4.0/unix_args.txt",
	},
	rconPassword: null,
	rconPasswordNext: null,
};

const logged: string[] = [];

const previewOf = async (
	variables: Record<string, string>,
	net: Record<string, unknown>,
	stamp: object = FORGE_STAMP,
) => {
	const files = new Map<string, string>([
		[
			".serverk-install.json",
			JSON.stringify(stamp),
		],
	]);

	const answer = (url: string) => {
		const value = net[url];

		if (value === undefined) {
			throw new Error(`offline: ${url}`);
		}

		if (value instanceof Error) {
			throw value;
		}

		return value;
	};

	const context = {
		variable: (key: string) => variables[key] ?? null,
		secret: () => null,
		files: {
			exists: async (path: string) => files.has(path),
			read: async (path: string) => files.get(path) ?? "",
			list: async () => [],
		},
		net: {
			json: async (url: string) => answer(url),
			text: async (url: string) => answer(url),
		},
		log: Object.assign(
			(message: string) => {
				logged.push(message);
			},
			{
				warn: (message: string) => {
					logged.push(message);
				},
			},
		),
	} as unknown as Bridge.Context;

	return await transitionPreview.preview(context, variables);
};

describe("transitionPreview", () => {
	describe("previewing a change to a version the server type has no stable build for", () => {
		it("says so before the customer submits, and asks for the strongest confirmation", async () => {
			const preview = await previewOf(
				{
					SERVER_TYPE: "paper",
					MC_VERSION: "26.3",
				},
				{
					"https://fill.papermc.io/v3/projects/paper/versions/26.3/builds": [
						{
							id: 157,
							channel: "BETA",
							downloads: {},
						},
					],
				},
			);

			expect(preview).toEqual({
				confirm: BridgeConfirm.Normal,
				lines: [
					{
						ar: "لا يتوفر إصدار مستقر من Paper لـ ماينكرافت 26.3 حتى الآن. اختر إصدارًا آخر أو نوع سيرفر آخر.",
						en: "Paper has no stable build for Minecraft 26.3 yet. Pick another version or server type.",
					},
				],
				blocked: true,
			});
		});
	});

	describe("previewing the install the server already has", () => {
		it("asks nothing of the build catalogue and says nothing changes", async () => {
			const preview = await previewOf(
				{
					SERVER_TYPE: "forge",
					MC_VERSION: "1.20.1",
					LOADER_VERSION: "47.4.0",
				},
				{},
			);

			expect(preview.confirm).toBe(BridgeConfirm.Normal);

			expect(preview.lines.at(0)?.en).toBe(
				"Your server is already on Forge 1.20.1, so nothing changes beyond a restart.",
			);
		});
	});

	const FABRIC_STAMP = {
		variant: "fabric",
		version: "1.21.8",
		build: "0.17.2",
		java: 21,
		launch: {
			kind: "jar",
			target: "fabric-server-launch.jar",
		},
		rconPassword: null,
		rconPasswordNext: null,
	};

	const PAPER_STAMP = {
		...FABRIC_STAMP,
		variant: "paper",
		build: "60",
		launch: {
			kind: "jar",
			target: "paper.jar",
		},
	};

	const MANIFEST = {
		"https://piston-meta.mojang.com/mc/game/version_manifest_v2.json": {
			latest: {
				release: "1.21.9",
			},
			versions: [
				{
					id: "1.21.9",
					type: "release",
					url: "https://piston-meta.mojang.com/1.21.9.json",
				},
				{
					id: "1.21.8",
					type: "release",
					url: "https://piston-meta.mojang.com/1.21.8.json",
				},
			],
		},
		"https://meta.fabricmc.net/v2/versions/game": [
			{
				version: "1.21.9",
				stable: true,
			},
		],
	};

	const versionsUrlOf = (project: string, loader: string, gameVersion: string) => {
		const url = new URL(`https://api.modrinth.com/v2/project/${project}/version`);

		url.searchParams.set(
			"loaders",
			JSON.stringify([
				loader,
			]),
		);
		url.searchParams.set(
			"game_versions",
			JSON.stringify([
				gameVersion,
			]),
		);

		return url.toString();
	};

	const releaseOf = (project: string) => {
		return [
			{
				id: `${project}-id`,
				project_id: project,
				version_number: "1.0.0",
				version_type: "release",
				date_published: "2026-10-01T00:00:00Z",
				game_versions: [
					"1.21.9",
				],
				loaders: [
					"fabric",
				],
				files: [
					{
						url: `https://cdn.modrinth.com/data/${project}/${project}.jar`,
						filename: `${project}.jar`,
						primary: true,
						size: 1024,
						hashes: {},
					},
				],
				dependencies: [],
			},
		];
	};

	const FABRIC_TO_1_21_9 = {
		SERVER_TYPE: "fabric",
		MC_VERSION: "1.21.9",
		LOADER_VERSION: "0.17.2",
	};

	const CROSSPLAY_PAUSED = {
		ar: "لن يعمل الكروس بلاي على Fabric 1.21.9 حتى يدعمه Geyser. يبقى مفعّلًا ويعود تلقائيًا عندما يتوفر.",
		en: "Crossplay won't work on Fabric 1.21.9 until Geyser supports it. It stays on and comes back on its own once it does.",
	};

	describe("previewing a version the crossplay companions have not caught up with", () => {
		it("adds one line saying crossplay waits for Geyser, and keeps the confirmation level", async () => {
			const net = {
				...MANIFEST,
				[versionsUrlOf("geyser", "fabric", "1.21.9")]: [],
			};

			const without = await previewOf(FABRIC_TO_1_21_9, net, FABRIC_STAMP);

			const preview = await previewOf(
				{
					...FABRIC_TO_1_21_9,
					CROSSPLAY: "true",
				},
				net,
				FABRIC_STAMP,
			);

			expect(preview).toEqual({
				confirm: without.confirm,
				lines: [
					...without.lines,
					CROSSPLAY_PAUSED,
				],
			});
		});

		it("writes nothing to the server log while it checks the companions", async () => {
			logged.length = 0;

			await previewOf(
				{
					...FABRIC_TO_1_21_9,
					CROSSPLAY: "true",
				},
				{
					...MANIFEST,
					[versionsUrlOf("geyser", "fabric", "1.21.9")]: [],
				},
				FABRIC_STAMP,
			);

			expect(logged).toEqual([]);
		});

		it("adds nothing once Geyser, Floodgate and Fabric API have a build for the version", async () => {
			const preview = await previewOf(
				{
					...FABRIC_TO_1_21_9,
					CROSSPLAY: "true",
				},
				{
					...MANIFEST,
					[versionsUrlOf("geyser", "fabric", "1.21.9")]: releaseOf("geyser"),
					[versionsUrlOf("floodgate", "fabric", "1.21.9")]: releaseOf("floodgate"),
					[versionsUrlOf("P7dR8mSH", "fabric", "1.21.9")]: releaseOf("fabric-api"),
				},
				FABRIC_STAMP,
			);

			expect(preview.lines).not.toContainEqual(CROSSPLAY_PAUSED);
		});

		it("claims nothing when the catalogue cannot be reached", async () => {
			const preview = await previewOf(
				{
					...FABRIC_TO_1_21_9,
					CROSSPLAY: "true",
				},
				MANIFEST,
				FABRIC_STAMP,
			);

			expect(preview.lines).not.toContainEqual(CROSSPLAY_PAUSED);
		});
	});

	describe("previewing a move to a server type the companions do not run on", () => {
		it("says crossplay and version compatibility stay on and return on a type that runs them", async () => {
			const preview = await previewOf(
				{
					SERVER_TYPE: "forge",
					MC_VERSION: "1.21.8",
					LOADER_VERSION: "58.1.0",
					CROSSPLAY: "true",
					VERSION_COMPAT: "true",
				},
				MANIFEST,
				PAPER_STAMP,
			);

			expect(preview.lines.slice(-2)).toEqual([
				{
					ar: "لا يعمل الكروس بلاي على Forge. يبقى مفعّلًا ويعود تلقائيًا عند العودة إلى Paper أو Purpur أو Fabric أو NeoForge.",
					en: "Crossplay doesn't run on Forge. It stays on and comes back on its own when you switch back to Paper, Purpur, Fabric or NeoForge.",
				},
				{
					ar: "لا يعمل توافق الإصدارات على Forge. يبقى مفعّلًا ويعود تلقائيًا عند العودة إلى Paper أو Purpur.",
					en: "Version compatibility doesn't run on Forge. It stays on and comes back on its own when you switch back to Paper or Purpur.",
				},
			]);
		});

		it("says nothing about a feature that is off", async () => {
			const preview = await previewOf(
				{
					SERVER_TYPE: "forge",
					MC_VERSION: "1.21.8",
					LOADER_VERSION: "58.1.0",
				},
				MANIFEST,
				PAPER_STAMP,
			);

			expect(preview.lines.some((line) => line.en.includes("comes back on its own"))).toBe(false);
		});
	});

	describe("when the catalogue fails or the build belongs to another loader", () => {
		it("does not call an outage a missing stable build", async () => {
			const preview = await previewOf(
				{
					SERVER_TYPE: "paper",
					MC_VERSION: "1.21.8",
				},
				{
					...MANIFEST,
					"https://fill.papermc.io/v3/projects/paper/versions/1.21.8/builds": new BridgeNetError(
						503,
						"fill.papermc.io answered 503",
					),
				},
				FABRIC_STAMP,
			);

			expect(preview.lines.some((line) => line.en.includes("has no stable build"))).toBe(false);
		});

		it("refuses a requested build the loader no longer publishes, and writes nothing to the log", async () => {
			logged.length = 0;

			const preview = await previewOf(
				{
					SERVER_TYPE: "paper",
					MC_VERSION: "1.21.8",
					LOADER_VERSION: "0.17.2",
				},
				{
					...MANIFEST,
					"https://fill.papermc.io/v3/projects/paper/versions/1.21.8/builds": [
						{
							id: 60,
							channel: "STABLE",
							downloads: {},
						},
					],
				},
				FABRIC_STAMP,
			);

			expect(preview).toEqual({
				confirm: BridgeConfirm.Normal,
				lines: [
					{
						ar: "الإصدار 0.17.2 من Paper لم يعد منشورًا. اختر إصدارًا آخر من المشغّل.",
						en: "Paper build 0.17.2 is no longer published. Pick another loader build.",
					},
				],
				blocked: true,
			});
			expect(logged).toEqual([]);
		});
	});
});
