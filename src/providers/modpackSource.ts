import type { Bridge } from "@serverkgg/bridge";
import { CURSEFORGE_SECRET } from "@serverkgg/bridge/catalogs";
import { curseForgeProvider } from "./curseforge";
import {
	CURSEFORGE_MODPACK_CATEGORIES,
	CURSEFORGE_MODPACK_SORTS,
	curseforgeModpackProject,
	curseforgeModpackRelease,
	curseforgeModpackReleases,
	searchCurseforgeModpacks,
} from "./curseforgeModpack";
import { modrinthProvider } from "./modrinth";
import {
	MODPACK_CATEGORIES,
	MODPACK_SORTS,
	modpackProject,
	modpackRelease,
	modpackReleases,
	searchModpacks,
} from "./modrinthModpack";
import {
	CatalogProviderId,
	type CatalogResults,
	type CatalogSearch,
	type ModpackProject,
	type ModpackRelease,
} from "./provider";

export interface ModpackSource {
	id: CatalogProviderId;
	label: Bridge.Text;
	note: Bridge.Text;
	sorts: Bridge.CatalogFacet[];
	categories: Bridge.CatalogFacet[];
	ready(context: Bridge.Context): boolean;
	search(context: Bridge.Context, search: CatalogSearch): Promise<CatalogResults>;
	project(context: Bridge.Context, project: string): Promise<ModpackProject>;
	releases(context: Bridge.Context, project: string): Promise<ModpackRelease[]>;
	release(context: Bridge.Context, project: string, versionId: string): Promise<ModpackRelease | null>;
}

const modrinthSource: ModpackSource = {
	id: CatalogProviderId.Modrinth,
	label: modrinthProvider.label,
	note: modrinthProvider.note,
	sorts: MODPACK_SORTS,
	categories: MODPACK_CATEGORIES,

	ready() {
		return true;
	},

	async search(context, search) {
		return await searchModpacks(context, search);
	},

	async project(context, project) {
		return await modpackProject(context, project);
	},

	async releases(context, project) {
		return await modpackReleases(context, project);
	},

	async release(context, _project, versionId) {
		return await modpackRelease(context, versionId);
	},
};

const curseforgeSource: ModpackSource = {
	id: CatalogProviderId.CurseForge,
	label: curseForgeProvider.label,
	note: curseForgeProvider.note,
	sorts: CURSEFORGE_MODPACK_SORTS,
	categories: CURSEFORGE_MODPACK_CATEGORIES,

	ready(context) {
		return context.secret(CURSEFORGE_SECRET) !== null;
	},

	async search(context, search) {
		return await searchCurseforgeModpacks(context, search);
	},

	async project(context, project) {
		return await curseforgeModpackProject(context, project);
	},

	async releases(context, project) {
		return await curseforgeModpackReleases(context, project);
	},

	async release(context, project, versionId) {
		return await curseforgeModpackRelease(context, project, versionId);
	},
};

const MODPACK_SOURCES: ModpackSource[] = [
	modrinthSource,
	curseforgeSource,
];

export const modpackSources = () => {
	return [
		...MODPACK_SOURCES,
	];
};

export const modpackSourceById = (id: string | null) => {
	return MODPACK_SOURCES.find((source) => source.id === id) ?? modrinthSource;
};
