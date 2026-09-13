import { type Bridge, BridgeDownloadError } from "@serverkgg/bridge";
import { CatalogProviderId, type ModpackProject, type ModpackRelease, modpackSourceById } from "../providers";
import {
	createRequestPacer,
	fileNameOf,
	mapConcurrent,
	type RequestPacer,
	type ServerVariant,
	STAGING_ROOT,
} from "../shared";
import { CLIENT_ONLY_DIRECTORIES, isClientOnlyFilename } from "./clientMods";
import { modpackCleanup } from "./modpackCleanup";
import {
	MODPACK_INDEX,
	MODS_DIRECTORY,
	type ModpackFile,
	type ModpackIndex,
	modPath,
	parseModpackIndex,
	variantForLoaders,
} from "./modpackIndex";
import { MODPACK_MANIFEST, parseCurseforgeManifest, resolveCurseforgeFiles } from "./modpackManifest";
import { reconcilePendingFiles } from "./modpackPendingFiles";
import { decodeModpackRef, type ModpackRef } from "./modpackRef";
import { rescueFromServerPack } from "./modpackServerPack";
import {
	clearModpackSidecar,
	type ModpackSidecar,
	type PendingFile,
	readModpackSidecar,
	writeModpackSidecar,
} from "./modpackSidecar";
import { partitionModpackFiles, resolveModpackSignals } from "./modpackSideness";

export const MODPACK_VARIABLE = "MODPACK";

const PACK_STAGING = `${STAGING_ROOT}/pack`;

const MODRINTH_ARCHIVE = `${PACK_STAGING}/modpack.mrpack`;

const CURSEFORGE_ARCHIVE = `${PACK_STAGING}/modpack.zip`;

const MODRINTH_OVERRIDES = [
	"overrides",
	"server-overrides",
];

const OVERRIDE_EXCLUDES = [
	"resourcepacks/**",
	"shaderpacks/**",
];

const CURSEFORGE_OVERRIDE_EXCLUDES = [
	...OVERRIDE_EXCLUDES,
	"saves/**",
];

const PROGRESS_STEP = 10;

const DOWNLOAD_WIDTH = 4;

const THROTTLE_WAIT_MS = 65_000;

const DOWNLOAD_DEADLINE_MS = 15 * 60_000;

const THROTTLED_STATUS = 429;

export enum ModpackPlanKind {
	Apply = "apply",
	Current = "current",
	Detach = "detach",
	None = "none",
}

export interface ModpackPlan {
	kind: ModpackPlanKind;
	ref: ModpackRef | null;
	sidecar: ModpackSidecar | null;
	pinnedBuild: string | null;
}

export interface StagedModpack {
	ref: ModpackRef;
	project: ModpackProject;
	release: ModpackRelease;
	index: ModpackIndex;
	archive: string;
	overrides: string[];
	excludes: string[];
	prepared?: ModpackFile[];
}

const clearStaging = async (context: Bridge.Context) => {
	await context.files.remove(PACK_STAGING);
};

const removePaths = async (context: Bridge.Context, paths: string[]) => {
	for (const path of paths) {
		await context.files.remove(path);
	}
};

const pruneClientOnly = async (context: Bridge.Context, written: string[]) => {
	const directories = new Set<string>();
	const files: string[] = [];

	for (const path of written) {
		const directory = path.split("/").at(0) ?? "";

		if (CLIENT_ONLY_DIRECTORIES.includes(directory.toLowerCase())) {
			directories.add(directory);
		} else if (isClientOnlyFilename(fileNameOf(path))) {
			files.push(path);
		}
	}

	try {
		for (const target of [
			...directories,
			...files,
		]) {
			await context.files.remove(target);
		}
	} catch (error) {
		context.log.warn("could not remove every client-side file the modpack shipped", {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	const removed = new Set(files);

	for (const path of written) {
		if (directories.has(path.split("/").at(0) ?? "")) {
			removed.add(path);
		}
	}

	return removed;
};

const applyOverrides = async (context: Bridge.Context, staged: StagedModpack, folder: string) => {
	const written = await context.files.extract(staged.archive, "", {
		tree: true,
		selects: [
			`${folder}/`,
		],
		exclude: staged.excludes,
	});

	const removed = await pruneClientOnly(context, written);
	const kept = written.filter((path) => !removed.has(path));

	context.log("copied the modpack's own files", {
		folder,
		files: kept.length,
		skipped: removed.size,
	});

	return kept;
};

const isThrottled = (error: unknown) => {
	return error instanceof BridgeDownloadError && error.status === THROTTLED_STATUS;
};

const wait = (ms: number) => {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

const downloadFile = async (context: Bridge.Context, file: ModpackFile, pacer: RequestPacer, deadline: number) => {
	const options = {
		cache: true,
		digest: file.digest,
		quiet: true,
		...(file.sizeBytes === null
			? {}
			: {
					sizeBytes: file.sizeBytes,
				}),
	};

	for (;;) {
		await pacer.acquire();

		try {
			await context.files.download(file.path, file.url, options);

			return;
		} catch (error) {
			if (!isThrottled(error) || Date.now() + THROTTLE_WAIT_MS >= deadline) {
				throw error;
			}

			context.log.warn("the download limit was reached, waiting before carrying on", {
				file: fileNameOf(file.path),
			});

			await wait(THROTTLE_WAIT_MS);
		}
	}
};

const totalBytesOf = (files: ModpackFile[]) => {
	let total = 0;

	for (const file of files) {
		if (file.sizeBytes === null) {
			return null;
		}

		total += file.sizeBytes;
	}

	return total;
};

const downloadFiles = async (context: Bridge.Context, files: ModpackFile[]) => {
	const pacer = createRequestPacer();
	const started = Date.now();
	const deadline = started + DOWNLOAD_DEADLINE_MS;
	const total = files.length;
	const totalBytes = totalBytesOf(files);

	context.log("downloading the modpack's files", {
		files: total,
		sizeBytes: totalBytes,
	});

	let done = 0;
	let doneBytes = 0;
	let milestone = 0;

	await mapConcurrent(files, DOWNLOAD_WIDTH, async (file) => {
		await downloadFile(context, file, pacer, deadline);

		done += 1;
		doneBytes += file.sizeBytes ?? 0;

		const reached = Math.floor(
			totalBytes === null ? (done / total) * 100 : (doneBytes / Math.max(totalBytes, 1)) * 100,
		);

		if (reached >= milestone + PROGRESS_STEP && done < total) {
			milestone = Math.floor(reached / PROGRESS_STEP) * PROGRESS_STEP;

			context.log("downloading the modpack's files", {
				done: `${done}/${total}`,
				percent: milestone,
				file: fileNameOf(file.path),
			});
		}
	});

	context.log("downloaded the modpack's files", {
		files: total,
		sizeBytes: totalBytes,
		seconds: Math.round((Date.now() - started) / 1000),
	});
};

export const parentDirectoriesOf = (paths: string[]) => {
	return [
		...new Set(paths.map((path) => path.split("/").slice(0, -1).join("/")).filter((directory) => directory.length > 0)),
	];
};

export const placePreparedFiles = async (context: Bridge.Context, files: ModpackFile[]) => {
	await context.files.ensure(MODS_DIRECTORY, ...parentDirectoriesOf(files.map((file) => file.path)));

	for (const file of files) {
		await context.files.move(`${PACK_STAGING}/content/${file.path}`, file.path);
	}
};

export const detachPinnedBuild = (sidecar: ModpackSidecar | null, variant: ServerVariant) => {
	return sidecar !== null && sidecar.variant === variant ? sidecar.loaderVersion : null;
};

export const modpackPlan = async (
	context: Bridge.Context,
	variant: ServerVariant,
	version: string,
): Promise<ModpackPlan> => {
	const declared = context.variable(MODPACK_VARIABLE) ?? "";
	const sidecar = await readModpackSidecar(context);

	const detach = (): ModpackPlan => {
		return {
			kind: ModpackPlanKind.Detach,
			ref: null,
			sidecar,
			pinnedBuild: detachPinnedBuild(sidecar, variant),
		};
	};

	if (declared.length === 0) {
		return sidecar
			? detach()
			: {
					kind: ModpackPlanKind.None,
					ref: null,
					sidecar: null,
					pinnedBuild: null,
				};
	}

	const ref = decodeModpackRef(declared);

	if (!ref) {
		context.log.warn("the modpack setting is not readable, leaving the server as it is", {
			value: declared,
		});

		return {
			kind: ModpackPlanKind.None,
			ref: null,
			sidecar,
			pinnedBuild: sidecar?.loaderVersion ?? null,
		};
	}

	const installed =
		sidecar !== null
		&& sidecar.provider === ref.provider
		&& sidecar.project === ref.project
		&& sidecar.versionId === ref.versionId
			? sidecar
			: null;

	if (installed && (installed.variant !== variant || installed.mcVersion !== version)) {
		context.log.warn("the server type or version no longer matches the modpack, removing the modpack", {
			modpack: `${installed.variant} ${installed.mcVersion}`,
			server: `${variant} ${version}`,
		});

		return detach();
	}

	return {
		kind: installed ? ModpackPlanKind.Current : ModpackPlanKind.Apply,
		ref,
		sidecar,
		pinnedBuild: installed?.loaderVersion ?? null,
	};
};

const downloadArchive = async (context: Bridge.Context, archive: string, release: ModpackRelease) => {
	await clearStaging(context);
	await context.files.download(archive, release.file.url, {
		cache: true,
		...(release.file.digest === null
			? {}
			: {
					digest: release.file.digest,
				}),
		...(release.file.sizeBytes === null
			? {}
			: {
					sizeBytes: release.file.sizeBytes,
				}),
	});
};

const stageModrinth = async (context: Bridge.Context, archive: string) => {
	await context.files.extract(archive, PACK_STAGING, {
		tree: true,
		selects: [
			MODPACK_INDEX,
		],
	});

	return {
		index: parseModpackIndex(await context.files.read(`${PACK_STAGING}/${MODPACK_INDEX}`)),
		overrides: MODRINTH_OVERRIDES,
		excludes: OVERRIDE_EXCLUDES,
	};
};

const stageCurseforge = async (context: Bridge.Context, archive: string) => {
	await context.files.extract(archive, PACK_STAGING, {
		tree: true,
		selects: [
			MODPACK_MANIFEST,
		],
	});

	const manifest = parseCurseforgeManifest(await context.files.read(`${PACK_STAGING}/${MODPACK_MANIFEST}`));

	return {
		index: await resolveCurseforgeFiles(context, manifest),
		overrides: [
			manifest.overrides,
		],
		excludes: CURSEFORGE_OVERRIDE_EXCLUDES,
	};
};

export const stageModpack = async (
	context: Bridge.Context,
	ref: ModpackRef,
	variant: ServerVariant,
	version: string,
): Promise<StagedModpack | null> => {
	const source = modpackSourceById(ref.provider);

	if (source.id !== ref.provider) {
		context.log.warn("this modpack comes from a source we cannot install, skipping it", {
			provider: ref.provider,
		});

		return null;
	}

	if (!source.ready(context)) {
		context.log.warn("this modpack's source is not configured, skipping it", {
			provider: ref.provider,
		});

		return null;
	}

	const release = await source.release(context, ref.project, ref.versionId);

	if (!release) {
		context.log.warn("could not find this modpack version, skipping it", {
			project: ref.project,
			version: ref.versionId,
		});

		return null;
	}

	if (variantForLoaders(release.loaders) !== variant || !release.gameVersions.includes(version)) {
		context.log.warn("the modpack does not match this server type or version, leaving it out", {
			project: ref.project,
			wants: `${release.loaders.join("/")} ${release.gameVersions.join("/")}`,
			server: `${variant} ${version}`,
		});

		return null;
	}

	const project = await source.project(context, ref.project);
	const archive = ref.provider === CatalogProviderId.CurseForge ? CURSEFORGE_ARCHIVE : MODRINTH_ARCHIVE;

	context.log("downloading the modpack", {
		title: project.title,
		version: release.version,
		sizeBytes: release.file.sizeBytes,
	});

	await downloadArchive(context, archive, release);

	const staged =
		ref.provider === CatalogProviderId.CurseForge
			? await stageCurseforge(context, archive)
			: await stageModrinth(context, archive);

	if (staged.index.variant !== variant || staged.index.mcVersion !== version) {
		context.log.warn("the modpack does not match this server type or version, leaving it out", {
			wants: `${staged.index.variant} ${staged.index.mcVersion}`,
			server: `${variant} ${version}`,
		});

		await clearStaging(context);

		return null;
	}

	const { keep, skipped } = partitionModpackFiles(
		staged.index.files,
		await resolveModpackSignals(context, staged.index.files),
	);
	await downloadFiles(
		context,
		keep.map((file) => ({
			...file,
			path: `${PACK_STAGING}/content/${file.path}`,
		})),
	);
	if (skipped.length > 0) {
		context.log("excluded client-only modpack files", {
			count: skipped.length,
		});
	}

	return {
		archive,
		prepared: keep,
		excludes: staged.excludes,
		index: staged.index,
		overrides: staged.overrides,
		project,
		ref,
		release,
	};
};

export const applyModpack = async (context: Bridge.Context, staged: StagedModpack): Promise<PendingFile[]> => {
	const { index, project, release, ref } = staged;
	const previous = await readModpackSidecar(context);
	const cleanup = modpackCleanup(previous?.files ?? null);

	context.log(
		cleanup.wholesale
			? "clearing the old mods and configs before the modpack goes in"
			: "removing the files the last modpack installed, everything you added stays",
		{
			files: cleanup.paths.length,
		},
	);

	await removePaths(context, cleanup.paths);

	const { keep, skipped } = staged.prepared
		? {
				keep: staged.prepared,
				skipped: [],
			}
		: partitionModpackFiles(index.files, await resolveModpackSignals(context, index.files));

	if (skipped.length > 0) {
		context.log.warn("left out the modpack's client-side files, they cannot run on a server", {
			skipped: skipped.length,
			example: fileNameOf(skipped.at(0)?.path ?? ""),
		});
	}

	context.log("installing the modpack", {
		title: project.title,
		version: release.version,
		files: keep.length,
	});

	if (staged.prepared) {
		await placePreparedFiles(context, keep);
	} else {
		await downloadFiles(context, keep);
	}

	const installed = keep.map((file) => file.path);

	const settled = await reconcilePendingFiles(context, index.blocked);

	installed.push(...settled.present);

	if (settled.present.length > 0) {
		context.log("the modpack files you uploaded before are already in place", {
			files: settled.present.length,
		});
	}

	const rescue = await rescueFromServerPack(context, release.serverPacks, settled.pending);

	installed.push(...rescue.rescued.map((file) => modPath(file.fileName)));

	if (rescue.missing.length > 0) {
		context.log.warn("the modpack needs files only you can download, your server waits until they are here", {
			pending: rescue.missing.length,
			example: rescue.missing.at(0)?.fileName ?? "",
		});
	}

	for (const folder of staged.overrides) {
		installed.push(...(await applyOverrides(context, staged, folder)));
	}

	await writeModpackSidecar(context, {
		provider: ref.provider,
		project: ref.project,
		versionId: ref.versionId,
		version: release.version,
		title: project.title,
		icon: project.icon,
		pageUrl: project.pageUrl,
		description: project.description,
		author: project.author,
		downloads: project.downloads,
		mcVersion: index.mcVersion,
		variant: index.variant,
		loaderVersion: index.loaderVersion,
		appliedAt: new Date().toISOString(),
		fileCount: keep.length,
		files: installed,
		pending: rescue.missing,
	});

	await clearStaging(context);

	context.log("the modpack is ready", {
		title: project.title,
		version: release.version,
	});

	return rescue.missing;
};

export const detachModpack = async (context: Bridge.Context) => {
	const previous = await readModpackSidecar(context);
	const cleanup = modpackCleanup(previous?.files ?? null);

	context.log("removing the modpack and everything it installed", {
		files: cleanup.paths.length,
	});

	await removePaths(context, cleanup.paths);

	await clearModpackSidecar(context);
	await clearStaging(context);
};
