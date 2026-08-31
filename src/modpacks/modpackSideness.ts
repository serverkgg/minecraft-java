import type { Bridge } from "@serverkgg/bridge";
import { MODRINTH_UNSUPPORTED, modrinthProjects } from "../providers";
import { isClientOnlyPath } from "./clientMods";
import type { ModpackFile } from "./modpackIndex";

export interface ModpackPartition {
	keep: ModpackFile[];
	skipped: ModpackFile[];
}

export const partitionModpackFiles = (files: ModpackFile[], unsupported: Set<string>): ModpackPartition => {
	const keep: ModpackFile[] = [];
	const skipped: ModpackFile[] = [];

	for (const file of files) {
		const clientOnly = (file.projectId !== null && unsupported.has(file.projectId)) || isClientOnlyPath(file.path);

		if (clientOnly) {
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
