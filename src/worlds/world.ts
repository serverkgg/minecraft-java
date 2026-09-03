import type { Bridge } from "@serverkgg/bridge";
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

	const names = new Set<string>();

	for (const line of result.stdout.split("\n")) {
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

export const safeWorldName = (name: string) => {
	return name.replace(UNSAFE_CHARACTERS, "-").slice(0, NAME_LIMIT).replace(EDGE_CHARACTERS, "");
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

	const directories = new Set<string>();

	for (const line of result.stdout.split("\n")) {
		const trimmed = line.trim();
		const suffix = `/${LEVEL_FILE}`;

		if (trimmed.endsWith(suffix) && trimmed.length > suffix.length) {
			directories.add(trimmed.slice(0, -suffix.length));
		}
	}

	return [
		...directories,
	].sort();
};

export const activeWorld = async (context: Bridge.Context) => {
	const values = await context.codec.properties.read(PROPERTIES_FILE);
	const declared = values[LEVEL_NAME];

	return typeof declared === "string" && declared.length > 0 ? declared : DEFAULT_WORLD;
};

export const setActiveWorld = async (context: Bridge.Context, name: string) => {
	await context.codec.properties.merge(PROPERTIES_FILE, {
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

export const worldSize = async (context: Bridge.Context, name: string) => {
	let total = 0;

	for (const path of worldPaths(name)) {
		total += await context.files.size(path);
	}

	return total;
};
