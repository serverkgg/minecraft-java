import type { Bridge } from "@serverkgg/bridge";
import { CatalogProviderId, type ModpackProject, type ModpackRelease, type ModpackSource } from "../providers";
import { gameVersionOf, variantOf } from "../shared";
import { variantsForLoaders } from "./modpackIndex";
import type { ModpackSidecar } from "./modpackSidecar";

export const serverRelease = (releases: ModpackRelease[]) => {
	const supported = releases.filter((release) => variantsForLoaders(release.loaders).length > 0);

	return supported.find((release) => release.stable) ?? supported.at(0) ?? null;
};

export const latestRelease = async (context: Bridge.Context, source: ModpackSource, project: string) => {
	return serverRelease(await source.releases(context, project));
};

export enum ModpackFreshness {
	Behind = "behind",
	Current = "current",
	Unknown = "unknown",
}

export const freshnessOf = async (
	context: Bridge.Context,
	source: ModpackSource,
	project: string,
	versionId: string,
): Promise<ModpackFreshness> => {
	if (source.id === CatalogProviderId.Upload) {
		return ModpackFreshness.Current;
	}

	try {
		const latest = await latestRelease(context, source, project);

		return latest !== null && latest.versionId !== versionId ? ModpackFreshness.Behind : ModpackFreshness.Current;
	} catch {
		return ModpackFreshness.Unknown;
	}
};

export const outdated = async (context: Bridge.Context, source: ModpackSource, project: string, versionId: string) => {
	return (await freshnessOf(context, source, project, versionId)) === ModpackFreshness.Behind;
};

export const describeProject = async (
	context: Bridge.Context,
	source: ModpackSource,
	project: string,
): Promise<ModpackProject | null> => {
	try {
		return await source.project(context, project);
	} catch {
		return null;
	}
};

export const identityMismatched = async (context: Bridge.Context, sidecar: ModpackSidecar) => {
	return sidecar.variant !== variantOf(context) || sidecar.mcVersion !== (await gameVersionOf(context));
};
