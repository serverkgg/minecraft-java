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
import { type CatalogFile, CatalogProviderId } from "./provider";
import { providerOfLink } from "./providerLink";

const CURSEFORGE_GAME_ID = 432;

const CURSEFORGE_SEARCH_CACHE_SECONDS = 60;

const CURSEFORGE_PROJECT_CACHE_SECONDS = 600;

export const CURSEFORGE_CLASS_MODS = 6;

export const CURSEFORGE_CLASS_PLUGINS = 5;

export const CURSEFORGE_CLASS_MODPACKS = 4471;

export const CURSEFORGE_FILE_PAGE_SIZE = 50;

const LISTED_PROBE_PAGE_SIZE = 1;

const CLASS_SEGMENTS: Record<number, string> = {
	[CURSEFORGE_CLASS_MODS]: "mc-mods",
	[CURSEFORGE_CLASS_PLUGINS]: "bukkit-plugins",
	[CURSEFORGE_CLASS_MODPACKS]: "modpacks",
};

const SORTS = Object.values(CurseforgeSort);

export enum CurseforgeLinkOutcome {
	Incompatible = "incompatible",
	Unlisted = "unlisted",
}

export type CurseforgeSearchOutcome =
	| {
			kind: CurseforgeLinkOutcome.Incompatible;
			name: string;
	  }
	| {
			kind: CurseforgeLinkOutcome.Unlisted;
			name: null;
	  };

export interface CurseforgeSearchResult {
	page: CurseforgeSearchPage;
	outcome: CurseforgeSearchOutcome | null;
}

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

export const curseforgeLinkSlug = (text: string, classId: number | undefined): string | null => {
	const link = text.trim();

	if (classId === undefined || providerOfLink(link) !== CatalogProviderId.CurseForge) {
		return null;
	}

	const [, segment, slug] = new URL(link).pathname.split("/").filter((part) => part.length > 0);

	return segment !== undefined && segment === CLASS_SEGMENTS[classId] && slug !== undefined ? slug : null;
};

export const curseforgeRelaxedQuery = (text: string) => {
	return text
		.split(WORD_BREAK)
		.map((word) => word.replace(WORD_EDGE, ""))
		.filter((word) => word.length > 0 && !STOP_WORDS.has(word.toLowerCase()) && !NUMBER_ONLY.test(word))
		.slice(0, RELAXED_WORDS)
		.join(WORD_SEPARATOR);
};

const emptySearchPage = (query: CurseforgeSearchQuery): CurseforgeSearchPage => {
	return {
		data: [],
		pagination: {
			index: query.index ?? 0,
			pageSize: query.pageSize ?? 0,
			resultCount: 0,
			totalCount: 0,
		},
	};
};

const curseforgeLinkPage = async (
	catalog: Pick<CurseforgeCatalog, "search">,
	query: CurseforgeSearchQuery,
	slug: string,
): Promise<CurseforgeSearchResult> => {
	if ((query.index ?? 0) > 0) {
		return {
			page: emptySearchPage(query),
			outcome: null,
		};
	}

	const page = await catalog.search({
		slug,
		classId: query.classId,
		gameVersion: query.gameVersion,
		modLoaderType: query.modLoaderType,
		pageSize: query.pageSize,
	});

	if (page.data.length > 0) {
		return {
			page,
			outcome: null,
		};
	}

	const listed = await catalog.search({
		slug,
		classId: query.classId,
		pageSize: LISTED_PROBE_PAGE_SIZE,
	});
	const project = listed.data.at(0);

	return {
		page,
		outcome: project
			? {
					kind: CurseforgeLinkOutcome.Incompatible,
					name: project.name,
				}
			: {
					kind: CurseforgeLinkOutcome.Unlisted,
					name: null,
				},
	};
};

export const curseforgeSearchPage = async (
	catalog: Pick<CurseforgeCatalog, "search">,
	query: CurseforgeSearchQuery,
): Promise<CurseforgeSearchResult> => {
	const slug = curseforgeLinkSlug(query.query ?? "", query.classId);

	if (slug !== null) {
		return await curseforgeLinkPage(catalog, query, slug);
	}

	const text = curseforgeSearchText(query.query ?? "");
	const page = await catalog.search({
		...query,
		query: text,
	});
	const relaxed = curseforgeRelaxedQuery(text);

	if (page.data.length > 0 || (query.index ?? 0) > 0 || relaxed.length === 0 || relaxed === text) {
		return {
			page,
			outcome: null,
		};
	}

	return {
		page: await catalog.search({
			...query,
			query: relaxed,
		}),
		outcome: null,
	};
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
