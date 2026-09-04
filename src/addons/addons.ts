import { type Bridge, BridgeFailureCode, BridgeFailureError, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { companionForProject, isCompanionFile } from "../companions";
import type { AddonTarget, CatalogProvider, CatalogRelease } from "../providers";
import {
	decodeProviderRef,
	describeProviders,
	encodeProviderRef,
	MODRINTH_UNSUPPORTED,
	providerById,
	resolveProvider,
	targetLoaders,
} from "../providers";
import { DISABLED_SUFFIX, enabledName } from "../shared";
import { readSidecar, type Sidecar, type SidecarEntry, writeSidecar } from "./addonSidecar";
import { addonTarget } from "./addonTarget";

const PAGE_SIZE = 20;

const MAX_DEPENDENCIES = 8;

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

const findTracked = (sidecar: Sidecar, id: string) => {
	const decoded = decodeProviderRef(id);

	return Object.entries(sidecar)
		.filter(([filename, entry]) => {
			return decoded ? entry.provider === decoded.provider && entry.project === decoded.project : filename === id;
		})
		.map(([filename]) => filename);
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
): Promise<PendingFile[]> => {
	const release = await provider.resolve(context, target, project);

	if (!release) {
		return [];
	}

	const pending: PendingFile[] = [
		{
			release,
			project,
		},
	];

	for (const dependency of release.dependencies) {
		if (pending.length >= MAX_DEPENDENCIES) {
			break;
		}

		if (pending.some((entry) => entry.project === dependency)) {
			continue;
		}

		try {
			const resolved = await provider.resolve(context, target, dependency);

			if (resolved) {
				pending.push({
					release: resolved,
					project: dependency,
				});
			}
		} catch {
			context.log("skipped a dependency we could not resolve", {
				provider: provider.id,
				dependency,
			});
		}
	}

	return pending;
};

const installProject = async (context: Bridge.Context, id: string): Promise<Bridge.CatalogEntry> => {
	const decoded = decodeProviderRef(id);

	if (!decoded) {
		throw new BridgeUserError({
			ar: "ما نقدر نركّب هذي الإضافة من المرجع اللي وصلنا. حدّث الصفحة وجرّب مرة ثانية.",
			en: `"${id}" is not a provider reference.`,
		});
	}

	const companion = companionForProject(context, decoded.project);

	if (companion) {
		throw new BridgeUserError({
			ar: `${companion.title} يتركّب ويتحدّث من مفتاح ${companion.feature.switchLabel} في تبويب الإعدادات.`,
			en: `${companion.title} is installed and updated by the ${companion.feature.switchLabel} switch in the settings tab.`,
		});
	}

	const target = await addonTarget(context);
	const provider = providerById(decoded.provider);

	if (!provider?.supports(target)) {
		throw new BridgeUserError({
			ar: `${decoded.provider} ما عنده شي يناسب سيرفر ${target.variant}.`,
			en: `${decoded.provider} has nothing for a ${target.variant} server.`,
		});
	}

	const pending = await gather(context, provider, target, decoded.project);
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
		for (const filename of findTracked(sidecar, encodeProviderRef(provider.id, entry.project))) {
			await forget(context, target, sidecar, filename);
		}
	}

	for (const entry of pending) {
		const { file } = entry.release;

		await context.files.download(`${target.directory}/${file.filename}`, file.url, {
			...(file.digest === null
				? {}
				: {
						digest: file.digest,
					}),
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
			title: entry.release.title,
			gameVersion: target.gameVersion,
			gameVersions: entry.release.gameVersions,
			icon: entry.release.icon,
			pageUrl: entry.release.pageUrl,
		};
	}

	await writeSidecar(context, target.directory, sidecar);

	context.log("installed an addon", {
		provider: provider.id,
		title: primary.release.title,
		version: primary.release.version,
		files: pending.length,
	});

	return entryFor(
		primary.release.file.filename,
		sidecar[primary.release.file.filename],
		target,
		primary.release.file.sizeBytes ?? 0,
	);
};

const removeEntry = async (context: Bridge.Context, id: string) => {
	const target = await addonTarget(context);
	const sidecar = await readSidecar(context, target.directory);
	const tracked = findTracked(sidecar, id);

	if (tracked.length > 0) {
		for (const filename of tracked) {
			await forget(context, target, sidecar, filename);
		}

		await writeSidecar(context, target.directory, sidecar);

		return;
	}

	const name = enabledName(id);

	if (!name.endsWith(".jar")) {
		throw new BridgeUserError({
			ar: `"${id}" مو مركّب.`,
			en: `"${id}" is not installed.`,
		});
	}

	await forget(context, target, sidecar, name);
	await writeSidecar(context, target.directory, sidecar);
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

	for (const name of names) {
		const active = `${target.directory}/${name}`;
		const parked = `${active}${DISABLED_SUFFIX}`;

		if (enabled && (await context.files.exists(parked))) {
			await context.files.move(parked, active);
		}

		if (!enabled && (await context.files.exists(active))) {
			await context.files.move(active, parked);
		}
	}
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
		const entries = await listFiles(context, target);

		return entries
			.filter((entry) => !isCompanionFile(context, enabledName(entry.name)))
			.map((entry) => {
				return entryFor(entry.name, sidecar[enabledName(entry.name)], target, entry.sizeBytes);
			});
	},

	async install(context, id) {
		return await exclusive(() => installProject(context, id));
	},

	async remove(context, id) {
		await exclusive(() => removeEntry(context, id));
	},

	async toggle(context, id, enabled) {
		await exclusive(() => toggleEntry(context, id, enabled));
	},
};
