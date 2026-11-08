import type { Bridge } from "@serverkgg/bridge";
import { resolveDependencies } from "../addons";
import { declaredModIds, installedModIds } from "../events";
import {
	type AddonTarget,
	type CatalogRelease,
	MODRINTH_EMBEDDED,
	MODRINTH_REQUIRED,
	MODRINTH_UNSUPPORTED,
	type ModrinthVersion,
	modrinthProvider,
	modrinthVersionId,
	modrinthVersions,
	targetLoaders,
} from "../providers";
import { fileNameOf } from "../shared";
import { isClientOnlyFilename } from "./clientMods";
import { downloadFiles, LIBRARIES_STAGING } from "./modpackDownload";
import { MODS_DIRECTORY, type ModpackFile, modPath } from "./modpackIndex";

export interface MissingDependency {
	project: string;
	version: string | null;
}

export const providedProjects = (kept: ModpackFile[], versions: ModrinthVersion[]): Set<string> => {
	const provided = new Set<string>();

	for (const file of kept) {
		if (file.projectId !== null) {
			provided.add(file.projectId);
		}
	}

	for (const version of versions) {
		for (const dependency of version.dependencies) {
			if (dependency.dependency_type === MODRINTH_EMBEDDED && dependency.project_id !== null) {
				provided.add(dependency.project_id);
			}
		}
	}

	return provided;
};

export const missingDependencies = (
	versions: ModrinthVersion[],
	provided: Set<string>,
	unsupported: Set<string>,
): MissingDependency[] => {
	const pins = new Map<string, Set<string>>();

	for (const version of versions) {
		for (const dependency of version.dependencies) {
			const project = dependency.project_id;

			if (
				dependency.dependency_type !== MODRINTH_REQUIRED
				|| project === null
				|| provided.has(project)
				|| unsupported.has(project)
			) {
				continue;
			}

			const pinned = pins.get(project) ?? new Set<string>();

			if (dependency.version_id) {
				pinned.add(dependency.version_id);
			}

			pins.set(project, pinned);
		}
	}

	return [
		...pins.keys(),
	]
		.sort()
		.map((project) => {
			const pinned = [
				...(pins.get(project) ?? []),
			];

			return {
				project,
				version: pinned.length === 1 ? (pinned.at(0) ?? null) : null,
			};
		});
};

const fitsTarget = (release: CatalogRelease, target: AddonTarget) => {
	const loaders = targetLoaders(target);

	return (
		(release.loaders === null || release.loaders.some((loader) => loaders.includes(loader)))
		&& (release.gameVersions === null || release.gameVersions.includes(target.gameVersion))
	);
};

const libraryFile = (
	context: Bridge.Context,
	project: string,
	release: CatalogRelease,
	target: AddonTarget,
	unsupported: Set<string>,
): ModpackFile | null => {
	const { file } = release;

	if (release.serverSide === MODRINTH_UNSUPPORTED || unsupported.has(project) || isClientOnlyFilename(file.filename)) {
		context.log.warn("left out a library the modpack's mods need, it only runs on a player's pc", {
			project,
			file: file.filename,
		});

		return null;
	}

	if (!fitsTarget(release, target)) {
		context.log.warn("left out a library the modpack's mods need, its release is for another loader or version", {
			project,
			file: file.filename,
			loaders: release.loaders?.join("/") ?? "",
			gameVersions: release.gameVersions?.join("/") ?? "",
		});

		return null;
	}

	if (file.digest === null) {
		context.log.warn("left out a library the modpack's mods need, modrinth lists no checksum for it", {
			project,
			file: file.filename,
		});

		return null;
	}

	return {
		path: modPath(file.filename),
		url: file.url,
		digest: file.digest,
		sizeBytes: file.sizeBytes,
		projectId: project,
	};
};

const chooseLibraries = async (
	context: Bridge.Context,
	missing: MissingDependency[],
	provided: Set<string>,
	unsupported: Set<string>,
	target: AddonTarget,
) => {
	const chosen = new Map<string, ModpackFile>();

	for (const dependency of missing) {
		try {
			const closure = await resolveDependencies(
				dependency.project,
				(project, version) => modrinthProvider.resolve(context, target, project, version),
				dependency.version,
			);

			for (const { project, release } of closure) {
				if (provided.has(project) || chosen.has(project)) {
					continue;
				}

				const library = libraryFile(context, project, release, target, unsupported);

				if (library !== null) {
					chosen.set(project, library);
				}
			}
		} catch (error) {
			context.log.warn("could not find a release of a library the modpack's mods need, leaving it out", {
				project: dependency.project,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return [
		...chosen.values(),
	];
};

const stagedPath = (library: ModpackFile) => {
	return `${LIBRARIES_STAGING}/${fileNameOf(library.path)}`;
};

const placeLibraries = async (context: Bridge.Context, libraries: ModpackFile[], placed: ModpackFile[]) => {
	const owners = await installedModIds(context);

	await context.files.ensure(MODS_DIRECTORY);

	for (const library of libraries) {
		const staged = stagedPath(library);
		const ids = (await declaredModIds(context, staged)).map((id) => id.toLowerCase());
		const owner = ids.map((id) => owners.get(id)).find((jar) => jar !== undefined);

		if (owner !== undefined) {
			context.log.warn("left out a library the modpack's mods need, a jar in mods already provides it", {
				file: fileNameOf(library.path),
				jar: owner,
			});

			await context.files.remove(staged);

			continue;
		}

		await context.files.move(staged, library.path);

		for (const id of ids) {
			owners.set(id, fileNameOf(library.path));
		}

		placed.push(library);
	}
};

export const resolveMissingLibraries = async (
	context: Bridge.Context,
	kept: ModpackFile[],
	unsupported: Set<string>,
	target: AddonTarget,
): Promise<ModpackFile[]> => {
	const placed: ModpackFile[] = [];

	try {
		const ids = kept.flatMap((file) => {
			const versionId = modrinthVersionId(file.url);

			return versionId === null
				? []
				: [
						versionId,
					];
		});

		if (ids.length === 0) {
			return placed;
		}

		const versions = await modrinthVersions(context, ids);
		const provided = providedProjects(kept, versions);
		const libraries = await chooseLibraries(
			context,
			missingDependencies(versions, provided, unsupported),
			provided,
			unsupported,
			target,
		);

		if (libraries.length === 0) {
			return placed;
		}

		await downloadFiles(
			context,
			libraries.map((library) => ({
				...library,
				path: stagedPath(library),
			})),
		);
		await placeLibraries(context, libraries, placed);
	} catch (error) {
		context.log.warn("could not read which libraries the modpack's mods need, installing the pack as published", {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	if (placed.length > 0) {
		context.log("adding the libraries the modpack's mods need but the pack left out", {
			files: placed.length,
			example: fileNameOf(placed.at(0)?.path ?? ""),
		});
	}

	return placed;
};
