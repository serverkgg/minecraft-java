import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { MODRINTH_UNSUPPORTED, modrinthProjectId } from "../providers";
import { ServerVariant } from "../shared";

export const MODPACK_INDEX = "modrinth.index.json";

export const MODS_DIRECTORY = "mods";

export const modPath = (fileName: string) => {
	return `${MODS_DIRECTORY}/${fileName}`;
};

export const refuseModpack = (reason: Bridge.Text) => {
	return new BridgeUserError({
		ar: `${reason.ar} اختر مودباكًا آخر أو إصدارًا آخر منه.`,
		en: `${reason.en} Pick another modpack or another release of it.`,
	});
};

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

export interface BlockedFile {
	modId: number;
	fileId: number;
	fileName: string;
	sha1: string;
	sizeBytes: number | null;
	name: string;
	slug: string;
	pageUrl: string | null;
}

export interface ModpackIndex {
	name: string;
	mcVersion: string;
	variant: ServerVariant;
	loaderVersion: string;
	files: ModpackFile[];
	blocked: BlockedFile[];
}

interface RawIndexFile {
	path?: unknown;
	downloads?: unknown;
	env?: {
		server?: unknown;
	};
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

const readFile = (value: RawIndexFile): ModpackFile | null => {
	if (value.env?.server === MODRINTH_UNSUPPORTED) {
		return null;
	}

	const path = readPath(value.path);

	if (!path) {
		throw refuseModpack({
			ar: `يحتوي المودباك على ملف لا يمكن تثبيته («${String(value.path)}»).`,
			en: `The modpack lists a file we can't install ("${String(value.path)}").`,
		});
	}

	const url = readUrl(value.downloads);

	if (!url) {
		throw refuseModpack({
			ar: `المودباك ينزّل «${path}» من موقع لا ننزّل منه.`,
			en: `The modpack downloads "${path}" from a host we don't download from.`,
		});
	}

	const sha512 = typeof value.hashes?.sha512 === "string" ? value.hashes.sha512.toLowerCase() : "";

	if (!SHA512_PATTERN.test(sha512)) {
		throw refuseModpack({
			ar: `يحتوي المودباك على «${path}» دون بصمة يمكن التحقق منها.`,
			en: `The modpack lists "${path}" with no checksum we can verify.`,
		});
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
			throw refuseModpack({
				ar: "هذا المودباك يشتغل على Quilt، ولا توفر منصة سيرفرك نوع السيرفر Quilt.",
				en: "This modpack runs on Quilt, and Serverk has no Quilt server type.",
			});
		}

		const variant = DEPENDENCY_VARIANTS[key];

		if (variant && typeof value === "string" && value.length > 0) {
			return {
				variant,
				loaderVersion: value,
			};
		}
	}

	throw refuseModpack({
		ar: "هذا المودباك لا يحدد مشغّل سيرفر قابلًا للتثبيت.",
		en: "This modpack doesn't declare a server loader we can install.",
	});
};

export const parseModpackIndex = (raw: string): ModpackIndex => {
	let parsed: RawIndex;

	try {
		parsed = JSON.parse(raw) as RawIndex;
	} catch {
		throw refuseModpack({
			ar: `ملف ${MODPACK_INDEX} في المودباك تالف.`,
			en: `The modpack's ${MODPACK_INDEX} isn't valid JSON.`,
		});
	}

	if (parsed.formatVersion !== FORMAT_VERSION) {
		throw refuseModpack({
			ar: `هذا المودباك يستخدم الصيغة رقم ${String(parsed.formatVersion)}، ولا ندعمها حتى الآن.`,
			en: `This modpack uses format version ${String(parsed.formatVersion)}, which we don't read yet.`,
		});
	}

	if (parsed.game !== GAME) {
		throw refuseModpack({
			ar: `هذا المودباك مصمم للعبة «${String(parsed.game)}»، وليس لماينكرافت.`,
			en: `This modpack is built for "${String(parsed.game)}", not Minecraft.`,
		});
	}

	const dependencies = parsed.dependencies;

	if (dependencies === undefined || dependencies === null || typeof dependencies !== "object") {
		throw refuseModpack({
			ar: `ملف ${MODPACK_INDEX} في المودباك لا يحدد الإصدار ولا المشغّل.`,
			en: `The modpack's ${MODPACK_INDEX} doesn't declare a version or a loader.`,
		});
	}

	const mcVersion = dependencies.minecraft;

	if (typeof mcVersion !== "string" || mcVersion.length === 0) {
		throw refuseModpack({
			ar: "هذا المودباك لا يحدد إصدار ماينكرافت.",
			en: "This modpack doesn't declare a Minecraft version.",
		});
	}

	const entries = Array.isArray(parsed.files) ? (parsed.files as RawIndexFile[]) : [];

	if (entries.length > MAX_FILES) {
		throw refuseModpack({
			ar: `يحتوي هذا المودباك على ${entries.length} ملف، وهذا أكثر من الحد الذي نثبّته (${MAX_FILES}).`,
			en: `This modpack lists ${entries.length} files, more than the ${MAX_FILES} we install.`,
		});
	}

	const { variant, loaderVersion } = readLoader(dependencies);

	const files: ModpackFile[] = [];

	for (const entry of entries) {
		const file = readFile(entry);

		if (file) {
			files.push(file);
		}
	}

	return {
		name: typeof parsed.name === "string" ? parsed.name : "",
		mcVersion,
		variant,
		loaderVersion,
		files,
		blocked: [],
	};
};
