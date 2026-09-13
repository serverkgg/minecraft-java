import type { Bridge } from "@serverkgg/bridge";
import { ServerVariant } from "../shared";

export enum AddonKind {
	Mod = "mod",
	Plugin = "plugin",
}

export interface AddonTarget {
	kind: AddonKind;
	variant: ServerVariant;
	gameVersion: string;
	directory: string;
}

const PLUGIN_LOADERS = [
	"paper",
	"spigot",
	"bukkit",
	"purpur",
	"folia",
];

export const targetLoaders = (target: AddonTarget) => {
	return target.kind === AddonKind.Mod
		? [
				target.variant === ServerVariant.NeoForge ? "neoforge" : target.variant,
			]
		: PLUGIN_LOADERS;
};

export enum CatalogProviderId {
	CurseForge = "curseforge",
	Hangar = "hangar",
	Modrinth = "modrinth",
}

export interface CatalogFile {
	filename: string;
	url: string;
	sizeBytes: number | null;
	digest: string | null;
}

export interface CatalogDependency {
	project: string;
	version: string | null;
	kind: string;
}

export interface CatalogRelease {
	versionId?: string;
	title: string;
	version: string;
	icon: string | null;
	pageUrl: string | null;
	gameVersions: string[] | null;
	loaders: string[] | null;
	serverSide: string | null;
	file: CatalogFile;
	dependencies: CatalogDependency[];
}

export interface CatalogSearch {
	query: string;
	page: number;
	pageSize: number;
	category: string | null;
	sort: string | null;
}

export interface ModpackProject {
	id: string;
	title: string;
	icon: string | null;
	pageUrl: string;
	description: string | null;
	author: string | null;
	downloads: number | null;
}

export interface ModpackRelease {
	versionId: string;
	version: string;
	stable: boolean;
	loaders: string[];
	gameVersions: string[];
	file: CatalogFile;
	serverPacks: CatalogFile[];
}

export interface CatalogResults {
	hits: Omit<Bridge.CatalogHit, "provider">[];
	total: number;
}

export interface CatalogProvider {
	id: CatalogProviderId;
	label: Bridge.Text;
	note: Bridge.Text;
	sorts: Bridge.CatalogFacet[];
	categories(target: AddonTarget): Bridge.CatalogFacet[];
	supports(target: AddonTarget): boolean;
	ready(context: Bridge.Context): boolean;
	search(context: Bridge.Context, target: AddonTarget, search: CatalogSearch): Promise<CatalogResults>;
	releases?(
		context: Bridge.Context,
		target: AddonTarget,
		project: string,
	): Promise<
		{
			id: string;
			label: string;
			gameVersion?: string;
		}[]
	>;
	resolve(
		context: Bridge.Context,
		target: AddonTarget,
		project: string,
		version?: string | null,
	): Promise<CatalogRelease | null>;
}
