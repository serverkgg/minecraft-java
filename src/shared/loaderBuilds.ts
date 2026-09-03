import type { Bridge } from "@serverkgg/bridge";
import {
	BUILDS_CACHE_SECONDS,
	FABRIC_META,
	type FabricEntry,
	FORGE_MAVEN_METADATA,
	FORGE_PROMOTIONS,
	type ForgePromotions,
	mavenVersions,
	NEOFORGE_MAVEN_METADATA,
	neoForgePrefix,
	PAPER_PROJECT,
	type PaperBuild,
	PURPUR_PROJECT,
	type PurpurVersion,
	pinnedChoice,
	toOptions,
} from "./minecraftMeta";
import { ServerVariant, variantOf } from "./variant";

const BUILD_LIMIT = 50;

export const paperBuilds = async (context: Bridge.Context, gameVersion: string) => {
	const builds = await context.net.json<PaperBuild[]>(
		`${PAPER_PROJECT}/versions/${encodeURIComponent(gameVersion)}/builds`,
		{
			cacheSeconds: BUILDS_CACHE_SECONDS,
		},
	);

	return toOptions(
		builds
			.filter((build) => build.channel === "STABLE")
			.slice(0, BUILD_LIMIT)
			.map((build) => String(build.id)),
		true,
	);
};

const purpurBuilds = async (context: Bridge.Context, gameVersion: string) => {
	const version = await context.net.json<PurpurVersion>(`${PURPUR_PROJECT}/${encodeURIComponent(gameVersion)}`, {
		cacheSeconds: BUILDS_CACHE_SECONDS,
	});

	return toOptions(
		[
			...version.builds.all,
		]
			.reverse()
			.slice(0, BUILD_LIMIT),
		true,
	);
};

const fabricLoaders = async (context: Bridge.Context) => {
	const loaders = await context.net.json<FabricEntry[]>(`${FABRIC_META}/loader`, {
		cacheSeconds: BUILDS_CACHE_SECONDS,
	});

	return toOptions(
		loaders
			.filter((loader) => loader.stable)
			.slice(0, BUILD_LIMIT)
			.map((loader) => loader.version),
		true,
	);
};

const forgeRecommended = async (context: Bridge.Context, gameVersion: string) => {
	try {
		const promotions = await context.net.json<ForgePromotions>(FORGE_PROMOTIONS, {
			cacheSeconds: BUILDS_CACHE_SECONDS,
		});

		return promotions.promos[`${gameVersion}-recommended`] ?? null;
	} catch {
		return null;
	}
};

const forgeBuilds = async (context: Bridge.Context, gameVersion: string): Promise<Bridge.Option[]> => {
	const metadata = await context.net.text(FORGE_MAVEN_METADATA, {
		cacheSeconds: BUILDS_CACHE_SECONDS,
	});
	const recommended = await forgeRecommended(context, gameVersion);
	const prefix = `${gameVersion}-`;

	const builds = mavenVersions(metadata)
		.filter((value) => value.startsWith(prefix))
		.map((value) => value.slice(prefix.length));

	return builds
		.reverse()
		.slice(0, BUILD_LIMIT)
		.map((build, index) => {
			return {
				value: build,
				label: {
					ar: build === recommended ? `${build} (موصى به)` : build,
					en: build === recommended ? `${build} (recommended)` : build,
				},
				...(index === 0
					? {
							latest: true,
						}
					: {}),
			};
		});
};

const neoForgeBuilds = async (context: Bridge.Context, gameVersion: string) => {
	const metadata = await context.net.text(NEOFORGE_MAVEN_METADATA, {
		cacheSeconds: BUILDS_CACHE_SECONDS,
	});
	const prefix = neoForgePrefix(gameVersion);

	return toOptions(
		mavenVersions(metadata)
			.filter((value) => value.startsWith(prefix))
			.reverse()
			.slice(0, BUILD_LIMIT),
		true,
	);
};

const BUILDS_BY_VARIANT: Partial<
	Record<ServerVariant, (context: Bridge.Context, gameVersion: string) => Promise<Bridge.Option[]>>
> = {
	[ServerVariant.Fabric]: (context) => fabricLoaders(context),
	[ServerVariant.Forge]: forgeBuilds,
	[ServerVariant.NeoForge]: neoForgeBuilds,
	[ServerVariant.Paper]: paperBuilds,
	[ServerVariant.Purpur]: purpurBuilds,
};

export const buildsFor = async (context: Bridge.Context, gameVersion: string) => {
	const resolver = BUILDS_BY_VARIANT[variantOf(context)];

	if (!resolver) {
		return [];
	}

	return await resolver(context, gameVersion);
};

export const declaredBuild = (context: Bridge.Context) => {
	return pinnedChoice(context.variable("LOADER_VERSION"));
};

export const requestedBuild = async (context: Bridge.Context, gameVersion: string) => {
	const declared = declaredBuild(context);

	if (declared) {
		return declared;
	}

	const builds = await buildsFor(context, gameVersion);

	return builds.at(0)?.value ?? null;
};
