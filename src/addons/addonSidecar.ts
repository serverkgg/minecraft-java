import type { Bridge } from "@serverkgg/bridge";

export const ADDON_SIDECAR = ".serverk-catalog.json";

export interface SidecarEntry {
	provider: string;
	project: string;
	version: string;
	title: string;
	gameVersion: string;
	gameVersions?: string[] | null;
	icon: string | null;
	pageUrl: string | null;
}

export type Sidecar = Record<string, SidecarEntry>;

export const sidecarPath = (directory: string) => {
	return `${directory}/${ADDON_SIDECAR}`;
};

export const readSidecar = async (context: Bridge.Context, directory: string): Promise<Sidecar> => {
	const path = sidecarPath(directory);

	if (!(await context.files.exists(path))) {
		return {};
	}

	try {
		const parsed = JSON.parse(await context.files.read(path)) as unknown;

		return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Sidecar) : {};
	} catch {
		return {};
	}
};

export const writeSidecar = async (context: Bridge.Context, directory: string, sidecar: Sidecar) => {
	await context.files.write(sidecarPath(directory), `${JSON.stringify(sidecar, null, 2)}\n`);
};
