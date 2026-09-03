import type { Bridge } from "@serverkgg/bridge";
import { type CatalogFile, CURSEFORGE_CDN_SUFFIX } from "../providers";
import { fileNameOf, STAGING_ROOT } from "../shared";
import { type BlockedFile, MODS_DIRECTORY, modPath } from "./modpackIndex";

const SERVER_PACK_STAGING = `${STAGING_ROOT}/serverpack`;

const SERVER_PACK_ARCHIVE = `${SERVER_PACK_STAGING}/pack.zip`;

const SERVER_PACK_MODS = `${SERVER_PACK_STAGING}/${MODS_DIRECTORY}`;

const SERVER_PACK_TIMEOUT_MS = 25 * 60_000;

const SHA1_ALGORITHM = "sha1";

export interface ServerPackRescue {
	rescued: BlockedFile[];
	missing: BlockedFile[];
}

export const serverPackSelects = (blocked: BlockedFile[]) => {
	return blocked.map((file) => `**/${MODS_DIRECTORY}/${file.fileName}`);
};

export const serverPackRescued = (file: BlockedFile, digest: string | null) => {
	return digest !== null && digest.toLowerCase() === file.sha1.toLowerCase();
};

export const serverPackAllowed = (url: string) => {
	if (!URL.canParse(url)) {
		return false;
	}

	const remote = new URL(url);

	return remote.protocol === "https:" && remote.hostname.endsWith(CURSEFORGE_CDN_SUFFIX);
};

const reasonOf = (error: unknown) => {
	return error instanceof Error ? error.message : String(error);
};

const clearStaging = async (context: Bridge.Context) => {
	try {
		await context.files.remove(SERVER_PACK_STAGING);
	} catch (error) {
		context.log.warn("could not clear the server pack we downloaded", {
			error: reasonOf(error),
		});
	}
};

const stageServerPack = async (context: Bridge.Context, serverPack: CatalogFile, blocked: BlockedFile[]) => {
	context.log("downloading the author's server pack", {
		file: serverPack.filename,
		sizeBytes: serverPack.sizeBytes,
	});

	await context.files.download(SERVER_PACK_ARCHIVE, serverPack.url, {
		cache: true,
		timeoutMs: SERVER_PACK_TIMEOUT_MS,
		...(serverPack.digest === null
			? {}
			: {
					digest: serverPack.digest,
				}),
		...(serverPack.sizeBytes === null
			? {}
			: {
					sizeBytes: serverPack.sizeBytes,
				}),
	});

	await context.files.extract(SERVER_PACK_ARCHIVE, SERVER_PACK_MODS, {
		tree: false,
		selects: serverPackSelects(blocked),
	});
};

const takeFromServerPack = async (context: Bridge.Context, file: BlockedFile) => {
	const staged = `${SERVER_PACK_MODS}/${fileNameOf(file.fileName)}`;

	if (!(await context.files.exists(staged))) {
		return false;
	}

	if (!serverPackRescued(file, await context.files.digest(staged, SHA1_ALGORITHM))) {
		context.log.warn("the file in the author's server pack is not the one the modpack asks for", {
			file: file.fileName,
			mod: file.name,
		});

		return false;
	}

	await context.files.move(staged, modPath(file.fileName));

	return true;
};

export const serverPackMerged = (carried: ServerPackRescue, attempt: ServerPackRescue): ServerPackRescue => {
	return {
		missing: attempt.missing,
		rescued: [
			...carried.rescued,
			...attempt.rescued,
		],
	};
};

const rescueFromCandidate = async (
	context: Bridge.Context,
	serverPack: CatalogFile,
	blocked: BlockedFile[],
): Promise<ServerPackRescue> => {
	if (!serverPackAllowed(serverPack.url)) {
		context.log.warn("the modpack's server pack is not served from curseforge, leaving it alone", {
			file: serverPack.filename,
		});

		return {
			missing: blocked,
			rescued: [],
		};
	}

	const rescued: BlockedFile[] = [];
	const missing: BlockedFile[] = [];

	try {
		await stageServerPack(context, serverPack, blocked);

		for (const file of blocked) {
			if (await takeFromServerPack(context, file)) {
				rescued.push(file);
			} else {
				missing.push(file);
			}
		}
	} catch (error) {
		context.log.warn("could not take the modpack's blocked files from the author's server pack", {
			file: serverPack.filename,
			error: reasonOf(error),
		});

		await clearStaging(context);

		return {
			missing: blocked,
			rescued: [],
		};
	}

	await clearStaging(context);

	if (rescued.length > 0) {
		context.log("rescued files from the author's server pack", {
			file: serverPack.filename,
			rescued: rescued.length,
			missing: missing.length,
		});
	}

	return {
		missing,
		rescued,
	};
};

export const rescueFromServerPack = async (
	context: Bridge.Context,
	serverPacks: CatalogFile[],
	blocked: BlockedFile[],
): Promise<ServerPackRescue> => {
	if (blocked.length === 0) {
		return {
			missing: [],
			rescued: [],
		};
	}

	if (serverPacks.length === 0) {
		context.log.warn("this modpack publishes no server pack, so its blocked files need you", {
			blocked: blocked.length,
		});

		return {
			missing: blocked,
			rescued: [],
		};
	}

	let carried: ServerPackRescue = {
		missing: blocked,
		rescued: [],
	};

	for (const serverPack of serverPacks) {
		if (carried.missing.length === 0) {
			break;
		}

		carried = serverPackMerged(carried, await rescueFromCandidate(context, serverPack, carried.missing));
	}

	return carried;
};
