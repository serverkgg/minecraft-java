import type { Bridge } from "@serverkgg/bridge";
import {
	CURSEFORGE_CLASS_MODS,
	CURSEFORGE_REQUIRED_DEPENDENCY,
	type CurseFileEntry,
	type CurseMod,
	curseforgeDownloadUrl,
	curseforgeFallbackUrl,
	curseforgeFiles,
	curseforgeMods,
	curseforgeSha1,
	isCurseforgeServerFile,
	MODRINTH_UNSUPPORTED,
	type ModrinthVersion,
	modrinthFile,
	modrinthProjects,
	modrinthVersionsByHashes,
} from "../providers";
import { ServerVariant } from "../shared";
import { isClientOnlyFilename, isServerSafeFilename } from "./clientMods";
import { type BlockedFile, type ModpackFile, type ModpackIndex, modPath } from "./modpackIndex";

export const MODPACK_MANIFEST = "manifest.json";

const MANIFEST_TYPE = "minecraftModpack";

const MANIFEST_VERSION = 1;

const MAX_FILES = 1024;

const DEFAULT_OVERRIDES = "overrides";

const CURSEFORGE_MOD_PAGE = "https://www.curseforge.com/minecraft/mc-mods";

const LOADER_VARIANTS: Record<string, ServerVariant> = {
	fabric: ServerVariant.Fabric,
	forge: ServerVariant.Forge,
	neoforge: ServerVariant.NeoForge,
};

const QUILT_LOADERS = [
	"quilt",
	"quilt-loader",
];

export interface ModpackManifestFile {
	projectId: number;
	fileId: number;
	required: boolean;
}

export interface ModpackManifest {
	name: string;
	mcVersion: string;
	variant: ServerVariant;
	loaderVersion: string;
	overrides: string;
	files: ModpackManifestFile[];
}

interface RawModLoader {
	id?: unknown;
	primary?: unknown;
}

interface RawManifestFile {
	projectID?: unknown;
	fileID?: unknown;
	required?: unknown;
}

interface RawManifest {
	manifestType?: unknown;
	manifestVersion?: unknown;
	name?: unknown;
	overrides?: unknown;
	minecraft?: {
		version?: unknown;
		modLoaders?: unknown;
	};
	files?: unknown;
}

const readLoaderId = (id: string, mcVersion: string) => {
	const parts = id.split("-");
	const provider = parts.at(0)?.toLowerCase() ?? "";

	if (QUILT_LOADERS.includes(provider)) {
		throw new Error("this modpack runs on quilt, and serverk has no quilt server type");
	}

	const variant = LOADER_VARIANTS[provider];

	if (!variant || parts.length < 2) {
		throw new Error(`this modpack asks for the "${id}" loader, which serverk cannot install`);
	}

	const rest = parts.slice(1);
	const loaderVersion = rest.at(0) === mcVersion ? rest.slice(1).join("-") : rest.join("-");

	if (loaderVersion.length === 0) {
		throw new Error(`this modpack asks for the "${id}" loader, which serverk cannot install`);
	}

	return {
		loaderVersion,
		variant,
	};
};

const readModLoader = (value: unknown, mcVersion: string) => {
	const loaders = Array.isArray(value) ? (value as RawModLoader[]) : [];
	const primary = loaders.find((loader) => loader.primary === true) ?? loaders.at(0);

	if (!primary || typeof primary.id !== "string" || primary.id.length === 0) {
		throw new Error("this modpack declares no server loader we can install");
	}

	return readLoaderId(primary.id, mcVersion);
};

const readManifestFile = (value: RawManifestFile): ModpackManifestFile | null => {
	if (typeof value.projectID !== "number" || typeof value.fileID !== "number") {
		return null;
	}

	if (!Number.isInteger(value.projectID) || !Number.isInteger(value.fileID)) {
		return null;
	}

	return {
		fileId: value.fileID,
		projectId: value.projectID,
		required: value.required !== false,
	};
};

export const parseCurseforgeManifest = (raw: string): ModpackManifest => {
	let parsed: RawManifest;

	try {
		parsed = JSON.parse(raw) as RawManifest;
	} catch {
		throw new Error(`the modpack ${MODPACK_MANIFEST} is not valid json`);
	}

	if (parsed.manifestType !== MANIFEST_TYPE) {
		throw new Error(`this modpack is built for "${String(parsed.manifestType)}", not minecraft`);
	}

	if (parsed.manifestVersion !== MANIFEST_VERSION) {
		throw new Error(`this modpack uses manifest version ${String(parsed.manifestVersion)}, which we do not read yet`);
	}

	const mcVersion = parsed.minecraft?.version;

	if (typeof mcVersion !== "string" || mcVersion.length === 0) {
		throw new Error("this modpack declares no minecraft version");
	}

	const entries = Array.isArray(parsed.files) ? (parsed.files as RawManifestFile[]) : [];

	if (entries.length > MAX_FILES) {
		throw new Error(`this modpack lists ${entries.length} files, more than the ${MAX_FILES} we install`);
	}

	const { variant, loaderVersion } = readModLoader(parsed.minecraft?.modLoaders, mcVersion);

	const files: ModpackManifestFile[] = [];

	for (const entry of entries) {
		const file = readManifestFile(entry);

		if (file) {
			files.push(file);
		}
	}

	return {
		files,
		loaderVersion,
		mcVersion,
		name: typeof parsed.name === "string" ? parsed.name : "",
		overrides:
			typeof parsed.overrides === "string" && parsed.overrides.length > 0 ? parsed.overrides : DEFAULT_OVERRIDES,
		variant,
	};
};

const modsByFile = async (context: Bridge.Context, entries: CurseFileEntry[]) => {
	const mods = new Map<number, CurseMod>();

	for (const mod of await curseforgeMods(
		context,
		entries.map((entry) => entry.modId),
	)) {
		mods.set(mod.id, mod);
	}

	return mods;
};

const modrinthMatches = async (context: Bridge.Context, hashes: string[]) => {
	if (hashes.length === 0) {
		return {};
	}

	try {
		return await modrinthVersionsByHashes(context, hashes);
	} catch (error) {
		context.log.warn("could not cross-check the modpack's mods against modrinth, trusting curseforge instead", {
			error: error instanceof Error ? error.message : String(error),
		});

		return {};
	}
};

const modrinthUnsupported = async (context: Bridge.Context, ids: string[]) => {
	if (ids.length === 0) {
		return new Set<string>();
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

		return new Set<string>();
	}
};

export interface CurseforgePartition {
	installable: CurseFileEntry[];
	required: Set<number>;
	shielded: CurseFileEntry[];
	absent: number[];
	degraded: boolean;
}

interface CurseforgeClosure {
	required: Set<number>;
	absent: number[];
}

const isServerEntry = (entry: CurseFileEntry, degraded: boolean) => {
	if (isServerSafeFilename(entry.fileName)) {
		return true;
	}

	if (isClientOnlyFilename(entry.fileName)) {
		return false;
	}

	return degraded || isCurseforgeServerFile(entry);
};

const requiredModIds = (entry: CurseFileEntry) => {
	return entry.dependencies.flatMap((dependency) => {
		return dependency.relationType === CURSEFORGE_REQUIRED_DEPENDENCY && typeof dependency.modId === "number"
			? [
					dependency.modId,
				]
			: [];
	});
};

const curseforgeClosure = (entries: CurseFileEntry[]): CurseforgeClosure | null => {
	if (entries.some((entry) => !Array.isArray(entry.dependencies))) {
		return null;
	}

	try {
		const present = new Map<number, CurseFileEntry>();

		for (const entry of entries) {
			if (!present.has(entry.modId)) {
				present.set(entry.modId, entry);
			}
		}

		const queue = entries.filter((entry) => isServerEntry(entry, false));
		const visited = new Set(queue.map((entry) => entry.modId));
		const required = new Set<number>();
		const absent = new Set<number>();

		for (let cursor = 0; cursor < queue.length; cursor += 1) {
			const entry = queue.at(cursor);

			for (const modId of entry === undefined ? [] : requiredModIds(entry)) {
				required.add(modId);

				const dependency = present.get(modId);

				if (dependency === undefined) {
					absent.add(modId);

					continue;
				}

				if (!visited.has(modId)) {
					visited.add(modId);

					queue.push(dependency);
				}
			}
		}

		return {
			absent: [
				...absent,
			],
			required,
		};
	} catch {
		return null;
	}
};

export const partitionCurseforgeEntries = (entries: CurseFileEntry[]): CurseforgePartition => {
	const closure = curseforgeClosure(entries);
	const degraded = closure === null;
	const required = closure?.required ?? new Set<number>();

	const installable: CurseFileEntry[] = [];
	const shielded: CurseFileEntry[] = [];

	for (const entry of entries) {
		if (isServerEntry(entry, degraded)) {
			installable.push(entry);

			continue;
		}

		if (required.has(entry.modId)) {
			installable.push(entry);
			shielded.push(entry);
		}
	}

	return {
		absent: closure?.absent ?? [],
		degraded,
		installable,
		required,
		shielded,
	};
};

export interface CurseforgeLadderInput {
	installable: CurseFileEntry[];
	mods: Map<number, CurseMod>;
	matches: Record<string, ModrinthVersion>;
	unsupported: Set<string>;
	partition: CurseforgePartition;
	wanted: Map<number, ModpackManifestFile>;
}

export interface CurseforgeLadderResult {
	files: ModpackFile[];
	blocked: BlockedFile[];
	unverifiable: string[];
	skipped: number;
}

const curseforgeModPage = (mod: CurseMod): string | null => {
	if (mod.links?.websiteUrl) {
		return mod.links.websiteUrl;
	}

	return mod.slug.length > 0 ? `${CURSEFORGE_MOD_PAGE}/${mod.slug}` : null;
};

export const ladderCurseforgeEntries = (input: CurseforgeLadderInput): CurseforgeLadderResult => {
	const files: ModpackFile[] = [];
	const blocked: BlockedFile[] = [];
	const unverifiable: string[] = [];
	let skipped = 0;

	for (const entry of input.installable) {
		const sha1 = curseforgeSha1(entry);

		if (sha1 === null) {
			unverifiable.push(entry.fileName);

			skipped += 1;

			continue;
		}

		const match = input.matches[sha1];
		const projectId = match?.project_id ?? null;
		const mirror = match ? modrinthFile(match) : null;

		if (
			projectId !== null
			&& input.unsupported.has(projectId)
			&& !isServerSafeFilename(entry.fileName)
			&& !input.partition.required.has(entry.modId)
		) {
			skipped += 1;

			continue;
		}

		const direct = curseforgeDownloadUrl(entry);
		const source =
			direct !== null
				? {
						digest: `sha1:${sha1}`,
						url: direct,
					}
				: mirror !== null && mirror.digest !== null
					? {
							digest: mirror.digest,
							url: mirror.url,
						}
					: {
							digest: `sha1:${sha1}`,
							url: curseforgeFallbackUrl(entry.id, entry.fileName),
						};

		const mod = input.mods.get(entry.modId);

		if (direct === null && mirror === null && mod?.allowModDistribution === false) {
			if (input.wanted.get(entry.id)?.required === false) {
				skipped += 1;

				continue;
			}

			blocked.push({
				fileId: entry.id,
				fileName: entry.fileName,
				modId: entry.modId,
				name: mod.name,
				pageUrl: curseforgeModPage(mod),
				sha1,
				sizeBytes: entry.fileLength > 0 ? entry.fileLength : null,
				slug: mod.slug,
			});

			continue;
		}

		files.push({
			digest: source.digest,
			path: modPath(entry.fileName),
			projectId,
			sizeBytes: entry.fileLength > 0 ? entry.fileLength : null,
			url: source.url,
		});
	}

	return {
		blocked,
		files,
		skipped,
		unverifiable,
	};
};

export const resolveCurseforgeFiles = async (
	context: Bridge.Context,
	manifest: ModpackManifest,
): Promise<ModpackIndex> => {
	const wanted = new Map(
		manifest.files.map((file) => [
			file.fileId,
			file,
		]),
	);
	const entries = await curseforgeFiles(
		context,
		manifest.files.map((file) => file.fileId),
	);
	const mods = await modsByFile(context, entries);

	const foreign: string[] = [];

	const local = entries.filter((entry) => {
		const mod = mods.get(entry.modId);

		if (mod && mod.classId !== null && mod.classId !== CURSEFORGE_CLASS_MODS) {
			foreign.push(entry.fileName);

			return false;
		}

		return true;
	});

	if (foreign.length > 0) {
		context.log("the modpack ships files a server never loads, leaving them out", {
			skipped: foreign.length,
			example: foreign.at(0) ?? "",
		});
	}

	const partition = partitionCurseforgeEntries(local);
	const installable = partition.installable;

	if (partition.degraded) {
		context.log.warn("could not read what the modpack's mods depend on, keeping them all", {
			kept: installable.length,
		});
	}

	if (partition.shielded.length > 0) {
		context.log("kept the modpack's client-tagged files the server mods need", {
			shielded: partition.shielded.length,
			example: partition.shielded.at(0)?.fileName ?? "",
		});
	}

	if (partition.absent.length > 0) {
		context.log.warn("the modpack's mods need a mod the pack does not ship", {
			missing: partition.absent.length,
			example: partition.absent.at(0) ?? 0,
		});
	}

	const matches = await modrinthMatches(
		context,
		installable.flatMap((entry) => {
			const sha1 = curseforgeSha1(entry);

			return sha1 === null
				? []
				: [
						sha1,
					];
		}),
	);

	const unsupported = await modrinthUnsupported(
		context,
		Object.values(matches).map((version) => version.project_id),
	);

	const ladder = ladderCurseforgeEntries({
		installable,
		matches,
		mods,
		partition,
		unsupported,
		wanted,
	});

	for (const fileName of ladder.unverifiable) {
		context.log.warn("the modpack lists a mod with no checksum we can verify, leaving it out", {
			file: fileName,
		});
	}

	const skipped = entries.length - installable.length + ladder.skipped;

	if (ladder.blocked.length > 0) {
		context.log.warn(
			"the modpack's author blocked some of its files outside curseforge, we will look for another source",
			{
				blocked: ladder.blocked.length,
				example: ladder.blocked.at(0)?.fileName ?? "",
			},
		);
	}

	if (skipped > 0) {
		context.log.warn("left out the modpack's client-side files, they cannot run on a server", {
			skipped,
		});
	}

	return {
		blocked: ladder.blocked,
		files: ladder.files,
		loaderVersion: manifest.loaderVersion,
		mcVersion: manifest.mcVersion,
		name: manifest.name,
		variant: manifest.variant,
	};
};
