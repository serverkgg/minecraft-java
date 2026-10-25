import {
	type Bridge,
	BridgeConfirm,
	BridgeFailureCode,
	BridgeFailureError,
	BridgeKind,
	BridgeUserError,
} from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { companionForProject, isCompanionFile } from "../companions";
import type { AddonTarget, CatalogProvider, CatalogRelease, TrackedAddon } from "../providers";
import {
	AddonKind,
	decodeProviderRef,
	describeProviders,
	encodeProviderRef,
	explainLookup,
	MODRINTH_UNSUPPORTED,
	providerById,
	resolveProvider,
	targetLoaders,
} from "../providers";
import { DISABLED_SUFFIX, enabledName, replaceFiles } from "../shared";
import { readSidecar, type Sidecar, type SidecarEntry, writeSidecar } from "./addonSidecar";
import { addonTarget } from "./addonTarget";
import { addonUpdates } from "./addonUpdates";
import { resolveDependencies } from "./dependencies";
import { assertInstallSafety } from "./installSafety";

const PAGE_SIZE = 20;

interface PendingFile {
	release: CatalogRelease;
	project: string;
}

let sidecarLock: Promise<unknown> = Promise.resolve();

const exclusive = <Result>(run: () => Promise<Result>): Promise<Result> => {
	const next = sidecarLock.then(run, run);

	sidecarLock = next.catch(() => undefined);

	return next;
};

const isStale = (tracked: SidecarEntry | undefined, target: AddonTarget) => {
	if (!tracked) {
		return false;
	}

	return tracked.gameVersions
		? !tracked.gameVersions.includes(target.gameVersion)
		: tracked.gameVersion !== target.gameVersion;
};

const assertCompatible = (release: CatalogRelease, target: AddonTarget) => {
	if (release.serverSide === MODRINTH_UNSUPPORTED) {
		throw new BridgeFailureError(
			BridgeFailureCode.NoCatalogVersionAvailable,
			`"${release.title}" only runs on the player's own game, it cannot be installed on a server`,
		);
	}

	if (release.gameVersions && !release.gameVersions.includes(target.gameVersion)) {
		throw new BridgeFailureError(
			BridgeFailureCode.NoCatalogVersionAvailable,
			`"${release.title}" ${release.version} is built for minecraft ${release.gameVersions.join(", ")} and this server runs ${target.gameVersion}`,
		);
	}

	const accepted = targetLoaders(target);

	if (release.loaders && !release.loaders.some((loader) => accepted.includes(loader))) {
		throw new BridgeFailureError(
			BridgeFailureCode.NoCatalogVersionAvailable,
			`"${release.title}" ${release.version} is built for ${release.loaders.join(", ")} and this server is ${target.variant}`,
		);
	}
};

const entryFor = (
	filename: string,
	tracked: SidecarEntry | undefined,
	target: AddonTarget,
	sizeBytes: number,
): Bridge.CatalogEntry => {
	const enabled = !filename.endsWith(DISABLED_SUFFIX);
	const name = enabledName(filename);

	return {
		id: tracked ? encodeProviderRef(tracked.provider, tracked.project) : name,
		provider: tracked?.provider ?? null,
		path: `${target.directory}/${filename}`,
		title: tracked?.title ?? name,
		version: tracked?.version ?? null,
		sizeBytes,
		enabled,
		gameVersion: tracked?.gameVersion ?? null,
		stale: isStale(tracked, target),
		pageUrl: tracked?.pageUrl ?? null,
		icon: tracked?.icon ?? null,
	};
};

const listFiles = async (context: Bridge.Context, target: AddonTarget) => {
	const enabled = await context.files.list(`${target.directory}/*.jar`);
	const disabled = await context.files.list(`${target.directory}/*.jar${DISABLED_SUFFIX}`);

	return [
		...enabled,
		...disabled,
	];
};

const trackedAddons = (entries: Bridge.FileEntry[], sidecar: Sidecar, target: AddonTarget): TrackedAddon[] => {
	return entries.flatMap((entry) => {
		const filename = enabledName(entry.name);
		const tracked = sidecar[filename];

		return tracked
			? [
					{
						filename,
						path: `${target.directory}/${entry.name}`,
						provider: tracked.provider,
						project: tracked.project,
						versionId: tracked.versionId ?? null,
						stale: isStale(tracked, target),
					},
				]
			: [];
	});
};

const findTracked = (sidecar: Sidecar, id: string) => {
	const decoded = decodeProviderRef(id);

	return Object.entries(sidecar)
		.filter(([filename, entry]) => {
			return decoded ? entry.provider === decoded.provider && entry.project === decoded.project : filename === id;
		})
		.map(([filename]) => filename);
};

const KIND_TEXT: Record<AddonKind, Bridge.Text> = {
	[AddonKind.Mod]: {
		ar: "مود",
		en: "mod",
	},
	[AddonKind.Plugin]: {
		ar: "إضافة",
		en: "plugin",
	},
};

const MISSING_TEXT: Record<AddonKind, Bridge.Text> = {
	[AddonKind.Mod]: {
		ar: "تعذّر العثور على المود أو أحد متطلباته لدى مصدره. ابحث عنه مرة ثانية أو اختر مودًا آخر.",
		en: "We couldn't find this mod or one of its dependencies at its source. Search for it again or pick another mod.",
	},
	[AddonKind.Plugin]: {
		ar: "تعذّر العثور على الإضافة أو أحد متطلباتها لدى مصدرها. ابحث عنها مرة ثانية أو اختر إضافة أخرى.",
		en: "We couldn't find this plugin or one of its dependencies at its source. Search for it again or pick another plugin.",
	},
};

const SUBJECT_TEXT: Record<AddonKind, Bridge.Text> = {
	[AddonKind.Mod]: {
		ar: "المود",
		en: "the mod",
	},
	[AddonKind.Plugin]: {
		ar: "الإضافة",
		en: "the plugin",
	},
};

const titleOf = (sidecar: Sidecar, tracked: string[], id: string) => {
	const first = tracked.at(0);
	const entry = first === undefined ? undefined : sidecar[first];

	return entry?.title ?? enabledName(id);
};

const dependenciesText = (count: number): Bridge.Text => {
	if (count === 0) {
		return {
			ar: "",
			en: "",
		};
	}

	return {
		ar: count === 1 ? " مع متطلب واحد" : ` مع ${count} من متطلباته`,
		en: count === 1 ? " with 1 dependency" : ` with ${count} dependencies`,
	};
};

const forget = async (context: Bridge.Context, target: AddonTarget, sidecar: Sidecar, filename: string) => {
	for (const candidate of [
		filename,
		`${filename}${DISABLED_SUFFIX}`,
	]) {
		if (await context.files.exists(`${target.directory}/${candidate}`)) {
			await context.files.remove(`${target.directory}/${candidate}`);
		}
	}

	delete sidecar[filename];
};

const gather = async (
	context: Bridge.Context,
	provider: CatalogProvider,
	target: AddonTarget,
	project: string,
	version: string | null = null,
): Promise<PendingFile[]> => {
	return await explainLookup(
		() =>
			resolveDependencies(
				project,
				(dependency, version) => provider.resolve(context, target, dependency, version),
				version,
			),
		MISSING_TEXT[target.kind],
		SUBJECT_TEXT[target.kind],
	);
};

const installProject = async (
	context: Bridge.Context,
	id: string,
	releaseId?: string,
): Promise<Bridge.CatalogEntry> => {
	const decoded = decodeProviderRef(id);

	if (!decoded) {
		throw new BridgeUserError({
			ar: "تعذّر تثبيت هذه الإضافة من المرجع المستلم. حدّث الصفحة وجرب مرة ثانية.",
			en: `We couldn't install "${id}" because it isn't a provider reference. Refresh the page and try again.`,
		});
	}

	const companion = companionForProject(context, decoded.project);

	if (companion) {
		throw new BridgeUserError({
			ar: `يتم تثبيت ${companion.title} وتحديثه من مفتاح ${companion.feature.switchLabel} في تبويب الإعدادات.`,
			en: `${companion.title} is installed and updated by the ${companion.feature.switchLabel} switch in the Settings tab.`,
		});
	}

	const target = await addonTarget(context);
	const provider = providerById(decoded.provider);

	if (!provider?.supports(target)) {
		throw new BridgeUserError({
			ar: `لا يوجد لدى ${decoded.provider} ما يناسب سيرفر ${target.variant}.`,
			en: `${decoded.provider} has nothing for a ${target.variant} server.`,
		});
	}

	const pending = await gather(context, provider, target, decoded.project, releaseId ?? null);
	const primary = pending.at(0);

	if (!primary) {
		throw new BridgeFailureError(
			BridgeFailureCode.NoCatalogVersionAvailable,
			`this ${target.kind} has no build for ${target.variant} ${target.gameVersion}`,
		);
	}

	for (const entry of pending) {
		assertCompatible(entry.release, target);
	}

	await context.files.ensure(target.directory);

	const sidecar = await readSidecar(context, target.directory);

	for (const entry of pending) {
		for (const dependency of entry.release.dependencies.filter((dependency) => dependency.kind === "incompatible")) {
			if (
				Object.values(sidecar).some(
					(installed) =>
						installed.provider === provider.id
						&& installed.project === dependency.project
						&& (!dependency.version || installed.versionId === dependency.version),
				)
			) {
				throw new BridgeUserError({
					ar: `الإضافة تتعارض مع ${dependency.project} المثبّتة. أزل الإضافة المتعارضة أولًا.`,
					en: `This add-on conflicts with the installed ${dependency.project}. Remove the conflicting add-on first.`,
				});
			}
		}
	}
	await assertInstallSafety(pending, provider.id, sidecar, (filename) =>
		context.files.exists(`${target.directory}/${filename}`),
	);
	const removed: string[] = [];
	const replacements = [];
	for (const entry of pending) {
		const names = findTracked(sidecar, encodeProviderRef(provider.id, entry.project));
		let disabled = false;
		for (const filename of names) {
			disabled ||= await context.files.exists(`${target.directory}/${filename}${DISABLED_SUFFIX}`);
			removed.push(`${target.directory}/${filename}`, `${target.directory}/${filename}${DISABLED_SUFFIX}`);
			delete sidecar[filename];
		}
		const { file } = entry.release;
		replacements.push({
			path: `${target.directory}/${file.filename}${disabled ? DISABLED_SUFFIX : ""}`,
			url: file.url,
			...(file.digest
				? {
						digest: file.digest,
					}
				: {}),
			...(file.sizeBytes === null
				? {}
				: {
						sizeBytes: file.sizeBytes,
					}),
		});
		sidecar[file.filename] = {
			provider: provider.id,
			project: entry.project,
			version: entry.release.version,
			...(entry.release.versionId
				? {
						versionId: entry.release.versionId,
					}
				: {}),
			title: entry.release.title,
			gameVersion: target.gameVersion,
			gameVersions: entry.release.gameVersions,
			icon: entry.release.icon,
			pageUrl: entry.release.pageUrl,
		};
	}
	await replaceFiles(context, replacements, removed, () => writeSidecar(context, target.directory, sidecar));

	context.log("installed an addon", {
		provider: provider.id,
		title: primary.release.title,
		version: primary.release.version,
		files: pending.length,
	});

	const kind = KIND_TEXT[target.kind];
	const dependencies = dependenciesText(pending.length - 1);

	context.activity.report({
		name: BridgeEventName.ModInstalled,
		text: {
			ar: `تم تثبيت ${kind.ar} ${primary.release.title} (${primary.release.version})${dependencies.ar}`,
			en: `Installed ${kind.en} ${primary.release.title} (${primary.release.version})${dependencies.en}`,
		},
		subject: primary.release.title,
		details: {
			kind: target.kind,
			title: primary.release.title,
			version: primary.release.version,
			provider: provider.id,
			dependencies: pending.length - 1,
		},
	});

	return entryFor(
		primary.release.file.filename,
		sidecar[primary.release.file.filename],
		target,
		primary.release.file.sizeBytes ?? 0,
	);
};

const reportRemoved = (context: Bridge.Context, target: AddonTarget, title: string) => {
	const kind = KIND_TEXT[target.kind];

	context.activity.report({
		name: BridgeEventName.ModRemoved,
		text: {
			ar: `تمت إزالة ${kind.ar} ${title}`,
			en: `Removed ${kind.en} ${title}`,
		},
		subject: title,
		details: {
			kind: target.kind,
			title,
		},
	});
};

const removeEntry = async (context: Bridge.Context, id: string) => {
	const target = await addonTarget(context);
	const sidecar = await readSidecar(context, target.directory);
	const tracked = findTracked(sidecar, id);

	if (tracked.length > 0) {
		const title = titleOf(sidecar, tracked, id);

		for (const filename of tracked) {
			await forget(context, target, sidecar, filename);
		}

		await writeSidecar(context, target.directory, sidecar);

		reportRemoved(context, target, title);

		return;
	}

	const name = enabledName(id);

	if (!name.endsWith(".jar")) {
		throw new BridgeUserError({
			ar: `«${id}» غير مثبّت.`,
			en: `"${id}" isn't installed.`,
		});
	}

	await forget(context, target, sidecar, name);
	await writeSidecar(context, target.directory, sidecar);

	reportRemoved(context, target, name);
};

const toggleEntry = async (context: Bridge.Context, id: string, enabled: boolean) => {
	const target = await addonTarget(context);
	const sidecar = await readSidecar(context, target.directory);
	const tracked = findTracked(sidecar, id);
	const names =
		tracked.length > 0
			? tracked
			: [
					enabledName(id),
				];

	let moved = false;

	for (const name of names) {
		const active = `${target.directory}/${name}`;
		const parked = `${active}${DISABLED_SUFFIX}`;

		if (enabled && (await context.files.exists(parked))) {
			await context.files.move(parked, active);

			moved = true;
		}

		if (!enabled && (await context.files.exists(active))) {
			await context.files.move(active, parked);

			moved = true;
		}
	}

	if (!moved) {
		return;
	}

	const kind = KIND_TEXT[target.kind];
	const title = titleOf(sidecar, tracked, id);

	context.activity.report({
		name: enabled ? BridgeEventName.ModEnabled : BridgeEventName.ModDisabled,
		text: enabled
			? {
					ar: `تم تفعيل ${kind.ar} ${title}`,
					en: `Enabled ${kind.en} ${title}`,
				}
			: {
					ar: `تم إيقاف ${kind.ar} ${title}`,
					en: `Disabled ${kind.en} ${title}`,
				},
		subject: title,
		details: {
			kind: target.kind,
			title,
		},
	});
};

export const addons: Bridge.Catalog = {
	kind: BridgeKind.Catalog,
	pageSize: PAGE_SIZE,

	async search(context, query) {
		const target = await addonTarget(context);
		const provider = resolveProvider(context, target, query.provider);
		const providers = describeProviders(context, target);

		if (!provider) {
			return {
				hits: [],
				total: 0,
				providers,
				categories: [],
				sorts: [],
			};
		}

		const facets = {
			providers,
			categories: provider.categories(target),
			sorts: provider.sorts,
		};

		if (!provider.ready(context)) {
			return {
				hits: [],
				total: 0,
				...facets,
			};
		}

		const results = await provider.search(context, target, {
			query: query.query,
			page: query.page,
			pageSize: PAGE_SIZE,
			category: query.category,
			sort: query.sort,
		});

		return {
			hits: results.hits
				.filter((hit) => !companionForProject(context, hit.id))
				.map((hit) => {
					return {
						...hit,
						id: encodeProviderRef(provider.id, hit.id),
						provider: provider.id,
					};
				}),
			total: results.total,
			...facets,
		};
	},

	async installed(context) {
		const target = await addonTarget(context);
		const sidecar = await readSidecar(context, target.directory);
		const entries = (await listFiles(context, target)).filter(
			(entry) => !isCompanionFile(context, enabledName(entry.name)),
		);
		const updates = await addonUpdates(context, target, trackedAddons(entries, sidecar, target));

		return entries.map((entry) => {
			return {
				...entryFor(entry.name, sidecar[enabledName(entry.name)], target, entry.sizeBytes),
				update: updates.get(enabledName(entry.name)) ?? null,
			};
		});
	},

	async releases(context, id) {
		const ref = decodeProviderRef(id);
		const provider = ref ? providerById(ref.provider) : null;
		return ref && provider?.releases ? provider.releases(context, await addonTarget(context), ref.project) : [];
	},
	async preview(context, id, releaseId) {
		const ref = decodeProviderRef(id);
		const provider = ref ? providerById(ref.provider) : null;
		if (!ref || !provider) {
			throw new BridgeUserError({
				ar: "اختر إضافة من الكتالوج.",
				en: "Choose an add-on from the catalog.",
			});
		}
		const target = await addonTarget(context);
		const pending = await gather(context, provider, target, ref.project, releaseId ?? null);
		for (const entry of pending) {
			assertCompatible(entry.release, target);
		}
		return {
			confirm: BridgeConfirm.Normal,
			lines: [
				{
					ar: "يظهر التغيير بعد ريستارت سيرفرك.",
					en: "The change only shows after you restart your server.",
				},
				...pending.map((entry) => ({
					ar: `${entry.release.title}: ${entry.release.version}`,
					en: `${entry.release.title}: ${entry.release.version}`,
				})),
			],
		};
	},

	async install(context, id, releaseId) {
		return await exclusive(() => installProject(context, id, releaseId));
	},

	async remove(context, id) {
		await exclusive(() => removeEntry(context, id));
	},

	async toggle(context, id, enabled) {
		await exclusive(() => toggleEntry(context, id, enabled));
	},
};
