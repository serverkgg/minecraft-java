import type { Bridge } from "@serverkgg/bridge";
import {
	type CurseforgeCatalog,
	type CurseforgeFile,
	type CurseforgeSearchPage,
	type CurseforgeSearchQuery,
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

const CURSEFORGE_HOST_SUFFIX = "curseforge.com";

const SLUG_SEPARATOR = "-";

const WORD_SEPARATOR = " ";

const WORD_BREAK = /\s+/;

const WORD_EDGE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

const NUMBER_ONLY = /^[\d.]+$/;

const RELAXED_WORDS = 5;

const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"in",
	"of",
	"the",
	"to",
]);

const curseforgePageSlug = (text: string) => {
	if (!URL.canParse(text)) {
		return null;
	}

	const remote = new URL(text);

	if (!remote.hostname.endsWith(CURSEFORGE_HOST_SUFFIX)) {
		return null;
	}

	const segments = remote.pathname.split("/").filter((segment) => segment.length > 0);
	const files = segments.indexOf("files");

	return (files > 0 ? segments.at(files - 1) : segments.at(-1)) ?? null;
};

export const curseforgeSearchText = (query: string) => {
	const text = query.trim();
	const slug = curseforgePageSlug(text);

	return slug === null ? text : slug.split(SLUG_SEPARATOR).join(WORD_SEPARATOR);
};

export const curseforgeRelaxedQuery = (text: string) => {
	return text
		.split(WORD_BREAK)
		.map((word) => word.replace(WORD_EDGE, ""))
		.filter((word) => word.length > 0 && !STOP_WORDS.has(word.toLowerCase()) && !NUMBER_ONLY.test(word))
		.slice(0, RELAXED_WORDS)
		.join(WORD_SEPARATOR);
};

export const curseforgeSearchPage = async (
	catalog: Pick<CurseforgeCatalog, "search">,
	query: CurseforgeSearchQuery,
): Promise<CurseforgeSearchPage> => {
	const text = curseforgeSearchText(query.query ?? "");
	const page = await catalog.search({
		...query,
		query: text,
	});
	const relaxed = curseforgeRelaxedQuery(text);

	if (page.data.length > 0 || (query.index ?? 0) > 0 || relaxed.length === 0 || relaxed === text) {
		return page;
	}

	return await catalog.search({
		...query,
		query: relaxed,
	});
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
