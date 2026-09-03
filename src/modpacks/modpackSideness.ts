import type { Bridge } from "@serverkgg/bridge";
import {
	MODRINTH_REQUIRED,
	MODRINTH_UNSUPPORTED,
	modrinthProjects,
	modrinthVersionId,
	modrinthVersions,
} from "../providers";
import { fileNameOf } from "../shared";
import { isClientOnlyPath, isServerSafeFilename } from "./clientMods";
import type { ModpackFile } from "./modpackIndex";

export interface ModpackSignals {
	unsupported: Set<string>;
	shielded: Set<string>;
}

export interface ModpackPartition {
	keep: ModpackFile[];
	skipped: ModpackFile[];
}

const isClientOnly = (file: ModpackFile, signals: ModpackSignals) => {
	if (isServerSafeFilename(fileNameOf(file.path))) {
		return false;
	}

	if (file.projectId !== null && signals.shielded.has(file.projectId)) {
		return false;
	}

	if (file.projectId !== null && signals.unsupported.has(file.projectId)) {
		return true;
	}

	return isClientOnlyPath(file.path);
};

export const partitionModpackFiles = (files: ModpackFile[], signals: ModpackSignals): ModpackPartition => {
	const keep: ModpackFile[] = [];
	const skipped: ModpackFile[] = [];

	for (const file of files) {
		if (isClientOnly(file, signals)) {
			skipped.push(file);
		} else {
			keep.push(file);
		}
	}

	return {
		keep,
		skipped,
	};
};

export const resolveUnsupported = async (context: Bridge.Context, files: ModpackFile[]): Promise<Set<string>> => {
	const ids = files.flatMap((file) => {
		return file.projectId === null
			? []
			: [
					file.projectId,
				];
	});

	if (ids.length === 0) {
		return new Set();
	}

	try {
		const projects = await modrinthProjects(context, ids);

		return new Set(
			projects.filter((project) => project.server_side === MODRINTH_UNSUPPORTED).map((project) => project.id),
		);
	} catch (error) {
		context.log.warn("could not check which of the modpack's mods run on a server, trusting the pack instead", {
			error: error instanceof Error ? error.message : String(error),
		});

		return new Set();
	}
};

export const resolveDependencyShield = async (context: Bridge.Context, kept: ModpackFile[]): Promise<Set<string>> => {
	const ids = kept.flatMap((file) => {
		const versionId = modrinthVersionId(file.url);

		return versionId === null
			? []
			: [
					versionId,
				];
	});

	if (ids.length === 0) {
		return new Set();
	}

	try {
		const versions = await modrinthVersions(context, ids);
		const shielded = new Set<string>();

		for (const version of versions) {
			for (const dependency of version.dependencies) {
				if (dependency.dependency_type === MODRINTH_REQUIRED && dependency.project_id !== null) {
					shielded.add(dependency.project_id);
				}
			}
		}

		return shielded;
	} catch (error) {
		context.log.warn("could not read what the modpack's mods depend on, keeping them all", {
			error: error instanceof Error ? error.message : String(error),
		});

		return new Set();
	}
};

export const resolveModpackSignals = async (context: Bridge.Context, files: ModpackFile[]): Promise<ModpackSignals> => {
	const unsupported = await resolveUnsupported(context, files);
	const provisional = partitionModpackFiles(files, {
		shielded: new Set<string>(),
		unsupported,
	});

	if (provisional.skipped.length === 0) {
		return {
			shielded: new Set<string>(),
			unsupported,
		};
	}

	return {
		shielded: await resolveDependencyShield(context, provisional.keep),
		unsupported,
	};
};
