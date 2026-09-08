import type { Bridge } from "@serverkgg/bridge";
import { NEOFORGE_MAVEN, ServerVariant } from "../shared";
import { buildUnavailable } from "./buildUnavailable";
import type { LaunchPlan } from "./launchPlan";
import { runLoaderInstaller } from "./loaderInstaller";

export const installNeoForge = async (
	context: Bridge.Context,
	gameVersion: string,
	build: string | null,
	javaMajor: number,
): Promise<LaunchPlan> => {
	if (!build) {
		throw buildUnavailable(ServerVariant.NeoForge, gameVersion);
	}

	const plan = await runLoaderInstaller(context, {
		name: "NeoForge",
		release: build,
		installerUrl: `${NEOFORGE_MAVEN}/${build}/neoforge-${build}-installer.jar`,
		javaMajor,
	});

	await context.files.ensure("mods");

	if (!plan) {
		throw new Error(`the NeoForge installer produced no server launcher for ${build}`);
	}

	return plan;
};
