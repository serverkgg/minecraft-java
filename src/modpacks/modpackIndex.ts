import { modrinthProjectId } from "../providers";
import { ServerVariant } from "../shared";

export const MODPACK_INDEX = "modrinth.index.json";

const FORMAT_VERSION = 1;

const GAME = "minecraft";

const MAX_FILES = 1024;

const SHA512_PATTERN = /^[a-f0-9]{128}$/;

const ALLOWED_HOSTS = new Set([
	"cdn.modrinth.com",
	"github.com",
	"raw.githubusercontent.com",
]);

const QUILT_LOADERS = [
	"quilt",
	"quilt-loader",
];

const DEPENDENCY_VARIANTS: Record<string, ServerVariant> = {
	"fabric-loader": ServerVariant.Fabric,
	forge: ServerVariant.Forge,
	neoforge: ServerVariant.NeoForge,
};

const LOADER_VARIANTS: Record<string, ServerVariant> = {
	fabric: ServerVariant.Fabric,
	forge: ServerVariant.Forge,
	neoforge: ServerVariant.NeoForge,
};

export interface ModpackFile {
	path: string;
	url: string;
	digest: string;
	sizeBytes: number | null;
	projectId: string | null;
}

export interface ModpackIndex {
	name: string;
	mcVersion: string;
	variant: ServerVariant;
	loaderVersion: string;
	files: ModpackFile[];
}

interface RawIndexFile {
	path?: unknown;
	downloads?: unknown;
	hashes?: {
		sha512?: unknown;
	};
	fileSize?: unknown;
}

interface RawIndex {
	formatVersion?: unknown;
	game?: unknown;
	name?: unknown;
	dependencies?: Record<string, unknown>;
	files?: unknown;
}

export const variantForLoaders = (loaders: string[]): ServerVariant | null => {
	for (const loader of loaders) {
		const variant = LOADER_VARIANTS[loader.toLowerCase()];

		if (variant) {
			return variant;
		}
	}

	return null;
};

export const usesQuilt = (loaders: string[]) => {
	return loaders.some((loader) => QUILT_LOADERS.includes(loader.toLowerCase()));
};

const readPath = (value: unknown) => {
	if (typeof value !== "string" || value.length === 0) {
		return null;
	}

	const segments = value.split("/");

	if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) {
		return null;
	}

	if (segments.some((segment) => segment === ".." || segment.includes("\\"))) {
		return null;
	}

	return value;
};

const readUrl = (value: unknown) => {
	if (!Array.isArray(value)) {
		return null;
	}

	for (const candidate of value) {
		if (typeof candidate !== "string" || !URL.canParse(candidate)) {
			continue;
		}

		const remote = new URL(candidate);

		if (remote.protocol === "https:" && ALLOWED_HOSTS.has(remote.hostname)) {
			return candidate;
		}
	}

	return null;
};

const readFile = (value: RawIndexFile): ModpackFile => {
	const path = readPath(value.path);

	if (!path) {
		throw new Error(`the modpack lists a file we cannot install ("${String(value.path)}")`);
	}

	const url = readUrl(value.downloads);

	if (!url) {
		throw new Error(`the modpack downloads "${path}" from a host we do not install from`);
	}

	const sha512 = typeof value.hashes?.sha512 === "string" ? value.hashes.sha512.toLowerCase() : "";

	if (!SHA512_PATTERN.test(sha512)) {
		throw new Error(`the modpack lists "${path}" with no checksum we can verify`);
	}

	const sizeBytes = typeof value.fileSize === "number" && value.fileSize > 0 ? value.fileSize : null;

	return {
		path,
		url,
		digest: `sha512:${sha512}`,
		sizeBytes,
		projectId: modrinthProjectId(url),
	};
};

const readLoader = (dependencies: Record<string, unknown>) => {
	for (const [key, value] of Object.entries(dependencies)) {
		if (QUILT_LOADERS.includes(key)) {
			throw new Error("this modpack runs on quilt, and serverk has no quilt server type");
		}

		const variant = DEPENDENCY_VARIANTS[key];

		if (variant && typeof value === "string" && value.length > 0) {
			return {
				variant,
				loaderVersion: value,
			};
		}
	}

	throw new Error("this modpack declares no server loader we can install");
};

export const parseModpackIndex = (raw: string): ModpackIndex => {
	let parsed: RawIndex;

	try {
		parsed = JSON.parse(raw) as RawIndex;
	} catch {
		throw new Error(`the modpack ${MODPACK_INDEX} is not valid json`);
	}

	if (parsed.formatVersion !== FORMAT_VERSION) {
		throw new Error(`this modpack uses format version ${String(parsed.formatVersion)}, which we do not read yet`);
	}

	if (parsed.game !== GAME) {
		throw new Error(`this modpack is built for "${String(parsed.game)}", not minecraft`);
	}

	const dependencies = parsed.dependencies;

	if (dependencies === undefined || dependencies === null || typeof dependencies !== "object") {
		throw new Error(`the modpack ${MODPACK_INDEX} declares no dependencies`);
	}

	const mcVersion = dependencies.minecraft;

	if (typeof mcVersion !== "string" || mcVersion.length === 0) {
		throw new Error("this modpack declares no minecraft version");
	}

	const entries = Array.isArray(parsed.files) ? (parsed.files as RawIndexFile[]) : [];

	if (entries.length > MAX_FILES) {
		throw new Error(`this modpack lists ${entries.length} files, more than the ${MAX_FILES} we install`);
	}

	const { variant, loaderVersion } = readLoader(dependencies);

	const files: ModpackFile[] = [];

	for (const entry of entries) {
		files.push(readFile(entry));
	}

	return {
		name: typeof parsed.name === "string" ? parsed.name : "",
		mcVersion,
		variant,
		loaderVersion,
		files,
	};
};
