import type { Bridge } from "@serverkgg/bridge";
import { fileNameOf, STAGING_ROOT } from "../shared";

const MOD_INDEX_STAGING = `${STAGING_ROOT}/modindex`;

const MODS_GLOB = "mods/*.jar";

const MOD_METADATA_SELECTS = [
	"META-INF/neoforge.mods.toml",
	"META-INF/mods.toml",
	"fabric.mod.json",
	"quilt.mod.json",
];

const MAX_INDEXED_JARS = 400;

const TOML_TABLE_PATTERN = /^[ \t]*\[{1,2}(?<table>[^\][\r\n]{1,120})\]{1,2}[ \t]*$/;

const TOML_MOD_ID_PATTERN = /^[ \t]*modId[ \t]*=[ \t]*["'](?<id>[^"'\r\n]{1,64})["']/;

const TOML_MODS_TABLE = "mods";

interface LoaderMetadata {
	id?: unknown;
	quilt_loader?: {
		id?: unknown;
	};
}

interface ModIndex {
	signature: string;
	jars: Map<string, string>;
}

let indexed: ModIndex | null = null;

const tomlModIds = (text: string) => {
	const ids: string[] = [];

	let table: string | null = null;

	for (const line of text.split("\n")) {
		const header = TOML_TABLE_PATTERN.exec(line)?.groups?.table;

		if (header !== undefined) {
			table = header.trim();

			continue;
		}

		if (table !== TOML_MODS_TABLE) {
			continue;
		}

		const id = TOML_MOD_ID_PATTERN.exec(line)?.groups?.id;

		if (id !== undefined) {
			ids.push(id);
		}
	}

	return ids;
};

const jsonModIds = (text: string) => {
	const parsed = JSON.parse(text) as LoaderMetadata;
	const ids: string[] = [];

	if (typeof parsed.id === "string") {
		ids.push(parsed.id);
	}

	const quilt = parsed.quilt_loader?.id;

	if (typeof quilt === "string") {
		ids.push(quilt);
	}

	return ids;
};

const declaredIds = (name: string, text: string) => {
	if (name.endsWith(".json")) {
		return jsonModIds(text);
	}

	if (name.endsWith(".toml")) {
		return tomlModIds(text);
	}

	return [];
};

export const parseModIds = (fileName: string, text: string): string[] => {
	try {
		return [
			...new Set(
				declaredIds(fileNameOf(fileName).toLowerCase(), text)
					.map((id) => id.trim())
					.filter((id) => id.length > 0),
			),
		];
	} catch {
		return [];
	}
};

const jarModIds = async (context: Bridge.Context, jar: string) => {
	await context.files.remove(MOD_INDEX_STAGING);

	const written = await context.files.extract(jar, MOD_INDEX_STAGING, {
		selects: MOD_METADATA_SELECTS,
		tree: false,
	});

	const ids: string[] = [];

	for (const path of written) {
		ids.push(...parseModIds(path, await context.files.read(path)));
	}

	return ids;
};

const buildIndex = async (context: Bridge.Context, entries: Bridge.FileEntry[]) => {
	const jars = new Map<string, string>();

	let unreadable = 0;

	for (const entry of entries) {
		try {
			for (const id of await jarModIds(context, entry.path)) {
				const key = id.toLowerCase();

				if (!jars.has(key)) {
					jars.set(key, entry.name);
				}
			}
		} catch {
			unreadable += 1;
		}
	}

	await context.files.remove(MOD_INDEX_STAGING);

	context.log("indexed the mod ids the installed jars declare", {
		jars: entries.length,
		mods: jars.size,
		unreadable,
	});

	return jars;
};

const signatureOf = (entries: Bridge.FileEntry[]) => {
	return `${entries.length}:${entries.reduce((total, entry) => total + entry.sizeBytes, 0)}`;
};

const installedJars = async (context: Bridge.Context) => {
	return (await context.files.list(MODS_GLOB))
		.filter((entry) => !entry.directory)
		.sort((left, right) => left.path.localeCompare(right.path))
		.slice(0, MAX_INDEXED_JARS);
};

export const resolveModJar = async (context: Bridge.Context, modId: string): Promise<string | null> => {
	const wanted = modId.trim().toLowerCase();

	if (wanted.length === 0) {
		return null;
	}

	try {
		const entries = await installedJars(context);
		const signature = signatureOf(entries);

		if (indexed === null || indexed.signature !== signature) {
			indexed = {
				jars: await buildIndex(context, entries),
				signature,
			};
		}

		return indexed.jars.get(wanted) ?? null;
	} catch (error) {
		context.log.warn("could not work out which jar the crashing mod came from", {
			mod: modId,
			error: error instanceof Error ? error.message : String(error),
		});

		return null;
	}
};
