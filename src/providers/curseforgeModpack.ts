import type { Bridge } from "@serverkgg/bridge";
import {
	CURSEFORGE_SEARCH_CEILING,
	type CurseforgeFile,
	type CurseforgeFilesPage,
	type CurseforgePagination,
	CurseforgeReleaseType,
	CurseforgeSort,
	curseforgeFallbackUrl,
	curseforgeSha1,
} from "@serverkgg/bridge/catalogs";
import {
	CURSEFORGE_CLASS_MODPACKS,
	CURSEFORGE_FILE_PAGE_SIZE,
	curseforgeCatalog,
	curseforgeCatalogFile,
	curseforgeCategoryOf,
	curseforgeSearchPage,
	curseforgeSortOf,
} from "./curseforgeApi";
import type { CatalogFile, CatalogResults, CatalogSearch, ModpackProject, ModpackRelease } from "./provider";

const MAX_FILE_PAGES = 20;

const VERSION_PATTERN = /^\d+(\.\d+)*$/;

const LOADER_TAGS = [
	"fabric",
	"forge",
	"neoforge",
	"quilt",
];

export const SERVER_PACK_CANDIDATES = 2;

export const CURSEFORGE_MODPACK_SORTS: Bridge.CatalogFacet[] = [
	{
		value: CurseforgeSort.Popularity,
		label: {
			ar: "الأكثر شهرة",
			en: "Most popular",
		},
	},
	{
		value: CurseforgeSort.TotalDownloads,
		label: {
			ar: "الأكثر تحميلًا",
			en: "Most downloaded",
		},
	},
	{
		value: CurseforgeSort.LastUpdated,
		label: {
			ar: "آخر تحديث",
			en: "Recently updated",
		},
	},
	{
		value: CurseforgeSort.Name,
		label: {
			ar: "الاسم",
			en: "Name",
		},
	},
];

export const CURSEFORGE_MODPACK_CATEGORIES: Bridge.CatalogFacet[] = [];

const modpackFileOf = (entry: CurseforgeFile): CatalogFile | null => {
	const direct = curseforgeCatalogFile(entry);

	if (direct) {
		return direct;
	}

	const sha1 = curseforgeSha1(entry);

	if (!entry.isAvailable || !sha1) {
		return null;
	}

	return {
		filename: entry.fileName,
		url: curseforgeFallbackUrl(entry.id, entry.fileName),
		sizeBytes: entry.fileLength > 0 ? entry.fileLength : null,
		digest: `sha1:${sha1}`,
	};
};

const loadersOf = (entry: CurseforgeFile): string[] => {
	const loaders: string[] = [];

	for (const tag of entry.gameVersions) {
		const lowered = tag.toLowerCase();

		if (LOADER_TAGS.includes(lowered)) {
			loaders.push(lowered);
		}
	}

	return loaders;
};

const gameVersionsOf = (entry: CurseforgeFile): string[] => {
	return entry.gameVersions.filter((tag) => VERSION_PATTERN.test(tag));
};

export const curseforgeServerPackOf = (client: CurseforgeFile, candidates: CurseforgeFile[]): CurseforgeFile | null => {
	const linked =
		typeof client.serverPackFileId === "number"
			? candidates.find((candidate) => candidate.id === client.serverPackFileId)
			: undefined;

	if (linked) {
		return linked;
	}

	return (
		candidates.find((candidate) => candidate.isServerPack === true && candidate.parentProjectFileId === client.id)
		?? null
	);
};

export const curseforgeServerPacksOf = (client: CurseforgeFile, candidates: CurseforgeFile[]): CurseforgeFile[] => {
	const wanted = gameVersionsOf(client);
	const picked: CurseforgeFile[] = [];
	const taken = new Set<number>();

	const take = (candidate: CurseforgeFile) => {
		if (taken.has(candidate.id) || !curseforgeCatalogFile(candidate)) {
			return;
		}

		taken.add(candidate.id);
		picked.push(candidate);
	};

	const linked = curseforgeServerPackOf(client, candidates);

	if (linked) {
		take(linked);
	}

	const sameVersion = candidates
		.filter((candidate) => {
			return candidate.isServerPack === true && gameVersionsOf(candidate).some((version) => wanted.includes(version));
		})
		.sort((left, right) => (right.fileDate ?? "").localeCompare(left.fileDate ?? ""));

	for (const candidate of sameVersion) {
		if (picked.length >= SERVER_PACK_CANDIDATES) {
			break;
		}

		take(candidate);
	}

	return picked;
};

const serverPackFilesOf = (entries: CurseforgeFile[]): CatalogFile[] => {
	const files: CatalogFile[] = [];

	for (const entry of entries) {
		const file = curseforgeCatalogFile(entry);

		if (file) {
			files.push(file);
		}
	}

	return files;
};

export const curseforgeReleaseOf = (
	entry: CurseforgeFile,
	serverPacks: CurseforgeFile[] = [],
): ModpackRelease | null => {
	if (!entry.isAvailable || entry.isServerPack === true) {
		return null;
	}

	const file = modpackFileOf(entry);

	if (!file) {
		return null;
	}

	return {
		versionId: String(entry.id),
		version: entry.displayName,
		stable: entry.releaseType === CurseforgeReleaseType.Release,
		loaders: loadersOf(entry),
		gameVersions: gameVersionsOf(entry),
		file,
		serverPacks: serverPackFilesOf(serverPacks),
	};
};

export const searchCurseforgeModpacks = async (
	context: Bridge.Context,
	search: CatalogSearch,
): Promise<CatalogResults> => {
	const index = search.page * search.pageSize;

	if (index + search.pageSize > CURSEFORGE_SEARCH_CEILING) {
		return {
			hits: [],
			total: CURSEFORGE_SEARCH_CEILING,
		};
	}

	const result = await curseforgeSearchPage(curseforgeCatalog(context), {
		query: search.query,
		classId: CURSEFORGE_CLASS_MODPACKS,
		sort: curseforgeSortOf(search.sort),
		index,
		pageSize: search.pageSize,
		categoryId: curseforgeCategoryOf(search.category),
	});

	return {
		hits: result.data.map((mod) => {
			return {
				id: String(mod.id),
				title: mod.name,
				description: mod.summary,
				icon: mod.logo?.thumbnailUrl ?? null,
				downloads: mod.downloadCount,
				author: mod.authors.at(0)?.name ?? null,
				categories: mod.categories.map((category) => category.name),
				updatedAt: mod.dateModified,
				pageUrl: mod.links?.websiteUrl ?? null,
			};
		}),
		total: Math.min(result.pagination.totalCount, CURSEFORGE_SEARCH_CEILING),
	};
};

export const curseforgeModpackProject = async (context: Bridge.Context, project: string): Promise<ModpackProject> => {
	const mod = await curseforgeCatalog(context).mod(project);

	return {
		id: String(mod.id),
		title: mod.name,
		icon: mod.logo?.thumbnailUrl ?? null,
		pageUrl: mod.links?.websiteUrl ?? `https://www.curseforge.com/minecraft/modpacks/${mod.slug}`,
		description: mod.summary,
		author: mod.authors.at(0)?.name ?? null,
		downloads: mod.downloadCount,
	};
};

export interface CurseforgeFilePage extends Pick<CurseforgeFilesPage, "data"> {
	pagination?: Pick<CurseforgePagination, "totalCount">;
}

export const curseforgeFilesExhausted = (collected: number, page: CurseforgeFilePage): boolean => {
	if (page.data.length === 0 || page.data.length < CURSEFORGE_FILE_PAGE_SIZE) {
		return true;
	}

	const total = page.pagination?.totalCount ?? 0;

	return total > 0 && collected >= total;
};

export const curseforgeProjectFiles = async (context: Bridge.Context, project: string): Promise<CurseforgeFile[]> => {
	const catalog = curseforgeCatalog(context);
	const files: CurseforgeFile[] = [];

	for (let page = 0; page < MAX_FILE_PAGES; page += 1) {
		const result = await catalog.modFiles(project, {
			index: page * CURSEFORGE_FILE_PAGE_SIZE,
			pageSize: CURSEFORGE_FILE_PAGE_SIZE,
		});

		files.push(...result.data);

		if (curseforgeFilesExhausted(files.length, result)) {
			break;
		}
	}

	return files;
};

export const curseforgeModpackReleases = async (
	context: Bridge.Context,
	project: string,
): Promise<ModpackRelease[]> => {
	const entries = await curseforgeProjectFiles(context, project);

	return entries
		.map((entry) => {
			return {
				entry,
				release: curseforgeReleaseOf(entry, curseforgeServerPacksOf(entry, entries)),
			};
		})
		.filter((candidate) => candidate.release !== null)
		.sort((left, right) => (right.entry.fileDate ?? "").localeCompare(left.entry.fileDate ?? ""))
		.map((candidate) => candidate.release as ModpackRelease);
};

const curseforgeServerPackEntry = async (
	context: Bridge.Context,
	project: string,
	fileId: number,
): Promise<CurseforgeFile | null> => {
	try {
		return await curseforgeCatalog(context).file(project, fileId);
	} catch (error) {
		context.log.warn("could not read the modpack author's server pack, carrying on without it", {
			project,
			fileId,
			error: error instanceof Error ? error.message : String(error),
		});

		return null;
	}
};

const curseforgeServerPackPool = async (context: Bridge.Context, project: string): Promise<CurseforgeFile[]> => {
	try {
		return await curseforgeProjectFiles(context, project);
	} catch (error) {
		context.log.warn("could not read the modpack author's other server packs, carrying on without them", {
			project,
			error: error instanceof Error ? error.message : String(error),
		});

		return [];
	}
};

export const curseforgeModpackRelease = async (
	context: Bridge.Context,
	project: string,
	fileId: string,
): Promise<ModpackRelease | null> => {
	const entry = await curseforgeCatalog(context).file(project, fileId);
	const serverPackFileId = entry.serverPackFileId;
	const linked =
		typeof serverPackFileId === "number" && serverPackFileId > 0
			? await curseforgeServerPackEntry(context, project, serverPackFileId)
			: null;
	const known =
		linked === null
			? []
			: [
					linked,
				];
	const candidates =
		curseforgeServerPacksOf(entry, known).length >= SERVER_PACK_CANDIDATES
			? known
			: [
					...known,
					...(await curseforgeServerPackPool(context, project)),
				];

	return curseforgeReleaseOf(entry, curseforgeServerPacksOf(entry, candidates));
};
