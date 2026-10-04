import { BridgeUserError } from "@serverkgg/bridge";
import type { CatalogDependency, CatalogRelease } from "../providers";

export interface ResolvedAddon {
	project: string;
	release: CatalogRelease;
}

export const resolveDependencies = async (
	project: string,
	resolve: (project: string, version: string | null) => Promise<CatalogRelease | null>,
	version: string | null = null,
): Promise<ResolvedAddon[]> => {
	const selected = new Map<string, ResolvedAddon>();
	const constraints = new Map<string, string>();
	const conflicts: CatalogDependency[] = [];
	const pending = [
		{
			project,
			version,
			kind: "required",
		} satisfies CatalogDependency,
	];

	while (pending.length > 0) {
		const dependency = pending.shift();
		if (!dependency) {
			break;
		}
		if (dependency.kind === "incompatible") {
			conflicts.push(dependency);
			continue;
		}
		if (dependency.kind !== "required") {
			continue;
		}
		const previous = constraints.get(dependency.project);
		if (dependency.version && previous && previous !== dependency.version) {
			throw new BridgeUserError({
				ar: `الإضافات تتطلب إصدارات مختلفة من ${dependency.project}. اختر إصدارات متوافقة.`,
				en: `These add-ons need different versions of ${dependency.project}. Choose compatible versions.`,
			});
		}
		if (dependency.version) {
			constraints.set(dependency.project, dependency.version);
		}
		const existing = selected.get(dependency.project);
		if (existing && (!dependency.version || existing.release.versionId === dependency.version)) {
			continue;
		}
		if (selected.size >= 128 && !existing) {
			throw new BridgeUserError({
				ar: "الإضافة تتطلب أكثر من 128 إضافة. ثبّتها كمودباك.",
				en: "This add-on needs more than 128 projects. Install it as a modpack.",
			});
		}
		const release = await resolve(dependency.project, dependency.version);
		if (!release || (dependency.version && release.versionId !== dependency.version)) {
			throw new BridgeUserError({
				ar: `تعذّر العثور على إصدار متوافق من ${dependency.project}. لم تتغيّر إضافاتك.`,
				en: `We couldn't find a compatible version of ${dependency.project}. Your add-ons weren't changed.`,
			});
		}
		selected.set(dependency.project, {
			project: dependency.project,
			release,
		});
		pending.push(...release.dependencies);
	}
	for (const conflict of conflicts) {
		const installed = selected.get(conflict.project);
		if (installed && (!conflict.version || installed.release.versionId === conflict.version)) {
			throw new BridgeUserError({
				ar: `الإضافات المختارة تتعارض مع ${conflict.project}.`,
				en: `The selected add-ons conflict with ${conflict.project}.`,
			});
		}
	}
	return [
		...selected.values(),
	];
};
