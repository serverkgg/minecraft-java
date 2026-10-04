import { type Bridge, BridgeDetailFormat, BridgeDetailTone, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { encodeProviderRef, modpackSourceById } from "../providers";
import { addonDirectory, VARIANT_LABELS } from "../shared";
import { MODPACK_VARIABLE } from "./applyModpack";
import { describeProject, freshnessOf, identityMismatched, latestRelease, ModpackFreshness } from "./modpackFreshness";
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

const NOTHING_TO_UPDATE: Bridge.Text = {
	ar: "لا يوجد مودباك مثبّت، لذلك لا يوجد ما يمكن تحديثه.",
	en: "No modpack is installed, so there's nothing to update.",
};

const ALREADY_LATEST: Bridge.Text = {
	ar: "المودباك على آخر إصدار.",
	en: "This modpack is already on its latest release.",
};

const LATEST_MISMATCHED: Bridge.Text = {
	ar: "المودباك على آخر إصدار، لكنه لا يطابق نوع سيرفرك أو إصداره. ثبّته من جديد من تبويب المودباك.",
	en: "This modpack is on its latest release but doesn't match your server's type or version. Install it again from the Modpacks tab.",
};

const NOT_INSTALLED_BADGE: Bridge.DetailBadge = {
	tone: BridgeDetailTone.Warning,
	label: {
		ar: "غير مثبّت بعد",
		en: "Not installed yet",
	},
};

const MISMATCHED_BADGE: Bridge.DetailBadge = {
	tone: BridgeDetailTone.Danger,
	label: {
		ar: "لا يطابق إصدار سيرفرك",
		en: "Doesn't match your server",
	},
};

const OUTDATED_BADGE: Bridge.DetailBadge = {
	tone: BridgeDetailTone.Warning,
	label: {
		ar: "يتوفر تحديث",
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
				ar:
					pending.length === 1
						? "ملف واحد ناقص"
						: pending.length === 2
							? "ملفان ناقصان"
							: pending.length <= 10
								? `${pending.length} ملفات ناقصة`
								: `${pending.length} ملفًا ناقصًا`,
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
		unavailable: {
			[MODPACK_UPDATE_ACTION]: NOTHING_TO_UPDATE,
		},
	};
};

export const modpackUpdateOf = (
	mismatched: boolean,
	freshness: ModpackFreshness,
): Pick<Bridge.DetailResult, "actions" | "unavailable"> => {
	if (freshness !== ModpackFreshness.Current) {
		return {
			actions: [
				MODPACK_UPDATE_ACTION,
			],
		};
	}

	return {
		actions: [],
		unavailable: {
			[MODPACK_UPDATE_ACTION]: mismatched ? LATEST_MISMATCHED : ALREADY_LATEST,
		},
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
				ar: "إصدار ماينكرافت",
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
				ar: "إصدار المشغّل",
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
				ar: "تاريخ التثبيت",
				en: "Installed",
			},
			value: sidecar.appliedAt.length > 0 ? sidecar.appliedAt : null,
			format: BridgeDetailFormat.Date,
		},
		{
			key: "downloads",
			label: {
				ar: "التنزيلات",
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
	const freshness = await freshnessOf(context, source, sidecar.project, sidecar.versionId);
	const behind = freshness === ModpackFreshness.Behind;

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
		...modpackUpdateOf(mismatched, freshness),
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
				throw new BridgeUserError(NOTHING_TO_UPDATE);
			}

			const latest = await latestRelease(context, modpackSourceById(sidecar.provider), sidecar.project);

			if (!latest || latest.versionId === sidecar.versionId) {
				throw new BridgeUserError(ALREADY_LATEST);
			}

			const entry = await installModpack(context, encodeProviderRef(sidecar.provider, sidecar.project));
			const to = entry.version ?? latest.version;

			context.activity.report({
				name: BridgeEventName.ModpackSelected,
				text: {
					ar: `تم اختيار تحديث مودباك ${sidecar.title} من ${sidecar.version} إلى ${to}`,
					en: `Selected the update of modpack ${sidecar.title} from ${sidecar.version} to ${to}`,
				},
				subject: sidecar.title,
				details: {
					title: sidecar.title,
					provider: sidecar.provider,
					from: sidecar.version,
					to,
				},
			});

			return {
				variables: entry.variables ?? null,
			};
		},
	},
};
