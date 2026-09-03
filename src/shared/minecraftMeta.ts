import type { Bridge } from "@serverkgg/bridge";

export const MANIFEST_CACHE_SECONDS = 3600;

export const IMMUTABLE_CACHE_SECONDS = 86_400;

export const BUILDS_CACHE_SECONDS = 300;

export const MOJANG_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

export const PAPER_PROJECT = "https://fill.papermc.io/v3/projects/paper";

export const PURPUR_PROJECT = "https://api.purpurmc.org/v2/purpur";

export const FABRIC_META = "https://meta.fabricmc.net/v2/versions";

export const FORGE_PROMOTIONS = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";

export const FORGE_MAVEN_METADATA = "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";

export const FORGE_MAVEN = "https://maven.minecraftforge.net/net/minecraftforge/forge";

export const NEOFORGE_MAVEN = "https://maven.neoforged.net/releases/net/neoforged/neoforge";

export const NEOFORGE_MAVEN_METADATA = `${NEOFORGE_MAVEN}/maven-metadata.xml`;

export const SERVER_JAR = "server.jar";

const LATEST_CHOICE = "latest";

const UNSTABLE_MARKERS = [
	"-rc",
	"-pre",
	"-snapshot",
];

export interface MojangManifest {
	latest: {
		release: string;
	};
	versions: {
		id: string;
		type: string;
		url: string;
	}[];
}

export interface MojangVersion {
	downloads: {
		server: {
			url: string;
			sha1: string;
			size: number;
		};
	};
	javaVersion?: {
		majorVersion: number;
	};
}

export interface PaperProject {
	versions: Record<string, string[]>;
}

export interface PaperBuild {
	id: number;
	channel: string;
	downloads: {
		"server:default": {
			url: string;
			size: number;
			checksums: {
				sha256: string;
			};
		};
	};
}

export interface PurpurProject {
	versions: string[];
}

export interface PurpurVersion {
	builds: {
		all: string[];
	};
}

export interface FabricEntry {
	version: string;
	stable: boolean;
}

export interface ForgePromotions {
	promos: Record<string, string>;
}

export const isStable = (version: string) => {
	const lowered = version.toLowerCase();

	return !UNSTABLE_MARKERS.some((marker) => lowered.includes(marker));
};

export const compareVersionDesc = (left: string, right: string) => {
	const first = left.split(".");
	const second = right.split(".");
	const length = Math.max(first.length, second.length);

	for (let index = 0; index < length; index += 1) {
		const a = Number(first[index] ?? 0);
		const b = Number(second[index] ?? 0);

		if (a !== b) {
			return b - a;
		}
	}

	return 0;
};

export const toOptions = (values: string[], latestFirst = false): Bridge.Option[] => {
	return values.map((value, index) => {
		return {
			value,
			label: {
				ar: value,
				en: value,
			},
			...(latestFirst && index === 0
				? {
						latest: true,
					}
				: {}),
		};
	});
};

export const mavenVersions = (metadata: string) => {
	const versions: string[] = [];

	for (const match of metadata.matchAll(/<version>([^<]+)<\/version>/g)) {
		const value = match[1];

		if (value) {
			versions.push(value);
		}
	}

	return versions;
};

const SHA1_PATTERN = /^[a-f0-9]{40}$/;

export const mavenDigest = async (context: Bridge.Context, url: string) => {
	try {
		const body = await context.net.text(`${url}.sha1`, {
			cacheSeconds: IMMUTABLE_CACHE_SECONDS,
		});
		const value = body.trim().split(/\s+/).at(0)?.toLowerCase() ?? "";

		return SHA1_PATTERN.test(value) ? `sha1:${value}` : null;
	} catch {
		return null;
	}
};

export const neoForgePrefix = (gameVersion: string) => {
	const legacy = gameVersion.startsWith("1.");
	const segments = (legacy ? gameVersion.slice(2) : gameVersion).split(".");
	const width = legacy ? 2 : 3;

	while (segments.length < width) {
		segments.push("0");
	}

	return `${segments.slice(0, width).join(".")}.`;
};

export const neoForgeBuildPrefix = (build: string) => {
	const segments = build.split(".");
	const width = segments.length >= 4 ? 3 : 2;

	return `${segments.slice(0, width).join(".")}.`;
};

export const latestRelease = async (context: Bridge.Context) => {
	const manifest = await context.net.json<MojangManifest>(MOJANG_MANIFEST, {
		cacheSeconds: MANIFEST_CACHE_SECONDS,
	});

	return manifest.latest.release;
};

export const releaseOrder = async (context: Bridge.Context) => {
	const manifest = await context.net.json<MojangManifest>(MOJANG_MANIFEST, {
		cacheSeconds: MANIFEST_CACHE_SECONDS,
	});

	return new Map(
		manifest.versions.map((entry, index) => [
			entry.id,
			index,
		]),
	);
};

export const pinnedChoice = (declared: string | null) => {
	const value = declared ?? "";

	return value.length > 0 && value !== LATEST_CHOICE ? value : null;
};

export const requestedGameVersion = (context: Bridge.Context) => {
	return pinnedChoice(context.variable("MC_VERSION"));
};

export const gameVersionOf = async (context: Bridge.Context) => {
	return requestedGameVersion(context) ?? (await latestRelease(context));
};
