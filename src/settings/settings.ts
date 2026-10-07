import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { applyGameRules, changedFlags, PROPERTIES_FILE } from "./gameRules";

export const settings: Bridge.Settings = {
	kind: BridgeKind.Settings,
	async read(context) {
		return await context.codec.javaProperties.read(PROPERTIES_FILE);
	},
	async write(context, values) {
		const before = await context.codec.javaProperties.read(PROPERTIES_FILE);

		await context.codec.javaProperties.merge(PROPERTIES_FILE, values);

		if (context.server.running) {
			await applyGameRules(context, changedFlags(before, values));
		}
	},
};
