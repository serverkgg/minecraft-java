import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { fileNameOf, modpackIdentity, type PackEntry, PackFormat, readPackIndex } from "../shared";
import type { ModpackSource } from "./modpackSource";
import {
	CatalogProviderId,
	type CatalogResults,
	type CatalogSearch,
	type ModpackProject,
	type ModpackRelease,
} from "./provider";

export const UPLOAD_SOURCE_LABEL: Bridge.Text = {
	ar: "مودباكاتك المرفوعة",
	en: "Your uploads",
};

const UPLOAD_SOURCE_NOTE: Bridge.Text = {
	ar: "ارفع مودباك من قسم «مودباكاتك المرفوعة» في تبويب المودباك.",
	en: "Upload a modpack in Your uploads on the Modpacks tab.",
};

export const UPLOAD_MISSING: Bridge.Text = {
	ar: "تعذّر العثور على هذا المودباك بين مودباكاتك المرفوعة. ارفعه مرة ثانية من تبويب المودباك.",
	en: "We couldn't find this modpack in your uploads. Upload it again on the Modpacks tab.",
};

const SHA1_DIGEST = "sha1";

export const newestPacksFirst = (entries: PackEntry[]) => {
	return [
		...entries,
	].sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
};

export const uploadedRelease = (entry: PackEntry): ModpackRelease => {
	return {
		versionId: entry.sha1,
		version: entry.version,
		stable: true,
		loaders: [
			entry.variant,
		],
		gameVersions: [
			entry.mcVersion,
		],
		file: {
			filename: fileNameOf(entry.path),
			url: "",
			sizeBytes: entry.sizeBytes > 0 ? entry.sizeBytes : null,
			digest: `${SHA1_DIGEST}:${entry.sha1}`,
		},
		serverPacks: [],
		local: {
			path: entry.path,
			format: entry.format === PackFormat.CurseForge ? CatalogProviderId.CurseForge : CatalogProviderId.Modrinth,
		},
	};
};

export const uploadedProject = (entry: PackEntry): ModpackProject => {
	return {
		id: entry.sha1,
		title: entry.name,
		icon: null,
		pageUrl: null,
		description: null,
		author: null,
		downloads: null,
	};
};

const uploadedHit = (entry: PackEntry): CatalogResults["hits"][number] => {
	return {
		id: entry.sha1,
		title: entry.name,
		description: modpackIdentity(entry),
		icon: null,
		downloads: 0,
		author: null,
		categories: [],
		updatedAt: entry.uploadedAt.length > 0 ? entry.uploadedAt : null,
		pageUrl: null,
	};
};

const findPack = async (context: Bridge.Context, sha1: string) => {
	return (await readPackIndex(context)).find((entry) => entry.sha1 === sha1) ?? null;
};

const requirePack = async (context: Bridge.Context, sha1: string) => {
	const entry = await findPack(context, sha1);

	if (!entry) {
		throw new BridgeUserError(UPLOAD_MISSING);
	}

	return entry;
};

export const searchUploadedPacks = async (context: Bridge.Context, search: CatalogSearch): Promise<CatalogResults> => {
	const query = search.query.trim().toLowerCase();

	const matches = newestPacksFirst(await readPackIndex(context)).filter((entry) => {
		return query.length === 0 || entry.name.toLowerCase().includes(query);
	});

	const start = search.page * search.pageSize;

	return {
		hits: matches.slice(start, start + search.pageSize).map(uploadedHit),
		total: matches.length,
	};
};

export const uploadModpackSource: ModpackSource = {
	id: CatalogProviderId.Upload,
	label: UPLOAD_SOURCE_LABEL,
	note: UPLOAD_SOURCE_NOTE,
	sorts: [],
	categories: [],

	ready() {
		return true;
	},

	async search(context, search) {
		return await searchUploadedPacks(context, search);
	},

	async project(context, project) {
		return uploadedProject(await requirePack(context, project));
	},

	async releases(context, project) {
		return [
			uploadedRelease(await requirePack(context, project)),
		];
	},

	async release(context, project, versionId) {
		const entry = await findPack(context, versionId);

		if (!entry || entry.sha1 !== project || !(await context.files.exists(entry.path))) {
			return null;
		}

		return uploadedRelease(entry);
	},
};
