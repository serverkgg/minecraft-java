import type { Bridge } from "@serverkgg/bridge";
import {
	CatalogProviderId,
	type ModpackProject,
	type ModpackRelease,
	modpackProject,
	modpackRelease,
} from "../providers";
import { mapConcurrent, type ServerVariant, STAGING_ROOT } from "../shared";
import { CLIENT_ONLY_DIRECTORIES, fileNameOf, isClientOnlyFilename } from "./clientMods";
import { modpackCleanup } from "./modpackCleanup";
import {
	MODPACK_INDEX,
	type ModpackFile,
	type ModpackIndex,
	parseModpackIndex,
	variantForLoaders,
} from "./modpackIndex";
import { decodeModpackRef, type ModpackRef } from "./modpackRef";
import { clearModpackSidecar, type ModpackSidecar, readModpackSidecar, writeModpackSidecar } from "./modpackSidecar";
import { partitionModpackFiles, resolveUnsupported } from "./modpackSideness";

export const MODPACK_VARIABLE = "MODPACK";

const PACK_STAGING = `${STAGING_ROOT}/pack`;

const ARCHIVE = `${PACK_STAGING}/modpack.mrpack`;

const INDEX_PATH = `${PACK_STAGING}/${MODPACK_INDEX}`;

const OVERRIDE_FOLDERS = [
	"overrides",
	"server-overrides",
];

const PROGRESS_STEP = 25;

const DOWNLOAD_WIDTH = 4;

const THROTTLE_ATTEMPTS = 3;

const THROTTLE_WAIT_MS = 20_000;

const THROTTLED_PATTERN = /\b429\b/;

const NO_MATCHING_FILES = "contained no matching files";

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
}

const isEmptySelection = (error: unknown) => {
	return error instanceof Error && error.message.endsWith(NO_MATCHING_FILES);
};

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

const applyOverrides = async (context: Bridge.Context, folder: string) => {
	try {
		const written = await context.files.extract(ARCHIVE, "", {
			tree: true,
			select: `${folder}/`,
		});

		const removed = await pruneClientOnly(context, written);
		const kept = written.filter((path) => !removed.has(path));

		context.log("copied the modpack's own files", {
			folder,
			files: kept.length,
			skipped: removed.size,
		});

		return kept;
	} catch (error) {
		if (!isEmptySelection(error)) {
			throw error;
		}
	}

	return [];
};

const isThrottled = (error: unknown) => {
	return error instanceof Error && THROTTLED_PATTERN.test(error.message);
};

const wait = (ms: number) => {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

const downloadFile = async (context: Bridge.Context, file: ModpackFile) => {
	const options = {
		cache: true,
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
	};

	for (let attempt = 1; ; attempt += 1) {
		try {
			await context.files.download(file.path, file.url, options);

			return;
		} catch (error) {
			if (attempt > THROTTLE_ATTEMPTS || !isThrottled(error)) {
				throw error;
			}

			context.log.warn("the download limit was reached, waiting before carrying on", {
				file: fileNameOf(file.path),
				attempt,
			});

			await wait(THROTTLE_WAIT_MS * attempt);
		}
	}
};

const downloadFiles = async (context: Bridge.Context, files: ModpackFile[]) => {
	let done = 0;
	let milestone = 0;

	await mapConcurrent(files, DOWNLOAD_WIDTH, async (file) => {
		await downloadFile(context, file);

		done += 1;

		if (done - milestone >= PROGRESS_STEP && done < files.length) {
			milestone = done;

			context.log("downloading the modpack", {
				done,
				total: files.length,
			});
		}
	});
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
			pinnedBuild: sidecar?.loaderVersion ?? null,
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

export const stageModpack = async (
	context: Bridge.Context,
	ref: ModpackRef,
	variant: ServerVariant,
	version: string,
): Promise<StagedModpack | null> => {
	if (ref.provider !== CatalogProviderId.Modrinth) {
		context.log.warn("this modpack comes from a source we cannot install, skipping it", {
			provider: ref.provider,
		});

		return null;
	}

	const release = await modpackRelease(context, ref.versionId);

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

	const project = await modpackProject(context, ref.project);

	context.log("downloading the modpack", {
		title: project.title,
		version: release.version,
		sizeBytes: release.file.sizeBytes,
	});

	await clearStaging(context);
	await context.files.download(ARCHIVE, release.file.url, {
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

	await context.files.extract(ARCHIVE, PACK_STAGING, {
		tree: true,
		extensions: [
			"json",
		],
	});

	const index = parseModpackIndex(await context.files.read(INDEX_PATH));

	if (index.variant !== variant || index.mcVersion !== version) {
		context.log.warn("the modpack does not match this server type or version, leaving it out", {
			wants: `${index.variant} ${index.mcVersion}`,
			server: `${variant} ${version}`,
		});

		await clearStaging(context);

		return null;
	}

	return {
		ref,
		project,
		release,
		index,
	};
};

export const applyModpack = async (context: Bridge.Context, staged: StagedModpack) => {
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

	const { keep, skipped } = partitionModpackFiles(index.files, await resolveUnsupported(context, index.files));

	if (skipped.length > 0) {
		context.log.warn("left out the modpack's client-side files, they cannot run on a server", {
			skipped: skipped.length,
			example: fileNameOf(skipped[0]?.path ?? ""),
		});
	}

	context.log("installing the modpack", {
		title: project.title,
		version: release.version,
		files: keep.length,
	});

	await downloadFiles(context, keep);

	const installed = keep.map((file) => file.path);

	for (const folder of OVERRIDE_FOLDERS) {
		installed.push(...(await applyOverrides(context, folder)));
	}

	await writeModpackSidecar(context, {
		provider: ref.provider,
		project: ref.project,
		versionId: ref.versionId,
		version: release.version,
		title: project.title,
		icon: project.icon,
		pageUrl: project.pageUrl,
		mcVersion: index.mcVersion,
		variant: index.variant,
		loaderVersion: index.loaderVersion,
		appliedAt: new Date().toISOString(),
		fileCount: keep.length,
		skippedCount: skipped.length,
		files: installed,
	});

	await clearStaging(context);

	context.log("the modpack is ready", {
		title: project.title,
		version: release.version,
	});
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
