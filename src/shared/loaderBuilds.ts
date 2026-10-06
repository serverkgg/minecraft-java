import type { Bridge } from "@serverkgg/bridge";
import { buildCatalogue } from "./acceptedBuild";
import { pinnedChoice, toOptions } from "./minecraftMeta";
import { ServerVariant, variantOf } from "./variant";

const BUILD_LIMIT = 50;

const recommendedLabel = (option: Bridge.Option): Bridge.Option => {
	return {
		...option,
		label: {
			ar: `${option.value} (موصى به)`,
			en: `${option.value} (recommended)`,
		},
	};
};

export const buildsFor = async (context: Bridge.Context, gameVersion: string) => {
	const variant = variantOf(context);

	if (variant === ServerVariant.Vanilla) {
		return [];
	}

	const catalogue = await buildCatalogue(context, variant, gameVersion);
	const options = toOptions(catalogue.accepted.slice(0, BUILD_LIMIT), true);

	return variant === ServerVariant.Forge ? options.map(recommendedLabel) : options;
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
