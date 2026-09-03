import type { Bridge } from "@serverkgg/bridge";
import type { ModpackProject, ModpackRelease, ModpackSource } from "../providers";
import { gameVersionOf, variantOf } from "../shared";
import { variantForLoaders } from "./modpackIndex";
import type { ModpackSidecar } from "./modpackSidecar";

export const serverRelease = (releases: ModpackRelease[]) => {
	const supported = releases.filter((release) => variantForLoaders(release.loaders) !== null);

	return supported.find((release) => release.stable) ?? supported.at(0) ?? null;
};

export const latestRelease = async (context: Bridge.Context, source: ModpackSource, project: string) => {
	return serverRelease(await source.releases(context, project));
};

export const outdated = async (context: Bridge.Context, source: ModpackSource, project: string, versionId: string) => {
	try {
		const latest = await latestRelease(context, source, project);

		return latest !== null && latest.versionId !== versionId;
	} catch {
		return false;
	}
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
