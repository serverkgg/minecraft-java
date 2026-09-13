import type { Bridge } from "@serverkgg/bridge";
import { type ModpackPlan, modpackPlan } from "../modpacks";
import {
	declaredBuild,
	latestRelease,
	requestedBuild,
	requestedGameVersion,
	ServerVariant,
	variantOf,
} from "../shared";
import type { InstallIdentity, InstallStamp } from "./installStamp";

export interface InstallNext {
	next: InstallIdentity;
	plan: ModpackPlan;
}

export const resolveBuild = async (
	context: Bridge.Context,
	variant: ServerVariant,
	version: string,
	pinned: string | null,
) => {
	if (variant === ServerVariant.Vanilla) {
		return null;
	}

	return declaredBuild(context) ?? pinned ?? (await requestedBuild(context, version));
};

export const resolveVersion = async (context: Bridge.Context, stamp: InstallStamp | null) => {
	return requestedGameVersion(context) ?? stamp?.version ?? (await latestRelease(context));
};

const buildFor = async (
	context: Bridge.Context,
	variant: ServerVariant,
	version: string,
	pinned: string | null,
	optional: boolean,
) => {
	try {
		return await resolveBuild(context, variant, version, pinned);
	} catch (error) {
		if (!optional) {
			throw error;
		}

		return null;
	}
};

export const resolveNext = async (
	context: Bridge.Context,
	stamp: InstallStamp | null,
	optionalBuild = false,
): Promise<InstallNext> => {
	const variant = variantOf(context);
	const version = await resolveVersion(context, stamp);
	const plan = await modpackPlan(context, variant, version);

	return {
		next: {
			variant,
			version,
			build: await buildFor(
				context,
				variant,
				version,
				plan.pinnedBuild ?? (stamp?.variant === variant && stamp.version === version ? stamp.build : null),
				optionalBuild,
			),
		},
		plan,
	};
};
