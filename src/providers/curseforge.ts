import { type Bridge, BridgeFailureCode, BridgeFailureError } from "@serverkgg/bridge";
import {
	CURSEFORGE_SEARCH_CEILING,
	CURSEFORGE_SECRET,
	CurseforgeDependency,
	type CurseforgeFileIndex,
	type CurseforgeMod,
	CurseforgeModLoader,
	CurseforgeReleaseType,
	CurseforgeSort,
} from "@serverkgg/bridge/catalogs";
import { ServerVariant, VARIANT_LABELS } from "../shared";
import {
	CURSEFORGE_CLASS_MODS,
	CURSEFORGE_CLASS_PLUGINS,
	CURSEFORGE_FILE_PAGE_SIZE,
	CurseforgeLinkOutcome,
	type CurseforgeSearchOutcome,
	curseforgeCatalog,
	curseforgeCatalogFile,
	curseforgeCategoryOf,
	curseforgeSearchPage,
	curseforgeSortOf,
} from "./curseforgeApi";
import {
	AddonKind,
	type AddonTarget,
	type AddonUpdates,
	type CatalogProvider,
	CatalogProviderId,
	type CatalogRelease,
	type TrackedAddon,
} from "./provider";

const CLASS_ID: Record<AddonKind, number> = {
	[AddonKind.Mod]: CURSEFORGE_CLASS_MODS,
	[AddonKind.Plugin]: CURSEFORGE_CLASS_PLUGINS,
};

const LOADER_TYPE: Partial<Record<ServerVariant, CurseforgeModLoader>> = {
	[ServerVariant.Forge]: CurseforgeModLoader.Forge,
	[ServerVariant.Fabric]: CurseforgeModLoader.Fabric,
	[ServerVariant.NeoForge]: CurseforgeModLoader.NeoForge,
};

const RELEASE_PREFERENCE = [
	CurseforgeReleaseType.Release,
	CurseforgeReleaseType.Beta,
	CurseforgeReleaseType.Alpha,
];

const JAR_EXTENSION = /\.jar$/i;

const compatibleFiles = async (context: Bridge.Context, target: AddonTarget, project: string) => {
	const files = await curseforgeCatalog(context).modFiles(project, {
		gameVersion: target.gameVersion,
		modLoaderType: LOADER_TYPE[target.variant],
		pageSize: CURSEFORGE_FILE_PAGE_SIZE,
	});
	const usable = files.data.filter((entry) => entry.isAvailable);

	return usable;
};

const latestCurseforgeIndex = (
	indexes: CurseforgeFileIndex[],
	gameVersion: string,
	loader: CurseforgeModLoader | undefined,
): CurseforgeFileIndex | null => {
	const matching = indexes.filter((index) => {
		return index.gameVersion === gameVersion && (loader === undefined || index.modLoader === loader);
	});

	for (const releaseType of RELEASE_PREFERENCE) {
		const newest = matching
			.filter((index) => index.releaseType === releaseType)
			.sort((left, right) => right.fileId - left.fileId)
			.at(0);

		if (newest) {
			return newest;
		}
	}

	return null;
};

const curseforgeBehind = (addon: TrackedAddon, latest: CurseforgeFileIndex) => {
	if (addon.versionId === null) {
		return latest.filename !== addon.filename;
	}

	if (String(latest.fileId) === addon.versionId) {
		return false;
	}

	return addon.stale || latest.fileId > Number(addon.versionId);
};

const curseforgeVersionLabel = (mod: CurseforgeMod, latest: CurseforgeFileIndex) => {
	return (
		mod.latestFiles?.find((file) => file.id === latest.fileId)?.displayName
		?? latest.filename.replace(JAR_EXTENSION, "")
	);
};

const incompatibleNote = (name: string, target: AddonTarget): Bridge.Text => {
	const server = `${VARIANT_LABELS[target.variant]} ${target.gameVersion}`;

	if (target.kind === AddonKind.Plugin) {
		return {
			ar: `لا يوجد لإضافة ${name} على CurseForge ملف متوافق مع ${server}. اختر من تبويب الإصدار إصدارًا تدعمه، أو اطلب من صاحبها ملفًا يناسب سيرفرك.`,
			en: `${name} has no file on CurseForge for ${server}. Pick a version it supports from the Version tab, or ask its author for a file that fits your server.`,
		};
	}

	return {
		ar: `لا يوجد لمود ${name} على CurseForge ملف متوافق مع ${server}. اختر من تبويب الإصدار إصدارًا يدعمه، أو اطلب من صاحبه ملفًا يناسب سيرفرك.`,
		en: `${name} has no file on CurseForge for ${server}. Pick a version it supports from the Version tab, or ask its author for a file that fits your server.`,
	};
};

const unlistedNote = (target: AddonTarget): Bridge.Text => {
	if (target.kind === AddonKind.Plugin) {
		return {
			ar: `لا تظهر هذه الإضافة في بحث CurseForge. يحدث ذلك حين تكون كل ملفاتها من نوع Alpha، أو حين لم يوافق عليها CurseForge بعد، أو حين يكون الرابط غير صحيح. إذا فُتحت صفحتها في المتصفح، فنزّل الملف منها وارفعه من تبويب الملفات إلى مجلد ${target.directory}، ثم نفّذ ريستارت لسيرفرك.`,
			en: `CurseForge's search doesn't return this plugin. That happens when all its files are Alpha, when CurseForge hasn't approved it yet, or when the link is wrong. If its page opens in your browser, download the file from the page, upload it to the ${target.directory} folder from the Files tab, then restart your server.`,
		};
	}

	return {
		ar: `لا يظهر هذا المود في بحث CurseForge. يحدث ذلك حين تكون كل ملفاته من نوع Alpha، أو حين لم يوافق عليه CurseForge بعد، أو حين يكون الرابط غير صحيح. إذا فُتحت صفحته في المتصفح، فنزّل الملف منها وارفعه من تبويب الملفات إلى مجلد ${target.directory}، ثم نفّذ ريستارت لسيرفرك.`,
		en: `CurseForge's search doesn't return this mod. That happens when all its files are Alpha, when CurseForge hasn't approved it yet, or when the link is wrong. If its page opens in your browser, download the file from the page, upload it to the ${target.directory} folder from the Files tab, then restart your server.`,
	};
};

const noteOf = (outcome: CurseforgeSearchOutcome, target: AddonTarget): Bridge.Text => {
	return outcome.kind === CurseforgeLinkOutcome.Incompatible
		? incompatibleNote(outcome.name, target)
		: unlistedNote(target);
};

export const curseForgeProvider: CatalogProvider = {
	id: CatalogProviderId.CurseForge,

	label: {
		ar: "CurseForge",
		en: "CurseForge",
	},

	note: {
		ar: "CurseForge غير متاح حاليًا، ويلزم أن يضبط فريق سيرفرك مفتاح CurseForge.",
		en: "CurseForge isn't available right now. The Serverk team needs to set the CurseForge key.",
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
				ar: "الأكثر تنزيلًا",
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

		const { page, outcome } = await curseforgeSearchPage(curseforgeCatalog(context), {
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
			hits: page.data.map((mod) => {
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
			total: Math.min(page.pagination.totalCount, CURSEFORGE_SEARCH_CEILING),
			...(outcome
				? {
						note: noteOf(outcome, target),
					}
				: {}),
		};
	},

	async releases(context, target, project) {
		return (await compatibleFiles(context, target, project)).map((file) => ({
			id: String(file.id),
			label: file.displayName,
			gameVersion: target.gameVersion,
		}));
	},

	async resolve(context, target, project, versionId): Promise<CatalogRelease | null> {
		const details = await curseforgeCatalog(context).mod(project);
		const files = await compatibleFiles(context, target, project);
		const entry = versionId
			? files.find((file) => String(file.id) === versionId)
			: (files.find((file) => file.releaseType === CurseforgeReleaseType.Release) ?? files.at(0));

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
			versionId: String(entry.id),
			icon: details.logo?.thumbnailUrl ?? null,
			pageUrl: details.links?.websiteUrl ?? null,
			gameVersions: null,
			loaders: null,
			serverSide: null,
			file,
			dependencies: entry.dependencies
				.filter((dependency) => dependency.relationType === CurseforgeDependency.Required)
				.map((dependency) => ({
					project: String(dependency.modId),
					version: null,
					kind: "required",
				})),
		};
	},

	async updates(context, target, tracked): Promise<AddonUpdates> {
		const ids = tracked.map((addon) => Number(addon.project)).filter((id) => Number.isInteger(id));
		const mods = await curseforgeCatalog(context).mods(ids);
		const updates: AddonUpdates = new Map();

		for (const addon of tracked) {
			const mod = mods.find((candidate) => String(candidate.id) === addon.project);
			const latest = mod
				? latestCurseforgeIndex(mod.latestFilesIndexes ?? [], target.gameVersion, LOADER_TYPE[target.variant])
				: null;

			if (mod && latest && curseforgeBehind(addon, latest)) {
				updates.set(addon.filename, {
					version: curseforgeVersionLabel(mod, latest),
					releaseId: String(latest.fileId),
				});
			}
		}

		return updates;
	},
};
