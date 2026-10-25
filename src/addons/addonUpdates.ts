import type { Bridge } from "@serverkgg/bridge";
import { type AddonTarget, type AddonUpdates, providerById, type TrackedAddon } from "../providers";

export const addonUpdates = async (
	context: Bridge.Context,
	target: AddonTarget,
	tracked: TrackedAddon[],
): Promise<AddonUpdates> => {
	const updates: AddonUpdates = new Map();
	const providers = [
		...new Set(tracked.map((addon) => addon.provider)),
	];

	await Promise.all(
		providers.map(async (id) => {
			const provider = providerById(id);

			if (!provider?.updates || !provider.supports(target)) {
				return;
			}

			try {
				const found = await provider.updates(
					context,
					target,
					tracked.filter((addon) => addon.provider === id),
				);

				for (const [filename, update] of found) {
					updates.set(filename, update);
				}
			} catch (error) {
				context.log.warn("could not check the installed addons for updates", {
					provider: id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}),
	);

	return updates;
};
