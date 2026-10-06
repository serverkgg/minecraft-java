import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { describeExecFailure } from "@serverkgg/bridge/utils";
import { javaBinary } from "../shared";
import { detectLoaderLaunch, type LaunchPlan } from "./launchPlan";

const INSTALLER_JAR = "loader-installer.jar";

const INSTALLER_LOG = `${INSTALLER_JAR}.log`;

const ERROR_TAIL = 512;

export interface LoaderInstall {
	name: string;
	release: string;
	installerUrl: string;
	digest: string | null;
	javaMajor: number;
}

export const runLoaderInstaller = async (
	context: Bridge.Context,
	install: LoaderInstall,
): Promise<LaunchPlan | null> => {
	if (install.digest === null) {
		throw new Error(`the ${install.name} installer has no sha1 to verify it against: ${install.installerUrl}`);
	}

	await context.files.download(INSTALLER_JAR, install.installerUrl, {
		digest: install.digest,
	});

	context.log("running the installer", {
		loader: install.name,
		release: install.release,
		java: install.javaMajor,
	});

	const result = await context.exec([
		javaBinary(install.javaMajor),
		"-jar",
		INSTALLER_JAR,
		"--installServer",
	]);

	await context.files.remove(INSTALLER_JAR);
	await context.files.remove(INSTALLER_LOG);

	if (result.code !== 0) {
		const detail = (result.stderr || result.stdout).slice(-ERROR_TAIL).trim();

		throw new BridgeUserError(describeExecFailure(result, install.name), {
			cause: new Error(`the ${install.name} installer exited ${result.code}: ${detail}`),
		});
	}

	return await detectLoaderLaunch(context);
};
