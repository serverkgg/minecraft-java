import { type Bridge, BridgeDownloadError } from "@serverkgg/bridge";
import { PURPUR_PROJECT, SERVER_JAR, ServerVariant } from "../shared";
import { buildUnavailable } from "./buildUnavailable";
import { jarLaunch } from "./launchPlan";

const downloadJar = async (context: Bridge.Context, gameVersion: string, build: string | null) => {
	try {
		await context.files.download(SERVER_JAR, `${PURPUR_PROJECT}/${gameVersion}/${build ?? "latest"}/download`);
	} catch (error) {
		if (error instanceof BridgeDownloadError && error.status === 404) {
			throw buildUnavailable(ServerVariant.Purpur, gameVersion);
		}

		throw error;
	}
};

export const installPurpur = async (context: Bridge.Context, gameVersion: string, build: string | null) => {
	await downloadJar(context, gameVersion, build);

	await context.files.ensure("plugins");

	return jarLaunch;
};
