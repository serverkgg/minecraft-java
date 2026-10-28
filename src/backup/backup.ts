import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { vanillaCommand } from "../shared";

const SAVED = /Saved the game/;

export const backup: Bridge.Backup = {
	kind: BridgeKind.Backup,
	settleSeconds: 5,
	async quiesce(context) {
		await vanillaCommand(context, "save-off");
		await vanillaCommand(context, "save-all flush", {
			expect: SAVED,
			timeoutMs: 30_000,
		});
	},
	async release(context) {
		await vanillaCommand(context, "save-on");
	},
};
