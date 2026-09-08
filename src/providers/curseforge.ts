import { type Bridge, BridgeFailureCode, BridgeFailureError } from "@serverkgg/bridge";
import {
	CURSEFORGE_SEARCH_CEILING,
	CURSEFORGE_SECRET,
	CurseforgeDependency,
	CurseforgeReleaseType,
	CurseforgeSort,
} from "@serverkgg/bridge/catalogs";
import { ServerVariant } from "../shared";
import {
	CURSEFORGE_CLASS_MODS,
	CURSEFORGE_CLASS_PLUGINS,
	CURSEFORGE_FILE_PAGE_SIZE,
	curseforgeCatalog,
	curseforgeCatalogFile,
	curseforgeCategoryOf,
	curseforgeSortOf,
} from "./curseforgeApi";
import { AddonKind, type AddonTarget, type CatalogProvider, CatalogProviderId, type CatalogRelease } from "./provider";

const CLASS_ID: Record<AddonKind, number> = {
	[AddonKind.Mod]: CURSEFORGE_CLASS_MODS,
	[AddonKind.Plugin]: CURSEFORGE_CLASS_PLUGINS,
};

const LOADER_TYPE: Partial<Record<ServerVariant, number>> = {
	[ServerVariant.Forge]: 1,
	[ServerVariant.Fabric]: 4,
	[ServerVariant.NeoForge]: 6,
};

const bestFile = async (context: Bridge.Context, target: AddonTarget, project: string) => {
	const files = await curseforgeCatalog(context).modFiles(project, {
		gameVersion: target.gameVersion,
		modLoaderType: LOADER_TYPE[target.variant],
		pageSize: CURSEFORGE_FILE_PAGE_SIZE,
	});
	const usable = files.data.filter((entry) => entry.isAvailable);

	return usable.find((entry) => entry.releaseType === CurseforgeReleaseType.Release) ?? usable.at(0) ?? null;
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

		const result = await curseforgeCatalog(context).search({
			query: search.query,
			classId: CLASS_ID[target.kind],
			gameVersion: target.gameVersion,
			modLoaderType: LOADER_TYPE[target.variant],
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
	},

	async resolve(context, target, project): Promise<CatalogRelease | null> {
		const details = await curseforgeCatalog(context).mod(project);
		const entry = await bestFile(context, target, project);

		if (!entry) {
			return null;
		}

		const file = curseforgeCatalogFile(entry);

		if (!file) {
			if (details.allowModDistribution === false) {
				throw new BridgeFailureError(
					BridgeFailureCode.CatalogRestricted,
					`"${details.name}" does not allow downloads outside curseforge`,
				);
			}

			return null;
		}

		return {
			title: details.name,
			version: entry.displayName,
			icon: details.logo?.thumbnailUrl ?? null,
			pageUrl: details.links?.websiteUrl ?? null,
			gameVersions: null,
			loaders: null,
			serverSide: null,
			file,
			dependencies: entry.dependencies
				.filter((dependency) => dependency.relationType === CurseforgeDependency.Required)
				.map((dependency) => String(dependency.modId)),
		};
	},
};
