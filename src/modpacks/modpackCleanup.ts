import { ADDON_SIDECAR } from "../addons";
import { fileNameOf } from "../shared";

export const PACK_DIRECTORIES = [
	"mods",
	"config",
	"defaultconfigs",
	"kubejs",
	"scripts",
];

export interface ModpackCleanup {
	paths: string[];
	wholesale: boolean;
}

export const modpackCleanup = (installed: string[] | null): ModpackCleanup => {
	if (installed === null) {
		return {
			paths: PACK_DIRECTORIES,
			wholesale: true,
		};
	}

	const paths = [
		...new Set(installed.filter((path) => path.length > 0 && fileNameOf(path) !== ADDON_SIDECAR)),
	].sort();

	return {
		paths,
		wholesale: false,
	};
};
