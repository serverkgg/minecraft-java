import type { Bridge } from "@serverkgg/bridge";
import { SERVER_JAR } from "../shared";

const RUN_SCRIPT = "run.sh";

const ARGS_REFERENCE = /@((?:libraries|[\w.-]+)\/\S*_args\.txt)/;

export enum LaunchKind {
	Args = "args",
	Jar = "jar",
}

export interface LaunchPlan {
	kind: LaunchKind;
	target: string;
}

export const jarLaunch: LaunchPlan = {
	kind: LaunchKind.Jar,
	target: SERVER_JAR,
};

export const argsTarget = (script: string) => {
	return script.match(ARGS_REFERENCE)?.[1] ?? null;
};

export const detectLoaderLaunch = async (context: Bridge.Context): Promise<LaunchPlan | null> => {
	if (await context.files.exists(RUN_SCRIPT)) {
		const target = argsTarget(await context.files.read(RUN_SCRIPT));

		if (target && (await context.files.exists(target))) {
			return {
				kind: LaunchKind.Args,
				target,
			};
		}
	}

	if (await context.files.exists(SERVER_JAR)) {
		return jarLaunch;
	}

	return null;
};

export const launchArguments = (plan: LaunchPlan) => {
	return plan.kind === LaunchKind.Args
		? [
				`@${plan.target}`,
			]
		: [
				"-jar",
				plan.target,
			];
};
