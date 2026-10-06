import type { Bridge } from "@serverkgg/bridge";
import { type AcceptedBuild, downloadCheck, SERVER_JAR } from "../shared";
import { jarLaunch } from "./launchPlan";

export const installVanilla = async (context: Bridge.Context, accepted: AcceptedBuild) => {
	await context.files.download(SERVER_JAR, accepted.url, downloadCheck(accepted));

	return jarLaunch;
};
