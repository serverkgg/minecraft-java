import type { Bridge } from "@serverkgg/bridge";
import { ServerVariant, VARIANT_LABELS } from "../shared";

export const MODPACK_SIDECAR = ".serverk-modpack.json";

const IDENTITY_SEPARATOR = " · ";

export interface ModpackIdentity {
	mcVersion: string;
	variant: ServerVariant;
}

export interface ModpackSidecar extends ModpackIdentity {
	provider: string;
	project: string;
	versionId: string;
	version: string;
	title: string;
	icon: string | null;
	pageUrl: string | null;
	loaderVersion: string | null;
	appliedAt: string;
	fileCount: number;
	files: string[] | null;
}

const VARIANTS = new Set<string>(Object.values(ServerVariant));

export const readModpackSidecar = async (context: Bridge.Context): Promise<ModpackSidecar | null> => {
	if (!(await context.files.exists(MODPACK_SIDECAR))) {
		return null;
	}

	try {
		const parsed = JSON.parse(await context.files.read(MODPACK_SIDECAR)) as Partial<ModpackSidecar>;

		if (typeof parsed.provider !== "string" || typeof parsed.project !== "string") {
			return null;
		}

		if (typeof parsed.versionId !== "string" || typeof parsed.mcVersion !== "string") {
			return null;
		}

		if (typeof parsed.variant !== "string" || !VARIANTS.has(parsed.variant)) {
			return null;
		}

		return {
			provider: parsed.provider,
			project: parsed.project,
			versionId: parsed.versionId,
			version: typeof parsed.version === "string" ? parsed.version : parsed.versionId,
			title: typeof parsed.title === "string" ? parsed.title : parsed.project,
			icon: typeof parsed.icon === "string" ? parsed.icon : null,
			pageUrl: typeof parsed.pageUrl === "string" ? parsed.pageUrl : null,
			mcVersion: parsed.mcVersion,
			variant: parsed.variant,
			loaderVersion: typeof parsed.loaderVersion === "string" ? parsed.loaderVersion : null,
			appliedAt: typeof parsed.appliedAt === "string" ? parsed.appliedAt : "",
			fileCount: typeof parsed.fileCount === "number" ? parsed.fileCount : 0,
			files: Array.isArray(parsed.files) ? parsed.files.filter((path) => typeof path === "string") : null,
		};
	} catch {
		return null;
	}
};

export const modpackIdentity = (identity: ModpackIdentity) => {
	return [
		identity.mcVersion,
		VARIANT_LABELS[identity.variant],
	].join(IDENTITY_SEPARATOR);
};

export const modpackBuildIdentity = (sidecar: ModpackSidecar) => {
	return sidecar.loaderVersion === null
		? modpackIdentity(sidecar)
		: [
				modpackIdentity(sidecar),
				sidecar.loaderVersion,
			].join(IDENTITY_SEPARATOR);
};

export const writeModpackSidecar = async (context: Bridge.Context, sidecar: ModpackSidecar) => {
	await context.files.write(MODPACK_SIDECAR, `${JSON.stringify(sidecar, null, 2)}\n`);
};

export const clearModpackSidecar = async (context: Bridge.Context) => {
	await context.files.remove(MODPACK_SIDECAR);
};
