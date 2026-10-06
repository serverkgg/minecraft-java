import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { readInstallStamp } from "../install";
import {
	buildCatalogue,
	buildsFor,
	declaredBuild,
	gameVersionOf,
	ServerVariant,
	toOptions,
	variantOf,
} from "../shared";

const installedOptionOf = (value: string): Bridge.Option => {
	return {
		value,
		label: {
			ar: `${value} (مثبّت حاليًا)`,
			en: `${value} (installed)`,
		},
	};
};

const keptForgeBuildsOf = async (context: Bridge.Context, gameVersion: string, listed: Bridge.Option[]) => {
	const stamp = await readInstallStamp(context);
	const installed = stamp?.variant === ServerVariant.Forge && stamp.version === gameVersion ? stamp.build : null;
	const shown = new Set(listed.map((option) => option.value));

	const wanted = [
		...new Set([
			installed,
			declaredBuild(context),
		]),
	].filter((build): build is string => build !== null && !shown.has(build));

	if (wanted.length === 0) {
		return [];
	}

	const { published } = await buildCatalogue(context, ServerVariant.Forge, gameVersion);

	return wanted
		.filter((build) => published.includes(build))
		.flatMap((build) =>
			build === installed
				? [
						installedOptionOf(build),
					]
				: toOptions([
						build,
					]),
		);
};

export const loaderBuild: Bridge.Options = {
	kind: BridgeKind.Options,
	dependsOn: [
		"SERVER_TYPE",
		"MC_VERSION",
	],
	ttlSeconds: 1800,
	async list(context) {
		const gameVersion = await gameVersionOf(context);
		const options = await buildsFor(context, gameVersion);

		if (variantOf(context) !== ServerVariant.Forge) {
			return options;
		}

		return [
			...options,
			...(await keptForgeBuildsOf(context, gameVersion, options)),
		];
	},
};
