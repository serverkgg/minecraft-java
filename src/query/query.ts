import { type Bridge, BridgeKind } from "@serverkgg/bridge";

export const query: Bridge.Query = {
	kind: BridgeKind.Query,
	refreshSeconds: 30,
	async sample(context) {
		try {
			const status = await context.probe.minecraftPing(context.port("game"));

			return status.players;
		} catch {
			return {
				online: null,
				max: null,
			};
		}
	},
};
