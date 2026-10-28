import type { Bridge, BridgeExtractOptions } from "@serverkgg/bridge";

export type MemoryArchive = Record<string, string>;

export interface MemoryContextOptions {
	files?: Record<string, string>;
	archives?: Record<string, MemoryArchive>;
	served?: Record<string, MemoryArchive>;
	digests?: Record<string, string>;
	sizes?: Record<string, number>;
	variables?: Record<string, string>;
	secrets?: Record<string, string>;
	ports?: Record<string, number>;
	json?: (url: string) => unknown;
}

export interface MemoryMerge {
	path: string;
	values: Bridge.Values;
}

const DEFAULT_DIGEST = "0000000000000000000000000000000000000000";

const PROPERTY_SEPARATOR = "=";

const propertiesOf = (text: string) => {
	const values: Record<string, string> = {};

	for (const line of text.split("\n")) {
		const separator = line.indexOf(PROPERTY_SEPARATOR);

		if (separator > 0 && !line.startsWith("#")) {
			values[line.slice(0, separator)] = line.slice(separator + 1);
		}
	}

	return values;
};

const propertiesText = (values: Record<string, string>) => {
	return Object.entries(values)
		.map(([key, value]) => `${key}${PROPERTY_SEPARATOR}${value}\n`)
		.join("");
};

const underOrAt = (path: string, root: string) => {
	return path === root || path.startsWith(`${root}/`);
};

const selectedName = (name: string, selects: string[] | undefined) => {
	if (selects === undefined) {
		return name;
	}

	for (const select of selects) {
		if (select.endsWith("/") && name.startsWith(select)) {
			return name.slice(select.length);
		}

		if (name === select) {
			return name;
		}
	}

	return null;
};

export const memoryContext = (options: MemoryContextOptions = {}) => {
	const files = new Map(Object.entries(options.files ?? {}));
	const archives = new Map(Object.entries(options.archives ?? {}));
	const downloads: string[] = [];
	const merges: MemoryMerge[] = [];

	const moveWithin = <Value>(map: Map<string, Value>, from: string, to: string) => {
		for (const [key, value] of [
			...map,
		]) {
			if (underOrAt(key, from)) {
				map.delete(key);
				map.set(`${to}${key.slice(from.length)}`, value);
			}
		}
	};

	const context = {
		variable: (key: string) => options.variables?.[key] ?? null,
		secret: (key: string) => options.secrets?.[key] ?? null,
		port: (key: string) => {
			const port = options.ports?.[key];

			if (port === undefined) {
				throw new Error(`this game declares no port named "${key}"`);
			}

			return port;
		},
		codec: {
			javaProperties: {
				read: async (path: string) => propertiesOf(files.get(path) ?? ""),
				merge: async (path: string, values: Bridge.Values) => {
					merges.push({
						path,
						values,
					});

					const merged = propertiesOf(files.get(path) ?? "");

					for (const [key, value] of Object.entries(values)) {
						merged[key] = String(value ?? "");
					}

					files.set(path, propertiesText(merged));
				},
			},
		},
		net: {
			json: async (url: string) => {
				if (!options.json) {
					throw new Error(`no answer for ${url}`);
				}

				return options.json(url);
			},
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		activity: {
			report: () => {},
		},
		files: {
			exists: async (path: string) => {
				return [
					...files.keys(),
					...archives.keys(),
				].some((key) => underOrAt(key, path));
			},
			read: async (path: string) => {
				const text = files.get(path);

				if (text === undefined) {
					throw new Error(`ENOENT: ${path}`);
				}

				return text;
			},
			write: async (path: string, text: string) => {
				files.set(path, text);
			},
			remove: async (path: string) => {
				for (const map of [
					files,
					archives,
				] as Map<string, unknown>[]) {
					for (const key of [
						...map.keys(),
					]) {
						if (underOrAt(key, path)) {
							map.delete(key);
						}
					}
				}
			},
			ensure: async () => {},
			list: async (glob: string) => {
				const directory = glob.slice(0, glob.lastIndexOf("/"));

				return [
					...files.keys(),
				]
					.filter((key) => key.startsWith(`${directory}/`) && !key.slice(directory.length + 1).includes("/"))
					.map((key) => {
						return {
							path: key,
							name: key.slice(directory.length + 1),
							directory: false,
							sizeBytes: options.sizes?.[key] ?? 0,
							modifiedAt: "",
						};
					});
			},
			move: async (from: string, to: string) => {
				moveWithin(files, from, to);
				moveWithin(archives, from, to);
			},
			size: async (path: string) => options.sizes?.[path] ?? 0,
			digest: async (path: string) => options.digests?.[path] ?? DEFAULT_DIGEST,
			download: async (path: string, url: string) => {
				downloads.push(url);

				const served = options.served?.[url];

				if (served) {
					archives.set(path, served);

					return;
				}

				files.set(path, "");
			},
			extract: async (path: string, destination: string, extractOptions: BridgeExtractOptions = {}) => {
				const entries = archives.get(path);

				if (!entries) {
					throw new Error(`path "${path}" is not a readable archive`);
				}

				const written: string[] = [];

				for (const [name, content] of Object.entries(entries)) {
					const selected = selectedName(name, extractOptions.selects);

					if (selected === null) {
						continue;
					}

					const target = destination.length > 0 ? `${destination}/${selected}` : selected;

					files.set(target, content);
					written.push(target);
				}

				return written;
			},
		},
	} as unknown as Bridge.Context;

	return {
		archives,
		context,
		downloads,
		files,
		merges,
	};
};
