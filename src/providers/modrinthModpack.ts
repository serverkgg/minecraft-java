import type { Bridge } from "@serverkgg/bridge";
import {
	MODRINTH,
	MODRINTH_SEARCH_CACHE_SECONDS,
	type ModrinthProject,
	type ModrinthSearch,
	type ModrinthTeamMember,
	type ModrinthVersion,
	modrinthFile,
	modrinthRequest,
} from "./modrinthApi";
import type { CatalogResults, CatalogSearch, ModpackProject, ModpackRelease } from "./provider";

const SERVER_SIDE = [
	"server_side:required",
	"server_side:optional",
];

const OWNER_ROLE = "owner";

export const MODPACK_SORTS: Bridge.CatalogFacet[] = [
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
];

export const MODPACK_CATEGORIES: Bridge.CatalogFacet[] = [
	{
		value: "multiplayer",
		label: {
			ar: "جماعي",
			en: "Multiplayer",
		},
	},
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
		value: "combat",
		label: {
			ar: "قتال",
			en: "Combat",
		},
	},
	{
		value: "quests",
		label: {
			ar: "مهمات",
			en: "Quests",
		},
	},
	{
		value: "challenging",
		label: {
			ar: "صعب",
			en: "Challenging",
		},
	},
	{
		value: "kitchen-sink",
		label: {
			ar: "شامل",
			en: "Kitchen sink",
		},
	},
	{
		value: "lightweight",
		label: {
			ar: "خفيف",
			en: "Lightweight",
		},
	},
	{
		value: "optimization",
		label: {
			ar: "تحسين الأداء",
			en: "Performance",
		},
	},
];

const releaseOf = (version: ModrinthVersion): ModpackRelease | null => {
	const file = modrinthFile(version);

	if (!file?.filename.toLowerCase().endsWith(".mrpack")) {
		return null;
	}

	return {
		versionId: version.id,
		version: version.version_number,
		stable: version.version_type === "release",
		loaders: version.loaders,
		gameVersions: version.game_versions,
		file,
		serverPacks: [],
	};
};

export const searchModpacks = async (context: Bridge.Context, search: CatalogSearch): Promise<CatalogResults> => {
	const facets: string[][] = [
		[
			"project_type:modpack",
		],
		SERVER_SIDE,
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
				pageUrl: `https://modrinth.com/modpack/${hit.slug}`,
			};
		}),
		total: result.total_hits,
	} satisfies CatalogResults;
};

const modpackAuthor = async (context: Bridge.Context, project: string): Promise<string | null> => {
	try {
		const members = await modrinthRequest<ModrinthTeamMember[]>(
			context,
			`${MODRINTH}/project/${encodeURIComponent(project)}/members`,
		);

		const owner = members.find((member) => member.role.toLowerCase() === OWNER_ROLE) ?? members.at(0);

		return owner?.user.username ?? null;
	} catch {
		return null;
	}
};

export const modpackProject = async (context: Bridge.Context, project: string): Promise<ModpackProject> => {
	const details = await modrinthRequest<ModrinthProject>(context, `${MODRINTH}/project/${encodeURIComponent(project)}`);

	return {
		id: details.id,
		title: details.title,
		icon: details.icon_url,
		pageUrl: `https://modrinth.com/modpack/${details.slug}`,
		description: details.description,
		author: await modpackAuthor(context, details.id),
		downloads: details.downloads,
	};
};

export const modpackReleases = async (context: Bridge.Context, project: string): Promise<ModpackRelease[]> => {
	const versions = await modrinthRequest<ModrinthVersion[]>(
		context,
		`${MODRINTH}/project/${encodeURIComponent(project)}/version`,
	);

	return versions
		.map((version) => {
			return {
				version,
				release: releaseOf(version),
			};
		})
		.filter((entry) => entry.release !== null)
		.sort((left, right) => right.version.date_published.localeCompare(left.version.date_published))
		.map((entry) => entry.release as ModpackRelease);
};

export const modpackRelease = async (context: Bridge.Context, versionId: string): Promise<ModpackRelease | null> => {
	const version = await modrinthRequest<ModrinthVersion>(
		context,
		`${MODRINTH}/version/${encodeURIComponent(versionId)}`,
	);

	return releaseOf(version);
};
