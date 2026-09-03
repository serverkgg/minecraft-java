import { type Bridge, BridgeFailureCode, BridgeFailureError } from "@serverkgg/bridge";
import { ServerVariant } from "../shared";
import {
	CURSEFORGE,
	CURSEFORGE_CLASS_MODS,
	CURSEFORGE_CLASS_PLUGINS,
	CURSEFORGE_GAME_ID,
	CURSEFORGE_RELEASE,
	CURSEFORGE_REQUIRED_DEPENDENCY,
	CURSEFORGE_SEARCH_CACHE_SECONDS,
	CURSEFORGE_SEARCH_CEILING,
	CURSEFORGE_SECRET,
	type CurseFiles,
	type CurseSearch,
	type CurseSingle,
	curseforgeCatalogFile,
	curseforgeRequest,
} from "./curseforgeApi";
import { AddonKind, type AddonTarget, type CatalogProvider, CatalogProviderId, type CatalogRelease } from "./provider";

const FILE_PAGE_SIZE = 50;

const CLASS_ID: Record<AddonKind, number> = {
	[AddonKind.Mod]: CURSEFORGE_CLASS_MODS,
	[AddonKind.Plugin]: CURSEFORGE_CLASS_PLUGINS,
};

const LOADER_TYPE: Partial<Record<ServerVariant, number>> = {
	[ServerVariant.Forge]: 1,
	[ServerVariant.Fabric]: 4,
	[ServerVariant.NeoForge]: 6,
};

const applyCompatibility = (url: URL, target: AddonTarget) => {
	url.searchParams.set("gameVersion", target.gameVersion);

	const loader = LOADER_TYPE[target.variant];

	if (loader !== undefined) {
		url.searchParams.set("modLoaderType", String(loader));
	}
};

const bestFile = async (context: Bridge.Context, target: AddonTarget, project: string) => {
	const url = new URL(`${CURSEFORGE}/mods/${encodeURIComponent(project)}/files`);

	applyCompatibility(url, target);
	url.searchParams.set("pageSize", String(FILE_PAGE_SIZE));

	const files = await curseforgeRequest<CurseFiles>(context, url.toString());
	const usable = files.data.filter((entry) => entry.isAvailable);

	return usable.find((entry) => entry.releaseType === CURSEFORGE_RELEASE) ?? usable.at(0) ?? null;
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
		return context.secret(CURSEFORGE_SECRET) !== null;
	},

	async search(context, target, search) {
		const index = search.page * search.pageSize;

		if (index + search.pageSize > CURSEFORGE_SEARCH_CEILING) {
			return {
				hits: [],
				total: CURSEFORGE_SEARCH_CEILING,
			};
		}

		const url = new URL(`${CURSEFORGE}/mods/search`);

		url.searchParams.set("gameId", String(CURSEFORGE_GAME_ID));
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
	},

	async resolve(context, target, project): Promise<CatalogRelease | null> {
		const details = await curseforgeRequest<CurseSingle>(context, `${CURSEFORGE}/mods/${encodeURIComponent(project)}`);
		const entry = await bestFile(context, target, project);

		if (!entry) {
			return null;
		}

		const file = curseforgeCatalogFile(entry);

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
				.filter((dependency) => dependency.relationType === CURSEFORGE_REQUIRED_DEPENDENCY)
				.map((dependency) => String(dependency.modId)),
		};
	},
};
