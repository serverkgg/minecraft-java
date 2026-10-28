import type { Bridge } from "@serverkgg/bridge";
import { ServerVariant, variantOf } from "../shared";
import type { YamlEntry } from "./yamlConfig";

export enum CompanionId {
	Floodgate = "floodgate",
	Geyser = "geyser",
	ViaBackwards = "viabackwards",
	ViaVersion = "viaversion",
	VoiceChat = "voicechat",
}

export enum CompanionSource {
	GeyserMc = "geysermc",
	Modrinth = "modrinth",
}

export interface CompanionFeature {
	id: string;
	variable: string;
	switchLabel: Bridge.Text;
	variants: ServerVariant[];
}

export interface CompanionDownload {
	project: string;
	artifact: string;
}

export interface CompanionRequirement {
	id: string;
	title: string;
	filename: string;
	project: string;
	loader: string;
	files: RegExp;
}

export interface CompanionModrinth {
	project: string;
	loader: string;
	matchGameVersion: boolean;
}

export enum CompanionConfigFormat {
	Properties = "properties",
	Yaml = "yaml",
}

export interface CompanionYamlConfig {
	format: CompanionConfigFormat.Yaml;
	path: string;
	entries(context: Bridge.Context): YamlEntry[];
}

export interface CompanionPropertiesConfig {
	format: CompanionConfigFormat.Properties;
	path: string;
	values(context: Bridge.Context): Bridge.Values;
}

export type CompanionConfig = CompanionYamlConfig | CompanionPropertiesConfig;

export interface CompanionArtifact {
	filename: string;
	configs: CompanionConfig[];
	download: CompanionDownload | null;
	modrinth: CompanionModrinth | null;
	requires: CompanionRequirement[];
}

export interface Companion {
	id: CompanionId;
	title: string;
	feature: CompanionFeature;
	projects: string[];
	files: RegExp;
	artifacts: Partial<Record<ServerVariant, CompanionArtifact>>;
}

export const CROSSPLAY: CompanionFeature = {
	id: "crossplay",
	variable: "CROSSPLAY",
	switchLabel: {
		ar: "كروس بلاي",
		en: "crossplay",
	},
	variants: [
		ServerVariant.Paper,
		ServerVariant.Purpur,
		ServerVariant.Fabric,
		ServerVariant.NeoForge,
	],
};

export const VERSION_COMPAT: CompanionFeature = {
	id: "version-compat",
	variable: "VERSION_COMPAT",
	switchLabel: {
		ar: "توافق الإصدارات",
		en: "version compatibility",
	},
	variants: [
		ServerVariant.Paper,
		ServerVariant.Purpur,
	],
};

export const VOICE_CHAT: CompanionFeature = {
	id: "voice-chat",
	variable: "VOICE_CHAT",
	switchLabel: {
		ar: "الشات الصوتي",
		en: "voice chat",
	},
	variants: [
		ServerVariant.Paper,
		ServerVariant.Purpur,
		ServerVariant.Fabric,
		ServerVariant.Forge,
		ServerVariant.NeoForge,
	],
};

export const VOICE_PORT = "voice";

export const VOICE_CHAT_PROJECT = "9eGKb6K1";

export const VOICE_CHAT_PLUGIN_CONFIG = "plugins/voicechat/voicechat-server.properties";

export const VOICE_CHAT_MOD_CONFIG = "config/voicechat/voicechat-server.properties";

export const FABRIC_API: CompanionRequirement = {
	id: "fabric-api",
	title: "Fabric API",
	filename: "fabric-api.jar",
	project: "P7dR8mSH",
	loader: "fabric",
	files: /^fabric-api([-_][\w.+]+)?\.jar$/i,
};

export const FLOODGATE_PREFIX = ".";

export const WEBRTC_PORT = "webrtc";

export const GEYSER_TRANSPORT = "both";

export const GEYSER_PROPERTIES = {
	transport: "geyserTransport",
	webrtcPort: "geyserWebrtcPort",
	advertiseAddresses: "geyserAdvertiseAddresses",
};

export const GEYSER_PLUGIN_CONFIG = "plugins/Geyser-Spigot/config.yml";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const OCTET_MAX = 255;

const LOOPBACK_OCTET = 127;

const UNSPECIFIED_ADDRESS = "0.0.0.0";

export const advertisedAddressesOf = (publicAddress: string | null): string[] => {
	const octets = (IPV4.exec(publicAddress?.trim() ?? "") ?? []).slice(1).map(Number);

	if (octets.length === 0 || octets.some((octet) => octet > OCTET_MAX) || octets.at(0) === LOOPBACK_OCTET) {
		return [];
	}

	const address = octets.join(".");

	return address === UNSPECIFIED_ADDRESS
		? []
		: [
				address,
			];
};

export const geyserPropertiesOf = (webrtcPort: number | null, publicAddress: string | null): string[] => {
	if (webrtcPort === null) {
		return [];
	}

	const advertised = advertisedAddressesOf(publicAddress);

	return [
		`-D${GEYSER_PROPERTIES.transport}=${GEYSER_TRANSPORT}`,
		`-D${GEYSER_PROPERTIES.webrtcPort}=${webrtcPort}`,
		...(advertised.length > 0
			? [
					`-D${GEYSER_PROPERTIES.advertiseAddresses}=${advertised.join(",")}`,
				]
			: []),
	];
};

const geyserEntries = (context: Bridge.Context): YamlEntry[] => {
	return [
		{
			path: [
				"bedrock",
				"address",
			],
			value: UNSPECIFIED_ADDRESS,
		},
		{
			path: [
				"bedrock",
				"port",
			],
			value: context.port("bedrock"),
		},
		{
			path: [
				"bedrock",
				"webrtc-port",
			],
			value: context.port(WEBRTC_PORT),
		},
		{
			path: [
				"bedrock",
				"transport",
			],
			value: GEYSER_TRANSPORT,
		},
		{
			path: [
				"bedrock",
				"signaling",
				"advertise-addresses",
			],
			value: advertisedAddressesOf(context.server.publicAddress),
		},
		{
			path: [
				"java",
				"auth-type",
			],
			value: "floodgate",
		},
	];
};

const paperEntries = (): YamlEntry[] => {
	return [
		{
			path: [
				"unsupported-settings",
				"perform-username-validation",
			],
			value: false,
		},
	];
};

const floodgateEntries = (): YamlEntry[] => {
	return [
		{
			path: [
				"username-prefix",
			],
			value: FLOODGATE_PREFIX,
		},
		{
			path: [
				"replace-spaces",
			],
			value: true,
		},
	];
};

const voiceChatValues = (context: Bridge.Context): Bridge.Values => {
	return {
		port: context.port(VOICE_PORT),
		voice_host: "",
	};
};

const geyserPluginArtifact: CompanionArtifact = {
	filename: "Geyser-Spigot.jar",
	configs: [
		{
			format: CompanionConfigFormat.Yaml,
			path: GEYSER_PLUGIN_CONFIG,
			entries: geyserEntries,
		},
		{
			format: CompanionConfigFormat.Yaml,
			path: "config/paper-global.yml",
			entries: paperEntries,
		},
	],
	download: {
		project: "geyser",
		artifact: "spigot",
	},
	modrinth: {
		project: "geyser",
		loader: "paper",
		matchGameVersion: false,
	},
	requires: [],
};

const floodgatePluginArtifact: CompanionArtifact = {
	filename: "floodgate-spigot.jar",
	configs: [
		{
			format: CompanionConfigFormat.Yaml,
			path: "plugins/floodgate/config.yml",
			entries: floodgateEntries,
		},
	],
	download: {
		project: "floodgate",
		artifact: "spigot",
	},
	modrinth: null,
	requires: [],
};

const geyser: Companion = {
	id: CompanionId.Geyser,
	title: "Geyser",
	feature: CROSSPLAY,
	projects: [
		"geyser",
		"wkkoqhrh",
	],
	files: /^geyser-(spigot|paper|fabric|neoforge|bungeecord|velocity|standalone|viaproxy)([-_][\w.+]+)?\.jar$/i,
	artifacts: {
		[ServerVariant.Paper]: geyserPluginArtifact,
		[ServerVariant.Purpur]: geyserPluginArtifact,
		[ServerVariant.Fabric]: {
			filename: "Geyser-Fabric.jar",
			configs: [
				{
					format: CompanionConfigFormat.Yaml,
					path: "config/Geyser-Fabric/config.yml",
					entries: geyserEntries,
				},
			],
			download: null,
			modrinth: {
				project: "geyser",
				loader: "fabric",
				matchGameVersion: true,
			},
			requires: [
				FABRIC_API,
			],
		},
		[ServerVariant.NeoForge]: {
			filename: "Geyser-NeoForge.jar",
			configs: [
				{
					format: CompanionConfigFormat.Yaml,
					path: "config/Geyser-NeoForge/config.yml",
					entries: geyserEntries,
				},
			],
			download: null,
			modrinth: {
				project: "geyser",
				loader: "neoforge",
				matchGameVersion: true,
			},
			requires: [],
		},
	},
};

const floodgate: Companion = {
	id: CompanionId.Floodgate,
	title: "Floodgate",
	feature: CROSSPLAY,
	projects: [
		"floodgate",
		"bwrnnfkb",
	],
	files: /^floodgate-(spigot|paper|bukkit|fabric|neoforge|bungee|velocity)([-_][\w.+]+)?\.jar$/i,
	artifacts: {
		[ServerVariant.Paper]: floodgatePluginArtifact,
		[ServerVariant.Purpur]: floodgatePluginArtifact,
		[ServerVariant.Fabric]: {
			filename: "floodgate-fabric.jar",
			configs: [
				{
					format: CompanionConfigFormat.Yaml,
					path: "config/floodgate/config.yml",
					entries: floodgateEntries,
				},
			],
			download: null,
			modrinth: {
				project: "floodgate",
				loader: "fabric",
				matchGameVersion: true,
			},
			requires: [
				FABRIC_API,
			],
		},
		[ServerVariant.NeoForge]: {
			filename: "floodgate-neoforge.jar",
			configs: [
				{
					format: CompanionConfigFormat.Yaml,
					path: "config/floodgate/config.yml",
					entries: floodgateEntries,
				},
			],
			download: null,
			modrinth: {
				project: "floodgate",
				loader: "neoforge",
				matchGameVersion: true,
			},
			requires: [],
		},
	},
};

const viaVersionPluginArtifact: CompanionArtifact = {
	filename: "ViaVersion.jar",
	configs: [],
	download: null,
	modrinth: {
		project: "viaversion",
		loader: "paper",
		matchGameVersion: false,
	},
	requires: [],
};

const viaBackwardsPluginArtifact: CompanionArtifact = {
	filename: "ViaBackwards.jar",
	configs: [],
	download: null,
	modrinth: {
		project: "viabackwards",
		loader: "paper",
		matchGameVersion: false,
	},
	requires: [],
};

const viaVersion: Companion = {
	id: CompanionId.ViaVersion,
	title: "ViaVersion",
	feature: VERSION_COMPAT,
	projects: [
		"viaversion",
		"p1ozgk5p",
	],
	files: /^viaversion([-_][\w.+-]+)?\.jar$/i,
	artifacts: {
		[ServerVariant.Paper]: viaVersionPluginArtifact,
		[ServerVariant.Purpur]: viaVersionPluginArtifact,
	},
};

const viaBackwards: Companion = {
	id: CompanionId.ViaBackwards,
	title: "ViaBackwards",
	feature: VERSION_COMPAT,
	projects: [
		"viabackwards",
		"npvujqoq",
	],
	files: /^viabackwards([-_][\w.+-]+)?\.jar$/i,
	artifacts: {
		[ServerVariant.Paper]: viaBackwardsPluginArtifact,
		[ServerVariant.Purpur]: viaBackwardsPluginArtifact,
	},
};

const voiceChatPluginArtifact: CompanionArtifact = {
	filename: "voicechat-bukkit.jar",
	configs: [
		{
			format: CompanionConfigFormat.Properties,
			path: VOICE_CHAT_PLUGIN_CONFIG,
			values: voiceChatValues,
		},
	],
	download: null,
	modrinth: {
		project: VOICE_CHAT_PROJECT,
		loader: "paper",
		matchGameVersion: true,
	},
	requires: [],
};

const voiceChatModArtifact = (loader: string): CompanionArtifact => {
	return {
		filename: `voicechat-${loader}.jar`,
		configs: [
			{
				format: CompanionConfigFormat.Properties,
				path: VOICE_CHAT_MOD_CONFIG,
				values: voiceChatValues,
			},
		],
		download: null,
		modrinth: {
			project: VOICE_CHAT_PROJECT,
			loader,
			matchGameVersion: true,
		},
		requires: [],
	};
};

const voiceChat: Companion = {
	id: CompanionId.VoiceChat,
	title: "Simple Voice Chat",
	feature: VOICE_CHAT,
	projects: [
		"simple-voice-chat",
		VOICE_CHAT_PROJECT.toLowerCase(),
		"henkelmax/simplevoicechat",
	],
	files: /^voicechat-(bukkit|fabric|quilt|forge|neoforge|velocity|bungeecord)([-_][\w.+-]+)?\.jar$/i,
	artifacts: {
		[ServerVariant.Paper]: voiceChatPluginArtifact,
		[ServerVariant.Purpur]: voiceChatPluginArtifact,
		[ServerVariant.Fabric]: voiceChatModArtifact("fabric"),
		[ServerVariant.Forge]: voiceChatModArtifact("forge"),
		[ServerVariant.NeoForge]: voiceChatModArtifact("neoforge"),
	},
};

export const COMPANIONS: Companion[] = [
	geyser,
	floodgate,
	viaVersion,
	viaBackwards,
	voiceChat,
];

export const COMPANION_FEATURES: CompanionFeature[] = [
	CROSSPLAY,
	VERSION_COMPAT,
	VOICE_CHAT,
];

export const companionsOf = (feature: CompanionFeature) => {
	return COMPANIONS.filter((companion) => companion.feature === feature);
};

export const featureAvailable = (context: Bridge.Context, feature: CompanionFeature) => {
	return feature.variants.includes(variantOf(context));
};

export const companionForProject = (context: Bridge.Context, project: string) => {
	const needle = project.toLowerCase();

	return (
		COMPANIONS.find((companion) => companion.projects.includes(needle) && featureAvailable(context, companion.feature))
		?? null
	);
};

export const isCompanionFile = (context: Bridge.Context, filename: string) => {
	return COMPANIONS.some((companion) => companion.files.test(filename) && featureAvailable(context, companion.feature));
};

export const featureEnabled = (context: Bridge.Context, feature: CompanionFeature) => {
	return context.variable(feature.variable) === "true" && featureAvailable(context, feature);
};

export const crossplayEnabled = (context: Bridge.Context) => {
	return featureEnabled(context, CROSSPLAY);
};

export const geyserLaunchProperties = (context: Bridge.Context) => {
	return geyserPropertiesOf(crossplayEnabled(context) ? context.port(WEBRTC_PORT) : null, context.server.publicAddress);
};
