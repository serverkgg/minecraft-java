import { type Bridge, BridgeHttpMethod, BridgeNetError, BridgeSecretError } from "@serverkgg/bridge";
import { type CatalogFile, CatalogProviderId } from "./provider";
import { asRateLimit } from "./rateLimit";

export const CURSEFORGE = "https://api.curseforge.com/v1";

export const CURSEFORGE_DOWNLOAD = "https://edge.forgecdn.net";

export const CURSEFORGE_CDN_SUFFIX = ".forgecdn.net";

export const CURSEFORGE_SECRET = "CURSEFORGE_API_KEY";

export const CURSEFORGE_GAME_ID = 432;

export const CURSEFORGE_SEARCH_CEILING = 10_000;

export const CURSEFORGE_SEARCH_CACHE_SECONDS = 60;

export const CURSEFORGE_PROJECT_CACHE_SECONDS = 600;

export const CURSEFORGE_SHA1 = 1;

export const CURSEFORGE_RELEASE = 1;

export const CURSEFORGE_REQUIRED_DEPENDENCY = 3;

export const CURSEFORGE_CLASS_MODS = 6;

export const CURSEFORGE_CLASS_PLUGINS = 5;

export const CURSEFORGE_CLASS_MODPACKS = 4471;

export const CURSEFORGE_SERVER_TAG = "server";

export const CURSEFORGE_CLIENT_TAG = "client";

const BATCH = 100;

const SPLIT_ID_LENGTH = 7;

const SPLIT_ID_FOLDER = 4;

const LEGACY_ID_DIVISOR = 1000;

const REJECTED_STATUSES = [
	401,
	403,
];

export interface CurseAuthor {
	name: string;
}

export interface CurseCategory {
	name: string;
}

export interface CurseMod {
	id: number;
	classId: number | null;
	name: string;
	slug: string;
	summary: string;
	downloadCount: number;
	authors: CurseAuthor[];
	categories: CurseCategory[];
	dateModified: string | null;
	allowModDistribution: boolean | null;
	logo: {
		thumbnailUrl: string | null;
	} | null;
	links: {
		websiteUrl: string | null;
	} | null;
}

export interface CursePagination {
	totalCount: number;
}

export interface CurseSearch {
	data: CurseMod[];
	pagination: CursePagination;
}

export interface CurseHash {
	value: string;
	algo: number;
}

export interface CurseDependency {
	modId: number;
	relationType: number;
}

export interface CurseFileEntry {
	id: number;
	modId: number;
	fileName: string;
	displayName: string;
	downloadUrl: string | null;
	fileLength: number;
	fileDate: string | null;
	isAvailable: boolean;
	isServerPack?: boolean;
	serverPackFileId?: number | null;
	parentProjectFileId?: number | null;
	releaseType: number;
	gameVersions: string[];
	hashes: CurseHash[];
	dependencies: CurseDependency[];
}

export interface CurseFiles {
	data: CurseFileEntry[];
	pagination?: CursePagination;
}

export interface CurseSingleFile {
	data: CurseFileEntry;
}

export interface CurseSingle {
	data: CurseMod;
}

export interface CurseMods {
	data: CurseMod[];
}

export const curseforgeRequest = async <Result>(
	context: Bridge.Context,
	url: string,
	cacheSeconds = CURSEFORGE_PROJECT_CACHE_SECONDS,
	body?: unknown,
): Promise<Result> => {
	const key = context.secret(CURSEFORGE_SECRET);

	if (!key) {
		throw new BridgeSecretError(CURSEFORGE_SECRET, "curseforge needs an api key before it can be searched");
	}

	try {
		return await context.net.json<Result>(url, {
			headers: {
				"x-api-key": key,
			},
			cacheSeconds,
			...(body === undefined
				? {}
				: {
						body: JSON.stringify(body),
						httpMethod: BridgeHttpMethod.Post,
					}),
		});
	} catch (error) {
		if (error instanceof BridgeNetError && error.status !== null && REJECTED_STATUSES.includes(error.status)) {
			throw new BridgeSecretError(CURSEFORGE_SECRET, `curseforge rejected the configured key — ${error.message}`);
		}

		throw asRateLimit(error, CatalogProviderId.CurseForge);
	}
};

export const curseforgeFiles = async (context: Bridge.Context, fileIds: number[]): Promise<CurseFileEntry[]> => {
	const wanted = [
		...new Set(fileIds),
	].sort((left, right) => left - right);
	const files: CurseFileEntry[] = [];

	for (let cursor = 0; cursor < wanted.length; cursor += BATCH) {
		const page = await curseforgeRequest<CurseFiles>(
			context,
			`${CURSEFORGE}/mods/files`,
			CURSEFORGE_PROJECT_CACHE_SECONDS,
			{
				fileIds: wanted.slice(cursor, cursor + BATCH),
			},
		);

		files.push(...page.data);
	}

	return files;
};

export const curseforgeMods = async (context: Bridge.Context, modIds: number[]): Promise<CurseMod[]> => {
	const wanted = [
		...new Set(modIds),
	].sort((left, right) => left - right);
	const mods: CurseMod[] = [];

	for (let cursor = 0; cursor < wanted.length; cursor += BATCH) {
		const page = await curseforgeRequest<CurseMods>(context, `${CURSEFORGE}/mods`, CURSEFORGE_PROJECT_CACHE_SECONDS, {
			modIds: wanted.slice(cursor, cursor + BATCH),
		});

		mods.push(...page.data);
	}

	return mods;
};

export const curseforgeMod = async (context: Bridge.Context, modId: string): Promise<CurseMod> => {
	const single = await curseforgeRequest<CurseSingle>(context, `${CURSEFORGE}/mods/${encodeURIComponent(modId)}`);

	return single.data;
};

export const curseforgeFile = async (
	context: Bridge.Context,
	modId: string,
	fileId: string,
): Promise<CurseFileEntry> => {
	const single = await curseforgeRequest<CurseSingleFile>(
		context,
		`${CURSEFORGE}/mods/${encodeURIComponent(modId)}/files/${encodeURIComponent(fileId)}`,
	);

	return single.data;
};

export const curseforgeSha1 = (entry: CurseFileEntry) => {
	return entry.hashes.find((hash) => hash.algo === CURSEFORGE_SHA1)?.value.toLowerCase() ?? null;
};

export const curseforgeFallbackUrl = (fileId: number, fileName: string) => {
	const id = String(fileId);
	const folder =
		id.length >= SPLIT_ID_LENGTH ? id.slice(0, SPLIT_ID_FOLDER) : String(Math.floor(fileId / LEGACY_ID_DIVISOR));
	const remainder = id.length >= SPLIT_ID_LENGTH ? id.slice(SPLIT_ID_FOLDER) : id;

	return `${CURSEFORGE_DOWNLOAD}/files/${folder}/${remainder}/${encodeURIComponent(fileName)}`;
};

const curseforgePathSegment = (segment: string): string => {
	return encodeURIComponent(decodeURIComponent(segment));
};

export const curseforgeDownloadUrl = (entry: CurseFileEntry): string | null => {
	if (!entry.downloadUrl || !URL.canParse(entry.downloadUrl)) {
		return null;
	}

	const remote = new URL(entry.downloadUrl);

	if (remote.protocol !== "https:" || !remote.hostname.endsWith(CURSEFORGE_CDN_SUFFIX)) {
		return null;
	}

	try {
		return `${remote.origin}${remote.pathname.split("/").map(curseforgePathSegment).join("/")}`;
	} catch {
		return null;
	}
};

export const curseforgeCatalogFile = (entry: CurseFileEntry): CatalogFile | null => {
	if (!entry.isAvailable) {
		return null;
	}

	const url = curseforgeDownloadUrl(entry);

	if (!url) {
		return null;
	}

	const sha1 = curseforgeSha1(entry);

	return {
		filename: entry.fileName,
		url,
		sizeBytes: entry.fileLength > 0 ? entry.fileLength : null,
		digest: sha1 ? `sha1:${sha1}` : null,
	};
};

export const isCurseforgeServerFile = (entry: CurseFileEntry) => {
	let client = false;

	for (const tag of entry.gameVersions) {
		const lowered = tag.toLowerCase();

		if (lowered === CURSEFORGE_SERVER_TAG) {
			return true;
		}

		if (lowered === CURSEFORGE_CLIENT_TAG) {
			client = true;
		}
	}

	return !client;
};
