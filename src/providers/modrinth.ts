import type { Bridge } from "@serverkgg/bridge";
import {
	MODRINTH,
	MODRINTH_SEARCH_CACHE_SECONDS,
	type ModrinthProject,
	type ModrinthSearch,
	type ModrinthVersion,
	modrinthFile,
	modrinthRequest,
} from "./modrinthApi";
import {
	AddonKind,
	type AddonTarget,
	type CatalogProvider,
	CatalogProviderId,
	type CatalogRelease,
	type CatalogResults,
	targetLoaders,
} from "./provider";

const versionFor = async (context: Bridge.Context, target: AddonTarget, project: string) => {
	const url = new URL(`${MODRINTH}/project/${encodeURIComponent(project)}/version`);

	url.searchParams.set("loaders", JSON.stringify(targetLoaders(target)));
	url.searchParams.set(
		"game_versions",
		JSON.stringify([
			target.gameVersion,
		]),
	);

	const versions = await modrinthRequest<ModrinthVersion[]>(context, url.toString());

	return versions.find((version) => version.version_type === "release") ?? versions.at(0) ?? null;
};

export const modrinthLoaderRelease = async (
	context: Bridge.Context,
	project: string,
	loader: string,
	gameVersion: string | null,
): Promise<CatalogRelease | null> => {
	const url = new URL(`${MODRINTH}/project/${encodeURIComponent(project)}/version`);

	url.searchParams.set(
		"loaders",
		JSON.stringify([
			loader,
		]),
	);

	if (gameVersion !== null) {
		url.searchParams.set(
			"game_versions",
			JSON.stringify([
				gameVersion,
			]),
		);
	}

	const versions = await modrinthRequest<ModrinthVersion[]>(context, url.toString(), MODRINTH_SEARCH_CACHE_SECONDS);
	const ordered = [
		...versions,
	].sort((left, right) => right.date_published.localeCompare(left.date_published));
	const newest = ordered.find((version) => version.version_type === "release") ?? ordered.at(0);

	if (!newest) {
		return null;
	}

	const file = modrinthFile(newest);

	if (!file) {
		return null;
	}

	return {
		title: project,
		version: newest.version_number,
		icon: null,
		pageUrl: `https://modrinth.com/project/${encodeURIComponent(project)}`,
		gameVersions: newest.game_versions,
		loaders: newest.loaders,
		serverSide: null,
		file,
		dependencies: [],
	};
};

export const modrinthProvider: CatalogProvider = {
	id: CatalogProviderId.Modrinth,

	label: {
		ar: "مودرينث",
		en: "Modrinth",
	},

	note: {
		ar: "مودرينث ما يرد علينا الحين. جرّب مرة ثانية بعد شوي.",
		en: "Modrinth is not answering right now. Try again in a bit.",
	},

	sorts: [
		{
			value: "relevance",
			label: {
				ar: "الأنسب",
				en: "Best match",
			},
		},
		{
			value: "downloads",
			label: {
				ar: "الأكثر تحميلًا",
				en: "Most downloaded",
			},
		},
		{
			value: "follows",
			label: {
				ar: "الأكثر متابعة",
				en: "Most followed",
			},
		},
		{
			value: "updated",
			label: {
				ar: "آخر تحديث",
				en: "Recently updated",
			},
		},
	],

	categories(target) {
		const shared: Bridge.CatalogFacet[] = [
			{
				value: "optimization",
				label: {
					ar: "تحسين الأداء",
					en: "Performance",
				},
			},
			{
				value: "utility",
				label: {
					ar: "أدوات",
					en: "Utility",
				},
			},
			{
				value: "management",
				label: {
					ar: "إدارة",
					en: "Management",
				},
			},
			{
				value: "economy",
				label: {
					ar: "اقتصاد",
					en: "Economy",
				},
			},
			{
				value: "social",
				label: {
					ar: "اجتماعي",
					en: "Social",
				},
			},
		];

		if (target.kind === AddonKind.Plugin) {
			return shared;
		}

		return [
			...shared,
			{
				value: "adventure",
				label: {
					ar: "مغامرات",
					en: "Adventure",
				},
			},
			{
				value: "technology",
				label: {
					ar: "تقنية",
					en: "Technology",
				},
			},
			{
				value: "magic",
				label: {
					ar: "سحر",
					en: "Magic",
				},
			},
			{
				value: "library",
				label: {
					ar: "مكتبات",
					en: "Libraries",
				},
			},
		];
	},

	supports() {
		return true;
	},

	ready() {
		return true;
	},

	async search(context, target, search) {
		const facets: string[][] = [
			[
				`project_type:${target.kind}`,
			],
			targetLoaders(target).map((loader) => `categories:${loader}`),
			[
				`versions:${target.gameVersion}`,
			],
		];

		if (search.category) {
			facets.push([
				`categories:${search.category}`,
			]);
		}

		const url = new URL(`${MODRINTH}/search`);

		url.searchParams.set("query", search.query);
		url.searchParams.set("offset", String(search.page * search.pageSize));
		url.searchParams.set("limit", String(search.pageSize));
		url.searchParams.set("index", search.sort ?? (search.query.length > 0 ? "relevance" : "downloads"));
		url.searchParams.set("facets", JSON.stringify(facets));

		const result = await modrinthRequest<ModrinthSearch>(context, url.toString(), MODRINTH_SEARCH_CACHE_SECONDS);

		return {
			hits: result.hits.map((hit) => {
				return {
					id: hit.project_id,
					title: hit.title,
					description: hit.description,
					icon: hit.icon_url,
					downloads: hit.downloads,
					author: hit.author,
					categories: hit.categories,
					updatedAt: hit.date_modified,
					pageUrl: `https://modrinth.com/${target.kind}/${hit.slug}`,
				};
			}),
			total: result.total_hits,
		} satisfies CatalogResults;
	},

	async resolve(context, target, project): Promise<CatalogRelease | null> {
		const details = await modrinthRequest<ModrinthProject>(
			context,
			`${MODRINTH}/project/${encodeURIComponent(project)}`,
		);
		const version = await versionFor(context, target, project);

		if (!version) {
			return null;
		}

		const file = modrinthFile(version);

		if (!file) {
			return null;
		}

		return {
			title: details.title,
			version: version.version_number,
			icon: details.icon_url,
			pageUrl: `https://modrinth.com/${target.kind}/${details.slug}`,
			gameVersions: version.game_versions,
			loaders: version.loaders,
			serverSide: details.server_side,
			file,
			dependencies: version.dependencies
				.filter((dependency) => dependency.dependency_type === "required" && dependency.project_id !== null)
				.map((dependency) => dependency.project_id as string),
		};
	},
};
