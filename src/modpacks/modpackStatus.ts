import { type Bridge, BridgeDetailFormat, BridgeDetailTone, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { encodeProviderRef, modpackSourceById } from "../providers";
import { addonDirectory, VARIANT_LABELS } from "../shared";
import { MODPACK_VARIABLE } from "./applyModpack";
import { describeProject, identityMismatched, latestRelease, outdated } from "./modpackFreshness";
import { decodeModpackRef } from "./modpackRef";
import {
	type ModpackSidecar,
	modpackBuildIdentity,
	modpackModCount,
	type PendingFile,
	readModpackSidecar,
} from "./modpackSidecar";
import { installModpack } from "./modpacks";

export const MODPACK_UPDATE_ACTION = "update";

const PAGE_LINK: Bridge.Text = {
	ar: "صفحة المودباك",
	en: "Modpack page",
};

const NOT_INSTALLED_BADGE: Bridge.DetailBadge = {
	tone: BridgeDetailTone.Warning,
	label: {
		ar: "ما ركّبناه بعد",
		en: "Not installed yet",
	},
};

const MISMATCHED_BADGE: Bridge.DetailBadge = {
	tone: BridgeDetailTone.Danger,
	label: {
		ar: "ما يطابق نسخة سيرفرك",
		en: "Does not match your server",
	},
};

const OUTDATED_BADGE: Bridge.DetailBadge = {
	tone: BridgeDetailTone.Warning,
	label: {
		ar: "فيه تحديث",
		en: "Update available",
	},
};

const CURRENT_BADGE: Bridge.DetailBadge = {
	tone: BridgeDetailTone.Success,
	label: {
		ar: "محدّث",
		en: "Up to date",
	},
};

export const pendingBadges = (pending: PendingFile[]): Bridge.DetailBadge[] => {
	if (pending.length === 0) {
		return [];
	}

	return [
		{
			tone: BridgeDetailTone.Warning,
			label: {
				ar: pending.length === 1 ? "ناقص ملف واحد" : `ناقص ${pending.length} ملفات`,
				en: pending.length === 1 ? "1 file missing" : `${pending.length} files missing`,
			},
		},
	];
};

const linksOf = (pageUrl: string | null): Bridge.DetailLink[] => {
	return pageUrl === null
		? []
		: [
				{
					label: PAGE_LINK,
					url: pageUrl,
				},
			];
};

const sizeOnDisk = async (context: Bridge.Context) => {
	try {
		return await context.files.size(addonDirectory(context));
	} catch {
		return null;
	}
};

const declaredDetail = async (context: Bridge.Context, declared: string): Promise<Bridge.DetailResult> => {
	const ref = decodeModpackRef(declared);
	const project = ref ? await describeProject(context, modpackSourceById(ref.provider), ref.project) : null;

	return {
		id: ref ? encodeProviderRef(ref.provider, ref.project) : declared,
		title: project?.title ?? ref?.project ?? declared,
		subtitle: null,
		description: project?.description ?? null,
		image: project?.icon ?? null,
		badges: [
			NOT_INSTALLED_BADGE,
		],
		stats: [],
		links: linksOf(project?.pageUrl ?? null),
		stale: true,
		actions: [],
	};
};

const statsOf = (sidecar: ModpackSidecar, sizeBytes: number | null): Bridge.DetailStat[] => {
	return [
		{
			key: "version",
			label: {
				ar: "إصدار المودباك",
				en: "Pack version",
			},
			value: sidecar.version,
			format: BridgeDetailFormat.Text,
		},
		{
			key: "mcVersion",
			label: {
				ar: "نسخة ماينكرافت",
				en: "Minecraft",
			},
			value: sidecar.mcVersion,
			format: BridgeDetailFormat.Text,
		},
		{
			key: "loader",
			label: {
				ar: "المشغّل",
				en: "Loader",
			},
			value: VARIANT_LABELS[sidecar.variant],
			format: BridgeDetailFormat.Text,
		},
		{
			key: "loaderVersion",
			label: {
				ar: "نسخة المشغّل",
				en: "Loader build",
			},
			value: sidecar.loaderVersion,
			format: BridgeDetailFormat.Text,
		},
		{
			key: "mods",
			label: {
				ar: "عدد المودات",
				en: "Mods",
			},
			value: modpackModCount(sidecar),
			format: BridgeDetailFormat.Number,
		},
		{
			key: "size",
			label: {
				ar: "الحجم على السيرفر",
				en: "Size on disk",
			},
			value: sizeBytes,
			format: BridgeDetailFormat.Bytes,
		},
		{
			key: "appliedAt",
			label: {
				ar: "تاريخ التركيب",
				en: "Installed",
			},
			value: sidecar.appliedAt.length > 0 ? sidecar.appliedAt : null,
			format: BridgeDetailFormat.Date,
		},
		{
			key: "downloads",
			label: {
				ar: "التحميلات",
				en: "Downloads",
			},
			value: sidecar.downloads,
			format: BridgeDetailFormat.Number,
		},
		{
			key: "author",
			label: {
				ar: "صاحب المودباك",
				en: "Author",
			},
			value: sidecar.author,
			format: BridgeDetailFormat.Text,
		},
	];
};

const installedDetail = async (context: Bridge.Context, sidecar: ModpackSidecar): Promise<Bridge.DetailResult> => {
	const source = modpackSourceById(sidecar.provider);
	const mismatched = await identityMismatched(context, sidecar);
	const behind = !mismatched && (await outdated(context, source, sidecar.project, sidecar.versionId));

	const badge = mismatched ? MISMATCHED_BADGE : behind ? OUTDATED_BADGE : CURRENT_BADGE;

	return {
		id: encodeProviderRef(sidecar.provider, sidecar.project),
		title: sidecar.title,
		subtitle: modpackBuildIdentity(sidecar),
		description: sidecar.description,
		image: sidecar.icon,
		badges: [
			...pendingBadges(sidecar.pending),
			badge,
		],
		stats: statsOf(sidecar, await sizeOnDisk(context)),
		links: linksOf(sidecar.pageUrl),
		stale: mismatched || behind || sidecar.pending.length > 0,
		actions: behind
			? [
					MODPACK_UPDATE_ACTION,
				]
			: [],
	};
};

export const modpackStatus: Bridge.Detail = {
	kind: BridgeKind.Detail,

	async read(context) {
		const sidecar = await readModpackSidecar(context);

		if (sidecar) {
			return await installedDetail(context, sidecar);
		}

		const declared = context.variable(MODPACK_VARIABLE) ?? "";

		return declared.length === 0 ? null : await declaredDetail(context, declared);
	},

	actions: {
		[MODPACK_UPDATE_ACTION]: async (context) => {
			const sidecar = await readModpackSidecar(context);

			if (!sidecar) {
				throw new BridgeUserError({
					ar: "ما فيه مودباك مركّب، فما فيه شي نحدّثه.",
					en: "No modpack is installed, so there is nothing to update.",
				});
			}

			const latest = await latestRelease(context, modpackSourceById(sidecar.provider), sidecar.project);

			if (!latest || latest.versionId === sidecar.versionId) {
				throw new BridgeUserError({
					ar: "المودباك على آخر إصدار.",
					en: "This modpack is already on its latest release.",
				});
			}

			const entry = await installModpack(context, encodeProviderRef(sidecar.provider, sidecar.project));

			return {
				variables: entry.variables ?? null,
			};
		},
	},
};
