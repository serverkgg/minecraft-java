import type { Bridge } from "@serverkgg/bridge";
import { FABRIC_META, type FabricEntry, MANIFEST_CACHE_SECONDS, SERVER_JAR, ServerVariant } from "../shared";
import { buildUnavailable } from "./buildUnavailable";
import { jarLaunch } from "./launchPlan";

export const installFabric = async (context: Bridge.Context, gameVersion: string, build: string | null) => {
	const installers = await context.net.json<FabricEntry[]>(`${FABRIC_META}/installer`, {
		cacheSeconds: MANIFEST_CACHE_SECONDS,
	});

	const installer = installers.find((entry) => entry.stable)?.version;

	if (!build) {
		throw buildUnavailable(ServerVariant.Fabric, gameVersion);
	}

	if (!installer) {
		throw new Error(`no stable Fabric loader for minecraft ${gameVersion}`);
	}

	await context.files.download(SERVER_JAR, `${FABRIC_META}/loader/${gameVersion}/${build}/${installer}/server/jar`);
	await context.files.ensure("mods");

	return jarLaunch;
};
