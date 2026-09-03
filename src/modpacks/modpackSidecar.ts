import type { Bridge } from "@serverkgg/bridge";
import { ServerVariant, VARIANT_LABELS } from "../shared";
import type { BlockedFile } from "./modpackIndex";

export const MODPACK_SIDECAR = ".serverk-modpack.json";

const IDENTITY_SEPARATOR = " · ";

const MOD_JAR_PREFIX = "mods/";

const MOD_JAR_SUFFIX = ".jar";

export type PendingFile = BlockedFile;

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
	description: string | null;
	author: string | null;
	downloads: number | null;
	loaderVersion: string | null;
	appliedAt: string;
	fileCount: number;
	files: string[] | null;
	pending: PendingFile[];
}

const VARIANTS = new Set<string>(Object.values(ServerVariant));

const readPendingFile = (value: unknown): PendingFile | null => {
	if (value === null || typeof value !== "object") {
		return null;
	}

	const raw = value as Partial<PendingFile>;

	if (typeof raw.modId !== "number" || typeof raw.fileId !== "number") {
		return null;
	}

	if (typeof raw.fileName !== "string" || raw.fileName.length === 0) {
		return null;
	}

	if (typeof raw.sha1 !== "string" || raw.sha1.length === 0) {
		return null;
	}

	return {
		fileId: raw.fileId,
		fileName: raw.fileName,
		modId: raw.modId,
		name: typeof raw.name === "string" ? raw.name : raw.fileName,
		pageUrl: typeof raw.pageUrl === "string" ? raw.pageUrl : null,
		sha1: raw.sha1.toLowerCase(),
		sizeBytes: typeof raw.sizeBytes === "number" ? raw.sizeBytes : null,
		slug: typeof raw.slug === "string" ? raw.slug : "",
	};
};

export const readPendingFiles = (value: unknown): PendingFile[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	const pending: PendingFile[] = [];

	for (const entry of value) {
		const file = readPendingFile(entry);

		if (file) {
			pending.push(file);
		}
	}

	return pending;
};

export const parseModpackSidecar = (text: string): ModpackSidecar | null => {
	try {
		const parsed = JSON.parse(text) as Partial<ModpackSidecar>;

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
			description: typeof parsed.description === "string" ? parsed.description : null,
			author: typeof parsed.author === "string" ? parsed.author : null,
			downloads: typeof parsed.downloads === "number" ? parsed.downloads : null,
			mcVersion: parsed.mcVersion,
			variant: parsed.variant,
			loaderVersion: typeof parsed.loaderVersion === "string" ? parsed.loaderVersion : null,
			appliedAt: typeof parsed.appliedAt === "string" ? parsed.appliedAt : "",
			fileCount: typeof parsed.fileCount === "number" ? parsed.fileCount : 0,
			files: Array.isArray(parsed.files) ? parsed.files.filter((path) => typeof path === "string") : null,
			pending: readPendingFiles(parsed.pending),
		};
	} catch {
		return null;
	}
};

export const readModpackSidecar = async (context: Bridge.Context): Promise<ModpackSidecar | null> => {
	if (!(await context.files.exists(MODPACK_SIDECAR))) {
		return null;
	}

	return parseModpackSidecar(await context.files.read(MODPACK_SIDECAR));
};

export const modpackModCount = (sidecar: ModpackSidecar) => {
	if (sidecar.files === null) {
		return sidecar.fileCount;
	}

	return sidecar.files.filter((path) => path.startsWith(MOD_JAR_PREFIX) && path.endsWith(MOD_JAR_SUFFIX)).length;
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
