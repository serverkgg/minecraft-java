import { BridgeUserError } from "@serverkgg/bridge";
import { DISABLED_SUFFIX } from "../shared";
import type { Sidecar } from "./addonSidecar";
import type { ResolvedAddon } from "./dependencies";

export const assertInstallSafety = async (
	pending: ResolvedAddon[],
	provider: string,
	sidecar: Sidecar,
	exists: (filename: string) => Promise<boolean>,
) => {
	const destinations = new Set<string>();
	const primary = pending.at(0)?.project;
	for (const entry of pending) {
		const filename = entry.release.file.filename;
		const owner = sidecar[filename];
		const sameOwner = owner?.provider === provider && owner.project === entry.project;
		if (
			destinations.has(filename)
			|| (owner && !sameOwner)
			|| (!sameOwner && ((await exists(filename)) || (await exists(`${filename}${DISABLED_SUFFIX}`))))
		) {
			throw new BridgeUserError({
				ar: `الملف ${filename} يتعارض مع ملف موجود. غيّر اسمه أو شيله أول.`,
				en: `File ${filename} conflicts with an existing file. Rename or remove it first.`,
			});
		}
		destinations.add(filename);
		if (entry.project !== primary) {
			for (const [trackedName, installed] of Object.entries(sidecar)) {
				if (
					installed.provider === provider
					&& installed.project === entry.project
					&& (await exists(`${trackedName}${DISABLED_SUFFIX}`))
				) {
					throw new BridgeUserError({
						ar: `الإضافة تحتاج ${installed.title} المعطّلة. فعّلها أول وجرّب مرة ثانية.`,
						en: `This addon requires disabled ${installed.title}. Enable that dependency first and retry.`,
					});
				}
			}
		}
	}
};
