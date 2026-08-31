import {
	type Bridge,
	BridgeFailureCode,
	BridgeFailureError,
	BridgeNetError,
	BridgeSecretError,
} from "@serverkgg/bridge";
import { ServerVariant } from "../shared";
import {
	AddonKind,
	type AddonTarget,
	type CatalogFile,
	type CatalogProvider,
	CatalogProviderId,
	type CatalogRelease,
} from "./provider";
import { asRateLimit } from "./rateLimit";

const SEARCH_CACHE_SECONDS = 60;

const PROJECT_CACHE_SECONDS = 600;

const CURSEFORGE = "https://api.curseforge.com/v1";

const CDN_SUFFIX = ".forgecdn.net";

const SECRET = "CURSEFORGE_API_KEY";

const GAME_ID = 432;

const SEARCH_CEILING = 10_000;

const SHA1 = 1;

const RELEASE = 1;

const FILE_PAGE_SIZE = 50;

const REQUIRED_DEPENDENCY = 3;

const REJECTED_STATUSES = [
	401,
	403,
];

const CLASS_ID: Record<AddonKind, number> = {
	[AddonKind.Mod]: 6,
	[AddonKind.Plugin]: 5,
};

const LOADER_TYPE: Partial<Record<ServerVariant, number>> = {
	[ServerVariant.Forge]: 1,
	[ServerVariant.Fabric]: 4,
	[ServerVariant.NeoForge]: 6,
};

interface CurseAuthor {
	name: string;
}

interface CurseCategory {
	name: string;
}

interface CurseMod {
	id: number;
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

interface CurseSearch {
	data: CurseMod[];
	pagination: {
		totalCount: number;
	};
}

interface CurseHash {
	value: string;
	algo: number;
}

interface CurseDependency {
	modId: number;
	relationType: number;
}

interface CurseFileEntry {
	fileName: string;
	displayName: string;
	downloadUrl: string | null;
	fileLength: number;
	isAvailable: boolean;
	releaseType: number;
	hashes: CurseHash[];
	dependencies: CurseDependency[];
}

interface CurseFiles {
	data: CurseFileEntry[];
}

interface CurseSingle {
	data: CurseMod;
}

const request = async <Result>(
	context: Bridge.Context,
	url: string,
	cacheSeconds = PROJECT_CACHE_SECONDS,
): Promise<Result> => {
	const key = context.secret(SECRET);

	if (!key) {
		throw new BridgeSecretError(SECRET, "curseforge needs an api key before it can be searched");
	}

	try {
		return await context.net.json<Result>(url, {
			headers: {
				"x-api-key": key,
			},
			cacheSeconds,
		});
	} catch (error) {
		if (error instanceof BridgeNetError && error.status !== null && REJECTED_STATUSES.includes(error.status)) {
			throw new BridgeSecretError(SECRET, `curseforge rejected the configured key — ${error.message}`);
		}

		throw asRateLimit(error, CatalogProviderId.CurseForge);
	}
};

const applyCompatibility = (url: URL, target: AddonTarget) => {
	url.searchParams.set("gameVersion", target.gameVersion);

	const loader = LOADER_TYPE[target.variant];

	if (loader !== undefined) {
		url.searchParams.set("modLoaderType", String(loader));
	}
};

const fileOf = (entry: CurseFileEntry): CatalogFile | null => {
	if (!entry.isAvailable || !entry.downloadUrl || !URL.canParse(entry.downloadUrl)) {
		return null;
	}

	if (!new URL(entry.downloadUrl).hostname.endsWith(CDN_SUFFIX)) {
		return null;
	}

	const sha1 = entry.hashes.find((hash) => hash.algo === SHA1)?.value;

	return {
		filename: entry.fileName,
		url: entry.downloadUrl,
		sizeBytes: entry.fileLength > 0 ? entry.fileLength : null,
		digest: sha1 ? `sha1:${sha1}` : null,
	};
};

const bestFile = async (context: Bridge.Context, target: AddonTarget, project: string) => {
	const url = new URL(`${CURSEFORGE}/mods/${encodeURIComponent(project)}/files`);

	applyCompatibility(url, target);
	url.searchParams.set("pageSize", String(FILE_PAGE_SIZE));

	const files = await request<CurseFiles>(context, url.toString());
	const usable = files.data.filter((entry) => entry.isAvailable);

	return usable.find((entry) => entry.releaseType === RELEASE) ?? usable.at(0) ?? null;
};

export const curseForgeProvider: CatalogProvider = {
	id: CatalogProviderId.CurseForge,

	label: {
		ar: "كيرس فورج",
		en: "CurseForge",
	},

	note: {
		ar: "كيرس فورج مو متاح الحين. لازم الأدمن يضبط مفتاح CurseForge.",
		en: "CurseForge is unavailable. An administrator needs to set the CurseForge key.",
	},

	sorts: [
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
	],

	categories(target) {
		if (target.kind === AddonKind.Plugin) {
			return [
				{
					value: "115",
					label: {
						ar: "أدوات الأدمن",
						en: "Admin tools",
					},
				},
				{
					value: "116",
					label: {
						ar: "حماية من التخريب",
						en: "Anti-griefing",
					},
				},
				{
					value: "117",
					label: {
						ar: "الشات",
						en: "Chat",
					},
				},
				{
					value: "123",
					label: {
						ar: "اقتصاد",
						en: "Economy",
					},
				},
				{
					value: "126",
					label: {
						ar: "تسلية",
						en: "Fun",
					},
				},
				{
					value: "124",
					label: {
						ar: "إدارة الماب",
						en: "World management",
					},
				},
				{
					value: "134",
					label: {
						ar: "تنقّل",
						en: "Teleportation",
					},
				},
			];
		}

		return [
			{
				value: "435",
				label: {
					ar: "أدوات السيرفر",
					en: "Server utility",
				},
			},
			{
				value: "434",
				label: {
					ar: "عتاد وأسلحة",
					en: "Armor and weapons",
				},
			},
			{
				value: "410",
				label: {
					ar: "أبعاد",
					en: "Dimensions",
				},
			},
			{
				value: "407",
				label: {
					ar: "بيئات",
					en: "Biomes",
				},
			},
			{
				value: "416",
				label: {
					ar: "زراعة",
					en: "Farming",
				},
			},
			{
				value: "6821",
				label: {
					ar: "إصلاح مشاكل",
					en: "Bug fixes",
				},
			},
			{
				value: "421",
				label: {
					ar: "مكتبات",
					en: "Libraries",
				},
			},
		];
	},

	supports(target) {
		return target.kind === AddonKind.Plugin || LOADER_TYPE[target.variant] !== undefined;
	},

	ready(context) {
		return context.secret(SECRET) !== null;
	},

	async search(context, target, search) {
		const index = search.page * search.pageSize;

		if (index + search.pageSize > SEARCH_CEILING) {
			return {
				hits: [],
				total: SEARCH_CEILING,
			};
		}

		const url = new URL(`${CURSEFORGE}/mods/search`);

		url.searchParams.set("gameId", String(GAME_ID));
		url.searchParams.set("classId", String(CLASS_ID[target.kind]));

		applyCompatibility(url, target);

		url.searchParams.set("searchFilter", search.query);
		url.searchParams.set("sortField", search.sort ?? "2");
		url.searchParams.set("sortOrder", "desc");
		url.searchParams.set("index", String(index));
		url.searchParams.set("pageSize", String(search.pageSize));

		if (search.category) {
			url.searchParams.set("categoryId", search.category);
		}

		const result = await request<CurseSearch>(context, url.toString(), SEARCH_CACHE_SECONDS);

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
			total: Math.min(result.pagination.totalCount, SEARCH_CEILING),
		};
	},

	async resolve(context, target, project): Promise<CatalogRelease | null> {
		const details = await request<CurseSingle>(context, `${CURSEFORGE}/mods/${encodeURIComponent(project)}`);
		const entry = await bestFile(context, target, project);

		if (!entry) {
			return null;
		}

		const file = fileOf(entry);

		if (!file) {
			if (details.data.allowModDistribution === false) {
				throw new BridgeFailureError(
					BridgeFailureCode.CatalogRestricted,
					`"${details.data.name}" does not allow downloads outside curseforge`,
				);
			}

			return null;
		}

		return {
			title: details.data.name,
			version: entry.displayName,
			icon: details.data.logo?.thumbnailUrl ?? null,
			pageUrl: details.data.links?.websiteUrl ?? null,
			gameVersions: null,
			loaders: null,
			serverSide: null,
			file,
			dependencies: entry.dependencies
				.filter((dependency) => dependency.relationType === REQUIRED_DEPENDENCY)
				.map((dependency) => String(dependency.modId)),
		};
	},
};
