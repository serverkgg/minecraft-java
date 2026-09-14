import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import {
	DIMENSION_SUFFIXES,
	END_SUFFIX,
	NETHER_SUFFIX,
	UNIFIED_END,
	UNIFIED_NETHER,
	VANILLA_END,
	VANILLA_NETHER,
	WorldLayout,
} from "../shared";

const PROPERTIES_FILE = "server.properties";

const LEVEL_NAME = "level-name";

const LEVEL_FILE = "level.dat";

const FIND_TIMEOUT_MS = 30_000;

const NAME_LIMIT = 32;

const NAME_ATTEMPT_LIMIT = 100;

const UNSAFE_CHARACTERS = /[^A-Za-z0-9._-]+/g;

const EDGE_CHARACTERS = /^[.\-_]+|[.\-_]+$/g;

export const DEFAULT_WORLD = "world";

export interface WorldDimensions {
	nether: string;
	end: string;
}

const dimensionBase = (name: string) => {
	for (const suffix of DIMENSION_SUFFIXES) {
		if (name.endsWith(suffix) && name.length > suffix.length) {
			return name.slice(0, -suffix.length);
		}
	}

	return null;
};

const worldNameOf = (line: string) => {
	const segments = line.trim().split("/");

	if (segments.length !== 3 || segments.at(0) !== "." || segments.at(2) !== LEVEL_FILE) {
		return null;
	}

	const name = segments.at(1) ?? "";

	return name.length > 0 && !name.startsWith(".") ? name : null;
};

export const discoveredWorlds = (output: string): string[] => {
	const names = new Set<string>();

	for (const line of output.split("\n")) {
		const name = worldNameOf(line);

		if (name !== null) {
			names.add(name);
		}
	}

	return [
		...names,
	]
		.filter((name) => {
			const base = dimensionBase(name);

			return base === null || !names.has(base);
		})
		.sort();
};

export const discoverWorlds = async (context: Bridge.Context): Promise<string[]> => {
	const result = await context.exec(
		[
			"find",
			".",
			"-maxdepth",
			"2",
			"-name",
			LEVEL_FILE,
		],
		{
			timeoutMs: FIND_TIMEOUT_MS,
		},
	);

	if (result.code !== 0) {
		context.log.warn("the world scan did not finish cleanly, listing what it found", {
			code: result.code,
			reason: result.stderr.trim().split("\n").at(0) ?? "",
		});
	}

	return discoveredWorlds(result.stdout);
};

export const safeWorldName = (name: string) => {
	return name.replace(UNSAFE_CHARACTERS, "-").slice(0, NAME_LIMIT).replace(EDGE_CHARACTERS, "");
};

export const levelDirectories = (output: string): string[] => {
	const directories = new Set<string>();
	const suffix = `/${LEVEL_FILE}`;

	for (const line of output.split("\n")) {
		const trimmed = line.trim();

		if (trimmed.endsWith(suffix) && trimmed.length > suffix.length) {
			directories.add(trimmed.slice(0, -suffix.length));
		}
	}

	return [
		...directories,
	].sort();
};

export const mainLevelDirectories = (found: string[]): string[] => {
	const dimensions = new Set(
		found.flatMap((directory) => [
			`${directory}${NETHER_SUFFIX}`,
			`${directory}${END_SUFFIX}`,
		]),
	);

	return found.filter((directory) => !dimensions.has(directory)).sort();
};

export const findLevelDirectories = async (context: Bridge.Context, source: string): Promise<string[]> => {
	const result = await context.exec(
		[
			"find",
			source,
			"-maxdepth",
			"2",
			"-name",
			LEVEL_FILE,
		],
		{
			timeoutMs: FIND_TIMEOUT_MS,
		},
	);

	return levelDirectories(result.stdout);
};

export const activeWorld = async (context: Bridge.Context) => {
	const values = await context.codec.javaProperties.read(PROPERTIES_FILE);
	const declared = values[LEVEL_NAME];

	return typeof declared === "string" && declared.length > 0 ? declared : DEFAULT_WORLD;
};

export const setActiveWorld = async (context: Bridge.Context, name: string) => {
	await context.codec.javaProperties.merge(PROPERTIES_FILE, {
		[LEVEL_NAME]: name,
	});
};

export const resetActiveWorld = async (context: Bridge.Context) => {
	if (!(await context.files.exists(PROPERTIES_FILE))) {
		return;
	}

	await setActiveWorld(context, DEFAULT_WORLD);
};

export const worldDimensions = (name: string, layout: WorldLayout): WorldDimensions => {
	if (layout === WorldLayout.Unified) {
		return {
			nether: `${name}/${UNIFIED_NETHER}`,
			end: `${name}/${UNIFIED_END}`,
		};
	}

	if (layout === WorldLayout.Bukkit) {
		return {
			nether: `${name}${NETHER_SUFFIX}`,
			end: `${name}${END_SUFFIX}`,
		};
	}

	return {
		nether: `${name}/${VANILLA_NETHER}`,
		end: `${name}/${VANILLA_END}`,
	};
};

export const worldPaths = (name: string) => {
	return [
		name,
		`${name}${NETHER_SUFFIX}`,
		`${name}${END_SUFFIX}`,
	];
};

export const worldBaseName = (folderName: string) => {
	const safe = safeWorldName(folderName);

	return safe.length > 0 ? safe : DEFAULT_WORLD;
};

export const suffixedWorldName = (base: string, attempt: number) => {
	const suffix = `-${attempt}`;

	return `${base.slice(0, NAME_LIMIT - suffix.length).replace(EDGE_CHARACTERS, "")}${suffix}`;
};

export const freeWorldName = async (context: Bridge.Context, base: string): Promise<string> => {
	for (let attempt = 1; attempt <= NAME_ATTEMPT_LIMIT; attempt += 1) {
		const candidate = attempt === 1 ? base : suffixedWorldName(base, attempt);
		let taken = false;

		for (const path of worldPaths(candidate)) {
			if (await context.files.exists(path)) {
				taken = true;
				break;
			}
		}

		if (!taken) {
			return candidate;
		}
	}

	throw new BridgeUserError({
		ar: `عندك مابات كثيرة بنفس الاسم "${base}". احذف اللي ما تحتاجه وارفع الماب مرة ثانية.`,
		en: `Too many worlds are already named "${base}". Delete the ones you do not need and upload again.`,
	});
};

export interface WorldImport {
	folder: string;
	name: string;
}

export const worldRenameSentence = (folder: string, name: string): Bridge.Text | null => {
	const base = worldBaseName(folder);

	if (base !== name) {
		return {
			ar: `أضفنا الماب "${folder}" باسم "${name}" لأن عندك ماب اسمها "${base}".`,
			en: `The world "${folder}" was added as "${name}" because a world named "${base}" is already here.`,
		};
	}

	if (safeWorldName(folder).length === 0) {
		return {
			ar: `أضفنا الماب "${folder}" باسم "${name}" لأن اسم مجلدها ما فيه حروف إنجليزية ولا أرقام.`,
			en: `The world "${folder}" was added as "${name}" because its folder name has no Latin letters or digits.`,
		};
	}

	return null;
};

export const worldImportNotice = (imported: WorldImport[]): Bridge.Text | null => {
	const sentences = imported
		.map((entry) => worldRenameSentence(entry.folder, entry.name))
		.filter((sentence) => sentence !== null);

	if (sentences.length === 0) {
		return null;
	}

	return {
		ar: sentences.map((sentence) => sentence.ar).join("\n"),
		en: sentences.map((sentence) => sentence.en).join("\n"),
	};
};

export const worldSize = async (context: Bridge.Context, name: string) => {
	let total = 0;

	for (const path of worldPaths(name)) {
		total += await context.files.size(path);
	}

	return total;
};
