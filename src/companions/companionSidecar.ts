import type { Bridge } from "@serverkgg/bridge";

const SIDECAR = ".serverk-companions.json";

export interface CompanionRecord {
	jar: string;
	gameVersion: string;
	source: string;
	version: string;
}

export interface CompanionSidecar {
	entries: Record<string, CompanionRecord>;
}

const isRecord = (value: unknown): value is CompanionRecord => {
	if (value === null || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<CompanionRecord>;

	return (
		typeof candidate.jar === "string"
		&& typeof candidate.gameVersion === "string"
		&& typeof candidate.source === "string"
		&& typeof candidate.version === "string"
	);
};

export const parseCompanionSidecar = (text: string): CompanionSidecar => {
	try {
		const parsed = JSON.parse(text) as {
			entries?: unknown;
		};
		const entries = parsed.entries;

		if (entries === null || typeof entries !== "object" || Array.isArray(entries)) {
			return {
				entries: {},
			};
		}

		return {
			entries: Object.fromEntries(Object.entries(entries).filter(([, value]) => isRecord(value))) as Record<
				string,
				CompanionRecord
			>,
		};
	} catch {
		return {
			entries: {},
		};
	}
};

export const readCompanionSidecar = async (context: Bridge.Context): Promise<CompanionSidecar> => {
	if (!(await context.files.exists(SIDECAR))) {
		return {
			entries: {},
		};
	}

	try {
		return parseCompanionSidecar(await context.files.read(SIDECAR));
	} catch {
		return {
			entries: {},
		};
	}
};

export const writeCompanionSidecar = async (context: Bridge.Context, sidecar: CompanionSidecar) => {
	await context.files.write(SIDECAR, `${JSON.stringify(sidecar, null, 2)}\n`);
};
