import { type Bridge, BridgeDownloadError } from "@serverkgg/bridge";
import { type AcceptedBuild, buildUnavailable, downloadCheck, SERVER_JAR, ServerVariant } from "../shared";
import { jarLaunch } from "./launchPlan";

export const installPurpur = async (context: Bridge.Context, gameVersion: string, accepted: AcceptedBuild) => {
	try {
		await context.files.download(SERVER_JAR, accepted.url, downloadCheck(accepted));
	} catch (error) {
		if (error instanceof BridgeDownloadError && error.status === 404) {
			throw buildUnavailable(ServerVariant.Purpur, gameVersion);
		}

		throw error;
	}

	await context.files.ensure("plugins");

	return jarLaunch;
};
