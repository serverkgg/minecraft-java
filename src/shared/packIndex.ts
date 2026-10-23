import type { Bridge } from "@serverkgg/bridge";
import { PACKS_DIRECTORY } from "./staging";
import { MOD_VARIANTS, type ServerVariant } from "./variant";

export const PACK_INDEX = `${PACKS_DIRECTORY}/index.json`;

export enum PackFormat {
	CurseForge = "curseforge",
	Modrinth = "modrinth",
}

export const PACK_EXTENSIONS: Record<PackFormat, string> = {
	[PackFormat.CurseForge]: "zip",
	[PackFormat.Modrinth]: "mrpack",
};

const SHA1_PATTERN = /^[a-f0-9]{40}$/;

const SHA1_PREFIX_LENGTH = 8;

const SAFE_NAME_FALLBACK = "modpack";

const SAFE_NAME_LIMIT = 48;

const UNSAFE_RUN_PATTERN = /[^a-z0-9]+/g;

const EDGE_HYPHENS_PATTERN = /^-+|-+$/g;

const STORED_STEM_PATTERN = /^[a-z0-9-]+$/;

const FORMATS = new Set<string>(Object.values(PackFormat));

const VARIANTS = new Set<string>(MOD_VARIANTS);

export interface PackEntry {
	sha1: string;
	format: PackFormat;
	path: string;
	name: string;
	version: string;
	mcVersion: string;
	variant: ServerVariant;
	loaderVersion: string;
	fileCount: number;
	sizeBytes: number;
	uploadedAt: string;
}

export const packFormatOf = (fileName: string): PackFormat | null => {
	const dot = fileName.lastIndexOf(".");

	if (dot < 0) {
		return null;
	}

	const extension = fileName.slice(dot + 1).toLowerCase();

	for (const format of Object.values(PackFormat)) {
		if (PACK_EXTENSIONS[format] === extension) {
			return format;
		}
	}

	return null;
};

export const safePackName = (name: string) => {
	const safe = name
		.toLowerCase()
		.replace(UNSAFE_RUN_PATTERN, "-")
		.replace(EDGE_HYPHENS_PATTERN, "")
		.slice(0, SAFE_NAME_LIMIT)
		.replace(EDGE_HYPHENS_PATTERN, "");

	return safe.length > 0 ? safe : SAFE_NAME_FALLBACK;
};

export const packArchivePath = (name: string, sha1: string, format: PackFormat) => {
	return `${PACKS_DIRECTORY}/${safePackName(name)}-${sha1.slice(0, SHA1_PREFIX_LENGTH)}.${PACK_EXTENSIONS[format]}`;
};

const storedPathOf = (value: unknown, format: PackFormat) => {
	const prefix = `${PACKS_DIRECTORY}/`;
	const suffix = `.${PACK_EXTENSIONS[format]}`;

	if (typeof value !== "string" || !value.startsWith(prefix) || !value.endsWith(suffix)) {
		return null;
	}

	return STORED_STEM_PATTERN.test(value.slice(prefix.length, -suffix.length)) ? value : null;
};

const textOf = (value: unknown) => {
	return typeof value === "string" ? value : "";
};

const countOf = (value: unknown) => {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
};

const readEntry = (value: unknown): PackEntry | null => {
	if (value === null || typeof value !== "object") {
		return null;
	}

	const raw = value as Record<keyof PackEntry, unknown>;

	if (typeof raw.sha1 !== "string" || !SHA1_PATTERN.test(raw.sha1)) {
		return null;
	}

	if (typeof raw.format !== "string" || !FORMATS.has(raw.format)) {
		return null;
	}

	if (typeof raw.variant !== "string" || !VARIANTS.has(raw.variant)) {
		return null;
	}

	if (typeof raw.mcVersion !== "string" || raw.mcVersion.length === 0) {
		return null;
	}

	const format = raw.format as PackFormat;
	const path = storedPathOf(raw.path, format);

	if (path === null) {
		return null;
	}

	return {
		sha1: raw.sha1,
		format,
		path,
		name: textOf(raw.name),
		version: textOf(raw.version),
		mcVersion: raw.mcVersion,
		variant: raw.variant as ServerVariant,
		loaderVersion: textOf(raw.loaderVersion),
		fileCount: countOf(raw.fileCount),
		sizeBytes: countOf(raw.sizeBytes),
		uploadedAt: textOf(raw.uploadedAt),
	};
};

export const parsePackIndex = (text: string): PackEntry[] => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(text);
	} catch {
		return [];
	}

	if (!Array.isArray(parsed)) {
		return [];
	}

	const entries: PackEntry[] = [];

	for (const value of parsed) {
		const entry = readEntry(value);

		if (entry && !entries.some((known) => known.sha1 === entry.sha1)) {
			entries.push(entry);
		}
	}

	return entries;
};

export const readPackIndex = async (context: Bridge.Context): Promise<PackEntry[]> => {
	if (!(await context.files.exists(PACK_INDEX))) {
		return [];
	}

	return parsePackIndex(await context.files.read(PACK_INDEX));
};

export const writePackIndex = async (context: Bridge.Context, entries: PackEntry[]) => {
	await context.files.ensure(PACKS_DIRECTORY);
	await context.files.write(PACK_INDEX, `${JSON.stringify(entries, null, 2)}\n`);
};
