import type { Bridge } from "@serverkgg/bridge";
import {
	CURSEFORGE,
	CURSEFORGE_CLASS_MODPACKS,
	CURSEFORGE_GAME_ID,
	CURSEFORGE_RELEASE,
	CURSEFORGE_SEARCH_CACHE_SECONDS,
	CURSEFORGE_SEARCH_CEILING,
	type CurseFileEntry,
	type CurseFiles,
	type CurseSearch,
	curseforgeCatalogFile,
	curseforgeFallbackUrl,
	curseforgeFile,
	curseforgeMod,
	curseforgeRequest,
	curseforgeSha1,
} from "./curseforgeApi";
import type { CatalogFile, CatalogResults, CatalogSearch, ModpackProject, ModpackRelease } from "./provider";

const FILE_PAGE_SIZE = 50;

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
		value: "2",
		label: {
			ar: "الأكثر شهرة",
			en: "Most popular",
		},
	},
	{
		value: "6",
		label: {
			ar: "الأكثر تحميلًا",
			en: "Most downloaded",
		},
	},
	{
		value: "3",
		label: {
			ar: "آخر تحديث",
			en: "Recently updated",
		},
	},
	{
		value: "4",
		label: {
			ar: "الاسم",
			en: "Name",
		},
	},
];

export const CURSEFORGE_MODPACK_CATEGORIES: Bridge.CatalogFacet[] = [];

const modpackFileOf = (entry: CurseFileEntry): CatalogFile | null => {
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

const loadersOf = (entry: CurseFileEntry): string[] => {
	const loaders: string[] = [];

	for (const tag of entry.gameVersions) {
		const lowered = tag.toLowerCase();

		if (LOADER_TAGS.includes(lowered)) {
			loaders.push(lowered);
		}
	}

	return loaders;
};

const gameVersionsOf = (entry: CurseFileEntry): string[] => {
	return entry.gameVersions.filter((tag) => VERSION_PATTERN.test(tag));
};

export const curseforgeServerPackOf = (client: CurseFileEntry, candidates: CurseFileEntry[]): CurseFileEntry | null => {
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

export const curseforgeServerPacksOf = (client: CurseFileEntry, candidates: CurseFileEntry[]): CurseFileEntry[] => {
	const wanted = gameVersionsOf(client);
	const picked: CurseFileEntry[] = [];
	const taken = new Set<number>();

	const take = (candidate: CurseFileEntry) => {
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

const serverPackFilesOf = (entries: CurseFileEntry[]): CatalogFile[] => {
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
	entry: CurseFileEntry,
	serverPacks: CurseFileEntry[] = [],
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
		stable: entry.releaseType === CURSEFORGE_RELEASE,
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

	const url = new URL(`${CURSEFORGE}/mods/search`);

	url.searchParams.set("gameId", String(CURSEFORGE_GAME_ID));
	url.searchParams.set("classId", String(CURSEFORGE_CLASS_MODPACKS));
	url.searchParams.set("searchFilter", search.query);
	url.searchParams.set("sortField", search.sort ?? "2");
	url.searchParams.set("sortOrder", "desc");
	url.searchParams.set("index", String(index));
	url.searchParams.set("pageSize", String(search.pageSize));

	if (search.category) {
		url.searchParams.set("categoryId", search.category);
	}

	const result = await curseforgeRequest<CurseSearch>(context, url.toString(), CURSEFORGE_SEARCH_CACHE_SECONDS);

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
	const mod = await curseforgeMod(context, project);

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

export const curseforgeFilesExhausted = (collected: number, page: CurseFiles): boolean => {
	if (page.data.length === 0 || page.data.length < FILE_PAGE_SIZE) {
		return true;
	}

	const total = page.pagination?.totalCount ?? 0;

	return total > 0 && collected >= total;
};

export const curseforgeProjectFiles = async (context: Bridge.Context, project: string): Promise<CurseFileEntry[]> => {
	const files: CurseFileEntry[] = [];

	for (let page = 0; page < MAX_FILE_PAGES; page += 1) {
		const url = new URL(`${CURSEFORGE}/mods/${encodeURIComponent(project)}/files`);

		url.searchParams.set("index", String(page * FILE_PAGE_SIZE));
		url.searchParams.set("pageSize", String(FILE_PAGE_SIZE));

		const result = await curseforgeRequest<CurseFiles>(context, url.toString());

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
): Promise<CurseFileEntry | null> => {
	try {
		return await curseforgeFile(context, project, String(fileId));
	} catch (error) {
		context.log.warn("could not read the modpack author's server pack, carrying on without it", {
			project,
			fileId,
			error: error instanceof Error ? error.message : String(error),
		});

		return null;
	}
};

const curseforgeServerPackPool = async (context: Bridge.Context, project: string): Promise<CurseFileEntry[]> => {
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
	const entry = await curseforgeFile(context, project, fileId);
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
