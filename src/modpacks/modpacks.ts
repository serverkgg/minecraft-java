import {
	type Bridge,
	BridgeConfirm,
	BridgeFailureCode,
	BridgeFailureError,
	BridgeKind,
	BridgeUserError,
} from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { decodeProviderRef, encodeProviderRef, explainLookup, modpackSourceById, modpackSources } from "../providers";
import { addonDirectory, requestedGameVersion } from "../shared";
import { MODPACK_VARIABLE } from "./applyModpack";
import { describeProject, identityMismatched, outdated, serverRelease } from "./modpackFreshness";
import { usesQuilt, variantForLoaders } from "./modpackIndex";
import { decodeModpackRef, encodeModpackRef } from "./modpackRef";
import { MODPACK_SIDECAR, modpackIdentity, readModpackSidecar } from "./modpackSidecar";
import { pickModpackVersion } from "./modpackVersion";

const PAGE_SIZE = 20;

const MODPACK_MISSING: Bridge.Text = {
	ar: "ما لقينا هذا المودباك عند مصدره. دوّر عليه مرة ثانية أو اختَر مودباك ثاني.",
	en: "We could not find this modpack at its source. Search for it again or pick another modpack.",
};

const MODPACK_SUBJECT: Bridge.Text = {
	ar: "المودباك",
	en: "the modpack",
};

const sources = (context: Bridge.Context): Bridge.CatalogProvider[] => {
	return modpackSources().map((source) => {
		const ready = source.ready(context);

		return {
			id: source.id,
			label: source.label,
			ready,
			...(ready
				? {}
				: {
						note: source.note,
					}),
		};
	});
};

const declaredEntries = async (context: Bridge.Context): Promise<Bridge.CatalogEntry[]> => {
	const declared = context.variable(MODPACK_VARIABLE) ?? "";

	if (declared.length === 0) {
		return [];
	}

	const ref = decodeModpackRef(declared);
	const project = ref ? await describeProject(context, modpackSourceById(ref.provider), ref.project) : null;

	return [
		{
			id: ref ? encodeProviderRef(ref.provider, ref.project) : declared,
			provider: ref?.provider ?? null,
			path: MODPACK_SIDECAR,
			title: project?.title ?? ref?.project ?? declared,
			version: null,
			sizeBytes: 0,
			enabled: true,
			gameVersion: null,
			stale: true,
			pageUrl: project?.pageUrl ?? null,
			icon: project?.icon ?? null,
		},
	];
};

export const installModpack = async (
	context: Bridge.Context,
	id: string,
	releaseId?: string,
): Promise<Bridge.CatalogEntry> => {
	const decoded = decodeProviderRef(id);
	const source = decoded ? modpackSourceById(decoded.provider) : null;

	if (!decoded || !source || source.id !== decoded.provider) {
		throw new BridgeUserError({
			ar: "ما نقدر نركّب هذا المودباك من المرجع اللي وصلنا. حدّث الصفحة وجرّب مرة ثانية.",
			en: `"${id}" is not a modpack reference we can install.`,
		});
	}

	const releases = await explainLookup(
		() => source.releases(context, decoded.project),
		MODPACK_MISSING,
		MODPACK_SUBJECT,
	);
	const release = releaseId ? releases.find((candidate) => candidate.versionId === releaseId) : serverRelease(releases);

	if (!release) {
		throw new BridgeFailureError(
			BridgeFailureCode.NoCatalogVersionAvailable,
			releases.some((candidate) => usesQuilt(candidate.loaders))
				? "this modpack runs on quilt, and serverk has no quilt server type"
				: "this modpack has no build we can run on a server",
		);
	}

	const variant = variantForLoaders(release.loaders);
	const mcVersion = pickModpackVersion(release.gameVersions, requestedGameVersion(context)) ?? "";

	if (!variant || mcVersion.length === 0) {
		throw new BridgeFailureError(
			BridgeFailureCode.NoCatalogVersionAvailable,
			"this modpack does not say which minecraft version it runs on",
		);
	}

	const project = await explainLookup(() => source.project(context, decoded.project), MODPACK_MISSING, MODPACK_SUBJECT);

	return {
		id: encodeProviderRef(source.id, project.id),
		provider: source.id,
		path: MODPACK_SIDECAR,
		title: project.title,
		version: release.version,
		sizeBytes: release.file.sizeBytes ?? 0,
		enabled: true,
		gameVersion: modpackIdentity({
			mcVersion,
			variant,
		}),
		stale: false,
		pageUrl: project.pageUrl,
		icon: project.icon,
		variables: {
			[MODPACK_VARIABLE]: encodeModpackRef(source.id, project.id, release.versionId),
			SERVER_TYPE: variant,
			MC_VERSION: mcVersion,
			LOADER_VERSION: "",
		},
	};
};

export const modpacks: Bridge.Catalog = {
	kind: BridgeKind.Catalog,
	pageSize: PAGE_SIZE,

	async search(context, query) {
		const source = modpackSourceById(query.provider);
		const results = await source.search(context, {
			query: query.query,
			page: query.page,
			pageSize: PAGE_SIZE,
			category: query.category,
			sort: query.sort,
		});

		return {
			hits: results.hits.map((hit) => {
				return {
					...hit,
					id: encodeProviderRef(source.id, hit.id),
					provider: source.id,
				};
			}),
			total: results.total,
			providers: sources(context),
			categories: source.categories,
			sorts: source.sorts,
		};
	},

	async installed(context) {
		const sidecar = await readModpackSidecar(context);

		if (!sidecar) {
			return await declaredEntries(context);
		}

		const source = modpackSourceById(sidecar.provider);
		const mismatched = await identityMismatched(context, sidecar);

		return [
			{
				id: encodeProviderRef(sidecar.provider, sidecar.project),
				provider: sidecar.provider,
				path: MODPACK_SIDECAR,
				title: sidecar.title,
				version: sidecar.version,
				sizeBytes: await context.files.size(addonDirectory(context)),
				enabled: true,
				gameVersion: modpackIdentity(sidecar),
				stale: mismatched || (await outdated(context, source, sidecar.project, sidecar.versionId)),
				pageUrl: sidecar.pageUrl,
				icon: sidecar.icon,
			},
		];
	},

	async releases(context, id) {
		const ref = decodeProviderRef(id);
		if (!ref) {
			return [];
		}
		return (await modpackSourceById(ref.provider).releases(context, ref.project))
			.filter((release) => variantForLoaders(release.loaders))
			.map((release) => ({
				id: release.versionId,
				label: release.version,
				gameVersion: release.gameVersions.join(", "),
			}));
	},
	async preview(context, id, releaseId) {
		const entry = await installModpack(context, id, releaseId);
		return {
			variables: entry.variables ?? undefined,
			confirm: BridgeConfirm.Strong,
			lines: [
				{
					ar: `${entry.title}: ${entry.version} · ${entry.gameVersion}`,
					en: `${entry.title}: ${entry.version} · ${entry.gameVersion}`,
				},
				{
					ar: "نحفظ نسخة احتياطية قبل تركيب المودباك. تغيير النوع أو الرجوع لنسخة أقدم ممكن يحذف بيانات الماب.",
					en: "A recovery backup is required before installing. Changing loader or downgrading can remove world data.",
				},
			],
		};
	},

	async install(context, id, releaseId) {
		const entry = await installModpack(context, id, releaseId);
		const label = entry.version === null ? entry.title : `${entry.title} (${entry.version})`;

		context.activity.report({
			name: BridgeEventName.ModpackSelected,
			text: {
				ar: `تم اختيار مودباك ${label} للتثبيت`,
				en: `Selected modpack ${label} to install`,
			},
			subject: entry.title,
			details: {
				title: entry.title,
				version: entry.version,
				provider: entry.provider,
				server: entry.gameVersion,
			},
		});

		return entry;
	},

	async remove() {
		throw new BridgeUserError({
			ar: "امسح المودباك من تبويب المودباكات. إزالته من هنا تعيد بناء السيرفر بدونه.",
			en: "Clear the modpack from the modpacks tab. Removing it here rebuilds the server without it.",
		});
	},
};
