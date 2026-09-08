import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { readInstallStamp } from "../install";
import { variantOf } from "../shared";

export const version: Bridge.Settings = {
	kind: BridgeKind.Settings,
	async read(context) {
		const stamp = await readInstallStamp(context);

		return {
			SERVER_TYPE: stamp?.variant ?? variantOf(context),
			MC_VERSION: stamp?.version ?? context.variable("MC_VERSION") ?? "",
			LOADER_VERSION: stamp?.build ?? "",
		};
	},
};
