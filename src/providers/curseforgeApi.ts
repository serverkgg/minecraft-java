import type { Bridge } from "@serverkgg/bridge";
import {
	type CurseforgeCatalog,
	type CurseforgeFile,
	CurseforgeSort,
	createCurseforgeCatalog,
	curseforgeDownloadUrl,
	curseforgeSha1,
} from "@serverkgg/bridge/catalogs";
import type { CatalogFile } from "./provider";

const CURSEFORGE_GAME_ID = 432;

const CURSEFORGE_SEARCH_CACHE_SECONDS = 60;

const CURSEFORGE_PROJECT_CACHE_SECONDS = 600;

export const CURSEFORGE_CLASS_MODS = 6;

export const CURSEFORGE_CLASS_PLUGINS = 5;

export const CURSEFORGE_CLASS_MODPACKS = 4471;

export const CURSEFORGE_FILE_PAGE_SIZE = 50;

const SORTS = Object.values(CurseforgeSort);

export const curseforgeCatalog = (context: Bridge.Context): CurseforgeCatalog => {
	return createCurseforgeCatalog(context, {
		gameId: CURSEFORGE_GAME_ID,
		searchCacheSeconds: CURSEFORGE_SEARCH_CACHE_SECONDS,
		projectCacheSeconds: CURSEFORGE_PROJECT_CACHE_SECONDS,
	});
};

export const curseforgeSortOf = (value: string | null): CurseforgeSort => {
	return SORTS.find((sort) => sort === value) ?? CurseforgeSort.Popularity;
};

export const curseforgeCategoryOf = (value: string | null): number | undefined => {
	if (!value) {
		return;
	}

	const parsed = Number(value);

	return Number.isFinite(parsed) ? parsed : undefined;
};

export const curseforgeCatalogFile = (file: CurseforgeFile): CatalogFile | null => {
	if (!file.isAvailable) {
		return null;
	}

	const url = curseforgeDownloadUrl(file);

	if (!url) {
		return null;
	}

	const sha1 = curseforgeSha1(file);

	return {
		filename: file.fileName,
		url,
		sizeBytes: file.fileLength > 0 ? file.fileLength : null,
		digest: sha1 ? `sha1:${sha1}` : null,
	};
};
