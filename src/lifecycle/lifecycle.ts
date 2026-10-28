import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { geyserLaunchProperties, pinCompanionConfigs, syncCompanions } from "../companions";
import { launchArguments, readInstallStamp } from "../install";
import { applyStoredGameRules } from "../settings";
import { javaBinary } from "../shared";
import { heapFor } from "./heap";
import { jvmFlags } from "./jvmFlags";

const READY = /Done \([\d.]+s\)! For help, type "help"/;

const FAILED = /Failed to start the minecraft server/;

const STOPPING = /Stopping the server/;

export const lifecycle: Bridge.Lifecycle = {
	kind: BridgeKind.Lifecycle,
	ready: READY,
	failed: FAILED,
	stopTimeoutSeconds: 60,
	async command(context) {
		await syncCompanions(context);

		const stamp = await readInstallStamp(context);

		if (!stamp) {
			throw new Error("minecraft is not installed yet");
		}

		return [
			javaBinary(stamp.java),
			...jvmFlags(heapFor(context.server.memoryMb)),
			...launchArguments(stamp.launch, geyserLaunchProperties(context)),
			"nogui",
		];
	},
	async onReady(context) {
		try {
			await applyStoredGameRules(context);
		} finally {
			await pinCompanionConfigs(context);
		}
	},
	async stop(context) {
		await context.command("stop", {
			expect: STOPPING,
			timeoutMs: 30_000,
		});
	},
};
