import type { Bridge } from "@serverkgg/bridge";
import { ServerVariant, variantOf } from "../shared";
import type { YamlEntry } from "./yamlConfig";

export enum CompanionId {
	Floodgate = "floodgate",
	Geyser = "geyser",
	ViaBackwards = "viabackwards",
	ViaVersion = "viaversion",
}

export enum CompanionSource {
	GeyserMc = "geysermc",
	Modrinth = "modrinth",
}

export interface CompanionFeature {
	id: string;
	variable: string;
	switchLabel: string;
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

export interface CompanionConfig {
	path: string;
	entries(context: Bridge.Context): YamlEntry[];
}

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
	switchLabel: "crossplay",
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
	switchLabel: "version compatibility",
	variants: [
		ServerVariant.Paper,
		ServerVariant.Purpur,
	],
};

export const FABRIC_API: CompanionRequirement = {
	id: "fabric-api",
	title: "Fabric API",
	filename: "fabric-api.jar",
	project: "P7dR8mSH",
	loader: "fabric",
	files: /^fabric-api([-_][\w.+]+)?\.jar$/i,
};

export const FLOODGATE_PREFIX = ".";

const geyserEntries = (context: Bridge.Context): YamlEntry[] => {
	return [
		{
			path: [
				"bedrock",
				"address",
			],
			value: "0.0.0.0",
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

const geyserPluginArtifact: CompanionArtifact = {
	filename: "Geyser-Spigot.jar",
	configs: [
		{
			path: "plugins/Geyser-Spigot/config.yml",
			entries: geyserEntries,
		},
		{
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

export const COMPANIONS: Companion[] = [
	geyser,
	floodgate,
	viaVersion,
	viaBackwards,
];

export const COMPANION_FEATURES: CompanionFeature[] = [
	CROSSPLAY,
	VERSION_COMPAT,
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
