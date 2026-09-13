import type { Bridge } from "@serverkgg/bridge";
import { AddonKind, type CatalogFile, type CatalogProvider, CatalogProviderId, type CatalogRelease } from "./provider";
import { asRateLimit } from "./rateLimit";

const SEARCH_CACHE_SECONDS = 60;

const PROJECT_CACHE_SECONDS = 600;

const request = async <Result>(
	context: Bridge.Context,
	url: string,
	cacheSeconds = PROJECT_CACHE_SECONDS,
): Promise<Result> => {
	try {
		return await context.net.json<Result>(url, {
			cacheSeconds,
		});
	} catch (error) {
		throw asRateLimit(error, CatalogProviderId.Hangar);
	}
};

const HANGAR = "https://hangar.papermc.io/api/v1";

const CDN_HOST = "hangarcdn.papermc.io";

const PLATFORM = "PAPER";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

interface HangarNamespace {
	owner: string;
	slug: string;
}

interface HangarProject {
	name: string;
	namespace: HangarNamespace;
	description: string;
	category: string;
	lastUpdated: string | null;
	avatarUrl: string | null;
	stats: {
		downloads: number;
	};
}

interface HangarProjects {
	pagination: {
		count: number;
	};
	result: HangarProject[];
}

interface HangarFileInfo {
	name: string;
	sizeBytes: number;
	sha256Hash: string | null;
}

interface HangarDownload {
	fileInfo: HangarFileInfo | null;
	externalUrl: string | null;
	downloadUrl: string | null;
}

interface HangarDependency {
	name: string;
	projectId: number | null;
	required: boolean;
}

interface HangarVersion {
	name: string;
	downloads: Record<string, HangarDownload | undefined>;
	pluginDependencies: Record<string, HangarDependency[] | undefined>;
}

interface HangarVersions {
	result: HangarVersion[];
}

const projectPath = (project: string) => {
	return project
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
};

const fileOf = (download: HangarDownload): CatalogFile | null => {
	const info = download.fileInfo;

	if (!info || !download.downloadUrl || !URL.canParse(download.downloadUrl)) {
		return null;
	}

	if (new URL(download.downloadUrl).hostname !== CDN_HOST) {
		return null;
	}

	const sha256 = info.sha256Hash ?? "";

	return {
		filename: info.name,
		url: download.downloadUrl,
		sizeBytes: info.sizeBytes > 0 ? info.sizeBytes : null,
		digest: SHA256_PATTERN.test(sha256) ? `sha256:${sha256}` : null,
	};
};

export const hangarProvider: CatalogProvider = {
	id: CatalogProviderId.Hangar,

	label: {
		ar: "هانجر",
		en: "Hangar",
	},

	note: {
		ar: "هانجر ما يرد علينا الحين. جرّب مرة ثانية بعد شوي.",
		en: "Hangar is not answering right now. Try again in a bit.",
	},

	sorts: [
		{
			value: "-downloads",
			label: {
				ar: "الأكثر تحميلًا",
				en: "Most downloaded",
			},
		},
		{
			value: "-stars",
			label: {
				ar: "الأكثر نجومًا",
				en: "Most starred",
			},
		},
		{
			value: "-updated",
			label: {
				ar: "آخر تحديث",
				en: "Recently updated",
			},
		},
		{
			value: "-newest",
			label: {
				ar: "الأحدث",
				en: "Newest",
			},
		},
	],

	categories() {
		return [
			{
				value: "admin_tools",
				label: {
					ar: "أدوات الأدمن",
					en: "Admin tools",
				},
			},
			{
				value: "chat",
				label: {
					ar: "الشات",
					en: "Chat",
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
				value: "protection",
				label: {
					ar: "حماية",
					en: "Protection",
				},
			},
			{
				value: "games",
				label: {
					ar: "ألعاب",
					en: "Games",
				},
			},
			{
				value: "world_management",
				label: {
					ar: "إدارة الماب",
					en: "World management",
				},
			},
			{
				value: "misc",
				label: {
					ar: "متنوع",
					en: "Misc",
				},
			},
		];
	},

	supports(target) {
		return target.kind === AddonKind.Plugin;
	},

	ready() {
		return true;
	},

	async search(context, target, search) {
		const url = new URL(`${HANGAR}/projects`);

		url.searchParams.set("limit", String(search.pageSize));
		url.searchParams.set("offset", String(search.page * search.pageSize));
		url.searchParams.set("sort", search.sort ?? "-downloads");
		url.searchParams.set("platform", PLATFORM);
		url.searchParams.set("version", target.gameVersion);

		if (search.query.length > 0) {
			url.searchParams.set("q", search.query);
		}

		if (search.category) {
			url.searchParams.set("category", search.category);
		}

		const result = await request<HangarProjects>(context, url.toString(), SEARCH_CACHE_SECONDS);

		return {
			hits: result.result.map((project) => {
				const id = `${project.namespace.owner}/${project.namespace.slug}`;

				return {
					id,
					title: project.name,
					description: project.description,
					icon: project.avatarUrl,
					downloads: project.stats.downloads,
					author: project.namespace.owner,
					categories: [
						project.category,
					],
					updatedAt: project.lastUpdated,
					pageUrl: `https://hangar.papermc.io/${id}`,
				};
			}),
			total: result.pagination.count,
		};
	},

	async releases(context, target, project) {
		const url = new URL(`${HANGAR}/projects/${projectPath(project)}/versions`);
		url.searchParams.set("limit", "25");
		url.searchParams.set("platform", PLATFORM);
		url.searchParams.set("platformVersion", target.gameVersion);
		return (await request<HangarVersions>(context, url.toString())).result
			.filter((version) => version.downloads[PLATFORM])
			.map((version) => ({
				id: version.name,
				label: version.name,
				gameVersion: target.gameVersion,
			}));
	},

	async resolve(context, target, project, versionId): Promise<CatalogRelease | null> {
		const path = projectPath(project);
		const url = new URL(`${HANGAR}/projects/${path}/versions`);

		url.searchParams.set("limit", "25");
		url.searchParams.set("platform", PLATFORM);
		url.searchParams.set("platformVersion", target.gameVersion);

		const versions = await request<HangarVersions>(context, url.toString());

		const usable = versions.result
			.map((version) => {
				const download = version.downloads[PLATFORM];

				return {
					version,
					file: download ? fileOf(download) : null,
				};
			})
			.find((candidate) => candidate.file !== null && (!versionId || candidate.version.name === versionId));

		if (!usable?.file) {
			return null;
		}

		const details = await request<HangarProject>(context, `${HANGAR}/projects/${path}`);
		const namespace = `${details.namespace.owner}/${details.namespace.slug}`;

		return {
			title: details.name,
			version: usable.version.name,
			versionId: usable.version.name,
			icon: details.avatarUrl,
			pageUrl: `https://hangar.papermc.io/${namespace}`,
			gameVersions: null,
			loaders: null,
			serverSide: null,
			file: usable.file,
			dependencies: (usable.version.pluginDependencies[PLATFORM] ?? [])
				.filter((dependency) => dependency.required && dependency.projectId !== null)
				.map((dependency) => ({
					project: String(dependency.projectId),
					version: null,
					kind: "required",
				})),
		};
	},
};
