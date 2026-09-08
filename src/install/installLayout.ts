import type { Bridge } from "@serverkgg/bridge";
import { eraOf, gameVersionOf, layoutOf, releaseOrder, variantOf, type WorldLayout } from "../shared";
import { readInstallStamp } from "./installStamp";

export const installedLayout = async (context: Bridge.Context): Promise<WorldLayout> => {
	const stamp = await readInstallStamp(context);
	const order = await releaseOrder(context).catch(() => new Map<string, number>());
	const variant = stamp?.variant ?? variantOf(context);
	const version = stamp?.version ?? (await gameVersionOf(context));

	return layoutOf(variant, eraOf(order, version));
};
