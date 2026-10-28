import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { ServerVariant } from "../shared";
import { memoryContext } from "../testing";
import {
	CROSSPLAY,
	GEYSER_PLUGIN_CONFIG,
	VERSION_COMPAT,
	VOICE_CHAT,
	VOICE_CHAT_MOD_CONFIG,
	VOICE_CHAT_PLUGIN_CONFIG,
	VOICE_CHAT_PROJECT,
	VOICE_PORT,
	WEBRTC_PORT,
} from "./companion";
import { CompanionReadiness, companionReadiness, pinCompanionConfigs, syncCompanions } from "./companions";

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

const readinessOf = async (net: Record<string, unknown>, variant: ServerVariant, feature = CROSSPLAY) => {
	const downloads: string[] = [];
	const warnings: string[] = [];

	const context = {
		variable: () => null,
		secret: () => null,
		files: {
			list: async () => [],
			download: async (path: string) => {
				downloads.push(path);
			},
		},
		net: {
			json: async (url: string) => {
				if (!(url in net)) {
					throw new Error(`offline: ${url}`);
				}

				return net[url];
			},
		},
		log: Object.assign(() => {}, {
			warn: (message: string) => {
				warnings.push(message);
			},
		}),
	} as unknown as Bridge.Context;

	const readiness = await companionReadiness(context, feature, variant, "1.21.9");

	return {
		downloads,
		readiness,
		warnings,
	};
};

const FABRIC_BUILDS = {
	[versionsUrlOf("geyser", "fabric", "1.21.9")]: releaseOf("geyser"),
	[versionsUrlOf("floodgate", "fabric", "1.21.9")]: releaseOf("floodgate"),
	[versionsUrlOf("P7dR8mSH", "fabric", "1.21.9")]: releaseOf("fabric-api"),
};

describe("companionReadiness", () => {
	it("is ready when every companion and its library has a build, and downloads nothing", async () => {
		const { downloads, readiness } = await readinessOf(FABRIC_BUILDS, ServerVariant.Fabric);

		expect(readiness).toBe(CompanionReadiness.Ready);
		expect(downloads).toEqual([]);
	});

	it("is unresolved on release day, before Geyser publishes a build, and warns no one", async () => {
		const { readiness, warnings } = await readinessOf(
			{
				...FABRIC_BUILDS,
				[versionsUrlOf("geyser", "fabric", "1.21.9")]: [],
			},
			ServerVariant.Fabric,
		);

		expect(readiness).toBe(CompanionReadiness.Unresolved);
		expect(warnings).toEqual([]);
	});

	it("is unsupported on a server type the feature does not run on", async () => {
		expect((await readinessOf({}, ServerVariant.Forge)).readiness).toBe(CompanionReadiness.Unsupported);

		expect((await readinessOf({}, ServerVariant.Fabric, VERSION_COMPAT)).readiness).toBe(
			CompanionReadiness.Unsupported,
		);
	});

	it("is unknown when the catalogue cannot be reached", async () => {
		expect((await readinessOf({}, ServerVariant.Fabric)).readiness).toBe(CompanionReadiness.Unknown);
	});
});

const VOICE_HOST_PORT = 26_342;

const stampOf = (variant: ServerVariant) => {
	return JSON.stringify({
		variant,
		version: "26.3",
		build: null,
		java: 25,
		launch: {
			kind: "jar",
			target: "server.jar",
		},
	});
};

const voiceChatServerOf = (variant: ServerVariant, enabled: boolean, files: Record<string, string> = {}) => {
	const loader = variant === ServerVariant.Purpur ? "paper" : variant;
	const builds: Record<string, unknown> = {
		[versionsUrlOf(VOICE_CHAT_PROJECT, loader, "26.3")]: releaseOf(VOICE_CHAT_PROJECT),
	};

	return memoryContext({
		files: {
			".serverk-install.json": stampOf(variant),
			...files,
		},
		variables: {
			SERVER_TYPE: variant,
			...(enabled
				? {
						[VOICE_CHAT.variable]: "true",
					}
				: {}),
		},
		ports: enabled
			? {
					[VOICE_PORT]: VOICE_HOST_PORT,
				}
			: {},
		json: (url) => {
			if (!(url in builds)) {
				throw new Error(`offline: ${url}`);
			}

			return builds[url];
		},
	});
};

describe("syncCompanions", () => {
	it("installs the voice chat plugin on paper and points it at the allocated voice port with no host of its own", async () => {
		const server = voiceChatServerOf(ServerVariant.Paper, true);

		await syncCompanions(server.context);

		expect(server.files.has("plugins/voicechat-bukkit.jar")).toBe(true);
		expect(server.downloads).toEqual([
			`https://cdn.modrinth.com/data/${VOICE_CHAT_PROJECT}/${VOICE_CHAT_PROJECT}.jar`,
		]);
		expect(server.merges).toEqual([
			{
				path: VOICE_CHAT_PLUGIN_CONFIG,
				values: {
					port: VOICE_HOST_PORT,
					voice_host: "",
				},
			},
		]);
	});

	it("creates the voice chat config when the mod has not written one yet", async () => {
		const server = voiceChatServerOf(ServerVariant.Paper, true);

		await syncCompanions(server.context);

		expect(server.files.get(VOICE_CHAT_PLUGIN_CONFIG)).toBe(`port=${VOICE_HOST_PORT}\nvoice_host=\n`);
	});

	it("writes the voice port into the mod config folder on fabric, forge and neoforge", async () => {
		for (const variant of [
			ServerVariant.Fabric,
			ServerVariant.Forge,
			ServerVariant.NeoForge,
		]) {
			const server = voiceChatServerOf(variant, true);

			await syncCompanions(server.context);

			expect(server.files.has(`mods/voicechat-${variant}.jar`)).toBe(true);
			expect(server.merges.map((merge) => merge.path)).toEqual([
				VOICE_CHAT_MOD_CONFIG,
			]);
		}
	});

	it("takes the voice port back from a config the customer or the mod changed, and keeps every other line", async () => {
		const server = voiceChatServerOf(ServerVariant.Paper, true, {
			[VOICE_CHAT_PLUGIN_CONFIG]: "port=24454\nvoice_host=example.com\nmax_voice_distance=64.0\n",
		});

		await syncCompanions(server.context);

		expect(server.files.get(VOICE_CHAT_PLUGIN_CONFIG)).toBe(
			`port=${VOICE_HOST_PORT}\nvoice_host=\nmax_voice_distance=64.0\n`,
		);
	});

	it("leaves a config that already carries the voice port untouched", async () => {
		const server = voiceChatServerOf(ServerVariant.Paper, true, {
			[VOICE_CHAT_PLUGIN_CONFIG]: `port=${VOICE_HOST_PORT}\nvoice_host=\n`,
		});

		await syncCompanions(server.context);

		expect(server.merges).toEqual([]);
	});

	it("parks the voice chat jar and reads no voice port once voice chat is off", async () => {
		const server = voiceChatServerOf(ServerVariant.Paper, false, {
			"plugins/voicechat-bukkit.jar": "",
		});

		await syncCompanions(server.context);

		expect(server.files.has("plugins/voicechat-bukkit.jar")).toBe(false);
		expect(server.files.has("plugins/voicechat-bukkit.jar.disabled")).toBe(true);
		expect(server.merges).toEqual([]);
	});

	it("removes a voice chat jar the customer installed by hand, so only one copy loads", async () => {
		const server = voiceChatServerOf(ServerVariant.Paper, true, {
			"plugins/voicechat-bukkit-2.6.20.jar": "",
			"plugins/voicechat-interaction-1.0.3.jar": "",
		});

		await syncCompanions(server.context);

		expect(
			[
				...server.files.keys(),
			]
				.filter((path) => path.startsWith("plugins/"))
				.sort(),
		).toEqual([
			"plugins/voicechat-bukkit.jar",
			"plugins/voicechat-interaction-1.0.3.jar",
			VOICE_CHAT_PLUGIN_CONFIG,
		]);
	});

	it("parks the jar and writes no config when the mod has no build for the server's version", async () => {
		const server = memoryContext({
			files: {
				".serverk-install.json": stampOf(ServerVariant.Paper),
				"plugins/voicechat-bukkit.jar": "",
			},
			variables: {
				SERVER_TYPE: ServerVariant.Paper,
				[VOICE_CHAT.variable]: "true",
			},
			ports: {
				[VOICE_PORT]: VOICE_HOST_PORT,
			},
			json: () => [],
		});

		await syncCompanions(server.context);

		expect(server.files.has("plugins/voicechat-bukkit.jar.disabled")).toBe(true);
		expect(server.merges).toEqual([]);
	});
});

const WEBRTC_HOST_PORT = 26_217;

const PUBLIC_ADDRESS = "203.0.113.5";

const GEYSER_CONFIG = [
	"bedrock:",
	"  # The IP address that Geyser will bind on to listen for incoming Bedrock connections.",
	'  address: "127.0.0.1"',
	"",
	"  port: 19132",
	"",
	'  # The UDP port used for NetherNet connections. When set to 0, Geyser uses the "port" value set above.',
	"  webrtc-port: 0",
	"",
	"  # How Bedrock players can connect. Changes require a restart.",
	"  transport: raknet",
	"",
	"  clone-remote-port: false",
	"",
	"  signaling:",
	"    mode: builtin",
	"",
	"    # Leave empty to use this machine's own addresses, plus the public address found with stun-discovery.",
	"    advertise-addresses: []",
	"",
	"    stun-discovery: true",
	"",
	"java:",
	'  auth-type: "floodgate"',
	"",
	"motd:",
	"  primary-motd: Geyser",
	"",
].join("\n");

const NETHERNET_GEYSER_CONFIG = (advertised: string) => {
	return GEYSER_CONFIG.replace('address: "127.0.0.1"', 'address: "0.0.0.0"')
		.replace("webrtc-port: 0", `webrtc-port: ${WEBRTC_HOST_PORT}`)
		.replace("transport: raknet", 'transport: "both"')
		.replace("advertise-addresses: []", `advertise-addresses: ${advertised}`);
};

const crossplayServerOf = (variant: ServerVariant, configPath: string, publicAddress: string | null) => {
	return memoryContext({
		files: {
			[configPath]: GEYSER_CONFIG,
			"config/paper-global.yml": "unsupported-settings:\n  perform-username-validation: false\n",
			"plugins/floodgate/config.yml": 'username-prefix: "."\nreplace-spaces: true\n',
			"config/floodgate/config.yml": 'username-prefix: "."\nreplace-spaces: true\n',
		},
		variables: {
			SERVER_TYPE: variant,
			[CROSSPLAY.variable]: "true",
		},
		ports: {
			bedrock: 19_132,
			[WEBRTC_PORT]: WEBRTC_HOST_PORT,
		},
		publicAddress,
	});
};

const GEYSER_CONFIGS = [
	{
		variant: ServerVariant.Paper,
		path: GEYSER_PLUGIN_CONFIG,
	},
	{
		variant: ServerVariant.Purpur,
		path: GEYSER_PLUGIN_CONFIG,
	},
	{
		variant: ServerVariant.Fabric,
		path: "config/Geyser-Fabric/config.yml",
	},
	{
		variant: ServerVariant.NeoForge,
		path: "config/Geyser-NeoForge/config.yml",
	},
];

describe("pinCompanionConfigs", () => {
	for (const item of GEYSER_CONFIGS) {
		it(`turns NetherNet on beside RakNet on ${item.variant}, on the allocated port and the machine's address`, async () => {
			const server = crossplayServerOf(item.variant, item.path, PUBLIC_ADDRESS);

			await pinCompanionConfigs(server.context);

			expect(server.files.get(item.path)).toBe(NETHERNET_GEYSER_CONFIG(`["${PUBLIC_ADDRESS}"]`));
		});
	}

	it("leaves the advertised addresses to Geyser when the machine has no public ipv4 address", async () => {
		const server = crossplayServerOf(ServerVariant.Paper, GEYSER_PLUGIN_CONFIG, "127.0.0.1");

		await pinCompanionConfigs(server.context);

		expect(server.files.get(GEYSER_PLUGIN_CONFIG)).toBe(NETHERNET_GEYSER_CONFIG("[]"));
	});

	it("reads no NetherNet port and writes nothing once crossplay is off", async () => {
		const server = memoryContext({
			files: {
				[GEYSER_PLUGIN_CONFIG]: GEYSER_CONFIG,
			},
			variables: {
				SERVER_TYPE: ServerVariant.Paper,
			},
		});

		await pinCompanionConfigs(server.context);

		expect(server.files.get(GEYSER_PLUGIN_CONFIG)).toBe(GEYSER_CONFIG);
	});
});
