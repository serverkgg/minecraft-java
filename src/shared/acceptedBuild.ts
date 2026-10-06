import { type Bridge, BridgeNetError, BridgeUserError } from "@serverkgg/bridge";
import { buildUnavailable, buildUnpublished } from "./buildUnavailable";
import {
	BUILDS_CACHE_SECONDS,
	FABRIC_META,
	type FabricEntry,
	FORGE_MAVEN,
	FORGE_MAVEN_METADATA,
	FORGE_PROMOTIONS,
	type ForgePromotions,
	IMMUTABLE_CACHE_SECONDS,
	MANIFEST_CACHE_SECONDS,
	MOJANG_MANIFEST,
	type MojangManifest,
	type MojangVersion,
	mavenDigest,
	mavenVersions,
	NEOFORGE_MAVEN,
	NEOFORGE_MAVEN_METADATA,
	neoForgePrefix,
	PAPER_PROJECT,
	type PaperBuild,
	PURPUR_PROJECT,
	type PurpurVersion,
} from "./minecraftMeta";
import { ServerVariant } from "./variant";

export const MOJANG_RELEASE = "release";

const PAPER_STABLE_CHANNEL = "STABLE";

const FORGE_RECOMMENDED_SUFFIX = "-recommended";

const NEOFORGE_BETA_MARKER = "-beta";

export interface AcceptedBuild {
	build: string | null;
	url: string;
	digest: string | null;
	sizeBytes: number | null;
}

export interface BuildCatalogue {
	accepted: string[];
	published: string[];
	resolve: (build: string) => Promise<AcceptedBuild>;
}

type LoaderVariant = Exclude<ServerVariant, ServerVariant.Vanilla>;

const isNotFound = (error: unknown) => {
	return error instanceof BridgeNetError && error.status === 404;
};

const jarBuild = (build: string, url: string): AcceptedBuild => {
	return {
		build,
		url,
		digest: null,
		sizeBytes: null,
	};
};

const installerBuild = async (context: Bridge.Context, build: string, url: string): Promise<AcceptedBuild> => {
	const digest = await mavenDigest(context, url);

	if (digest === null) {
		throw new Error(`the installer has no sha1 on maven to verify it against: ${url}`);
	}

	return {
		build,
		url,
		digest,
		sizeBytes: null,
	};
};

export const isNeoForgeRelease = (build: string) => {
	return !build.includes(NEOFORGE_BETA_MARKER);
};

export const forgeRecommendedVersions = (promotions: ForgePromotions) => {
	return Object.keys(promotions.promos)
		.filter((key) => key.endsWith(FORGE_RECOMMENDED_SUFFIX))
		.map((key) => key.slice(0, -FORGE_RECOMMENDED_SUFFIX.length));
};

export const paperBuildList = async (context: Bridge.Context, gameVersion: string) => {
	try {
		return await context.net.json<PaperBuild[]>(`${PAPER_PROJECT}/versions/${encodeURIComponent(gameVersion)}/builds`, {
			cacheSeconds: BUILDS_CACHE_SECONDS,
		});
	} catch (error) {
		if (isNotFound(error)) {
			return [];
		}

		throw error;
	}
};

export const hasStablePaperBuild = (builds: PaperBuild[]) => {
	return builds.some((build) => build.channel === PAPER_STABLE_CHANNEL);
};

const paperCatalogue = async (context: Bridge.Context, gameVersion: string): Promise<BuildCatalogue> => {
	const builds = await paperBuildList(context, gameVersion);

	return {
		accepted: builds.filter((build) => build.channel === PAPER_STABLE_CHANNEL).map((build) => String(build.id)),
		published: builds.map((build) => String(build.id)),
		resolve: async (build) => {
			const download = builds.find((candidate) => String(candidate.id) === build)?.downloads["server:default"];

			if (!download) {
				throw buildUnavailable(ServerVariant.Paper, gameVersion);
			}

			return {
				build,
				url: download.url,
				digest: `sha256:${download.checksums.sha256}`,
				sizeBytes: download.size,
			};
		},
	};
};

const purpurCatalogue = async (context: Bridge.Context, gameVersion: string): Promise<BuildCatalogue> => {
	let builds: string[] = [];

	try {
		const version = await context.net.json<PurpurVersion>(`${PURPUR_PROJECT}/${encodeURIComponent(gameVersion)}`, {
			cacheSeconds: BUILDS_CACHE_SECONDS,
		});

		builds = [
			...version.builds.all,
		].reverse();
	} catch (error) {
		if (!isNotFound(error)) {
			throw error;
		}
	}

	return {
		accepted: builds,
		published: builds,
		resolve: async (build) => jarBuild(build, `${PURPUR_PROJECT}/${gameVersion}/${build}/download`),
	};
};

const fabricCatalogue = async (context: Bridge.Context, gameVersion: string): Promise<BuildCatalogue> => {
	const games = await context.net.json<FabricEntry[]>(`${FABRIC_META}/game`, {
		cacheSeconds: MANIFEST_CACHE_SECONDS,
	});

	const loaders = games.some((entry) => entry.version === gameVersion && entry.stable)
		? await context.net.json<FabricEntry[]>(`${FABRIC_META}/loader`, {
				cacheSeconds: BUILDS_CACHE_SECONDS,
			})
		: [];

	return {
		accepted: loaders.filter((loader) => loader.stable).map((loader) => loader.version),
		published: loaders.map((loader) => loader.version),
		resolve: async (build) => {
			const installers = await context.net.json<FabricEntry[]>(`${FABRIC_META}/installer`, {
				cacheSeconds: MANIFEST_CACHE_SECONDS,
			});

			const installer = installers.find((entry) => entry.stable)?.version;

			if (!installer) {
				throw new BridgeUserError({
					ar: "لا تتوفر لـ Fabric أداة تثبيت مستقرة حاليًا. جرب مرة ثانية بعد لحظة أو اختر نوع سيرفر آخر من تبويب الإصدار.",
					en: "Fabric has no stable installer right now. Try again in a moment or pick another server type in the Version tab.",
				});
			}

			return jarBuild(build, `${FABRIC_META}/loader/${gameVersion}/${build}/${installer}/server/jar`);
		},
	};
};

const forgeRecommended = async (context: Bridge.Context, gameVersion: string) => {
	try {
		const promotions = await context.net.json<ForgePromotions>(FORGE_PROMOTIONS, {
			cacheSeconds: BUILDS_CACHE_SECONDS,
		});

		return promotions.promos[`${gameVersion}${FORGE_RECOMMENDED_SUFFIX}`] ?? null;
	} catch {
		return null;
	}
};

const forgeCatalogue = async (context: Bridge.Context, gameVersion: string): Promise<BuildCatalogue> => {
	const metadata = await context.net.text(FORGE_MAVEN_METADATA, {
		cacheSeconds: BUILDS_CACHE_SECONDS,
	});

	const prefix = `${gameVersion}-`;

	const published = mavenVersions(metadata)
		.filter((value) => value.startsWith(prefix))
		.map((value) => value.slice(prefix.length))
		.reverse();

	const recommended = await forgeRecommended(context, gameVersion);

	const promoted =
		recommended === null
			? null
			: (published.find((build) => build === recommended || build.startsWith(`${recommended}-`)) ?? null);

	return {
		accepted:
			promoted === null
				? []
				: [
						promoted,
					],
		published,
		resolve: async (build) => {
			const release = `${gameVersion}-${build}`;

			return await installerBuild(context, build, `${FORGE_MAVEN}/${release}/forge-${release}-installer.jar`);
		},
	};
};

const neoForgeCatalogue = async (context: Bridge.Context, gameVersion: string): Promise<BuildCatalogue> => {
	const metadata = await context.net.text(NEOFORGE_MAVEN_METADATA, {
		cacheSeconds: BUILDS_CACHE_SECONDS,
	});

	const prefix = neoForgePrefix(gameVersion);

	const published = mavenVersions(metadata)
		.filter((value) => value.startsWith(prefix))
		.reverse();

	return {
		accepted: published.filter(isNeoForgeRelease),
		published,
		resolve: async (build) => {
			return await installerBuild(context, build, `${NEOFORGE_MAVEN}/${build}/neoforge-${build}-installer.jar`);
		},
	};
};

const CATALOGUE_BY_VARIANT: Record<
	LoaderVariant,
	(context: Bridge.Context, gameVersion: string) => Promise<BuildCatalogue>
> = {
	[ServerVariant.Fabric]: fabricCatalogue,
	[ServerVariant.Forge]: forgeCatalogue,
	[ServerVariant.NeoForge]: neoForgeCatalogue,
	[ServerVariant.Paper]: paperCatalogue,
	[ServerVariant.Purpur]: purpurCatalogue,
};

export const buildCatalogue = async (context: Bridge.Context, variant: LoaderVariant, gameVersion: string) => {
	return await CATALOGUE_BY_VARIANT[variant](context, gameVersion);
};

const vanillaBuild = async (context: Bridge.Context, gameVersion: string): Promise<AcceptedBuild> => {
	const manifest = await context.net.json<MojangManifest>(MOJANG_MANIFEST, {
		cacheSeconds: MANIFEST_CACHE_SECONDS,
	});

	const entry = manifest.versions.find((candidate) => candidate.id === gameVersion);

	if (!entry) {
		throw new BridgeUserError({
			ar: `لا يوجد في ماينكرافت إصدار باسم ${gameVersion}. اختر إصدارًا آخر من تبويب الإصدار.`,
			en: `Minecraft has no version called ${gameVersion}. Pick another version in the Version tab.`,
		});
	}

	if (entry.type !== MOJANG_RELEASE) {
		throw buildUnavailable(ServerVariant.Vanilla, gameVersion);
	}

	const version = await context.net.json<MojangVersion>(entry.url, {
		cacheSeconds: IMMUTABLE_CACHE_SECONDS,
	});

	const server = version.downloads?.server;

	if (!server) {
		throw buildUnavailable(ServerVariant.Vanilla, gameVersion);
	}

	return {
		build: null,
		url: server.url,
		digest: `sha1:${server.sha1}`,
		sizeBytes: server.size,
	};
};

export const acceptedBuild = async (
	context: Bridge.Context,
	variant: ServerVariant,
	gameVersion: string,
	requested: string | null,
): Promise<AcceptedBuild> => {
	if (variant === ServerVariant.Vanilla) {
		return await vanillaBuild(context, gameVersion);
	}

	const catalogue = await buildCatalogue(context, variant, gameVersion);

	if (requested !== null && !catalogue.published.includes(requested)) {
		throw buildUnpublished(variant, requested);
	}

	const build = requested ?? catalogue.accepted.at(0) ?? null;

	if (build === null) {
		throw buildUnavailable(variant, gameVersion);
	}

	return await catalogue.resolve(build);
};

export const downloadCheck = (accepted: AcceptedBuild) => {
	return {
		...(accepted.digest === null
			? {}
			: {
					digest: accepted.digest,
				}),
		...(accepted.sizeBytes === null
			? {}
			: {
					sizeBytes: accepted.sizeBytes,
				}),
	};
};
