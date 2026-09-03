import type { Bridge } from "@serverkgg/bridge";
import { fileNameOf } from "../shared";
import { events } from "./events";
import { resolveModJar } from "./modIndex";

export const CRASH_SCAN_MARKER = ".serverk-crashscan.json";

const CRASH_REPORTS = "crash-reports/crash-*.txt";

const LATEST_LOG = "logs/latest.log";

const LOG_READ_LIMIT = 4 * 1024 * 1024;

const LOG_TAIL_LIMIT = 256 * 1024;

const MOD_CRASHED = "ModCrashed";

const MOD_FILE_PATTERN = /^[ \t]*Mod [Ff]ile: (?<path>[^\r\n]{1,400})$/m;

const FORGE_MOD_PATTERN = /^-- MOD (?<mod>[\w.-]{1,64}) --$/m;

const NEOFORGE_MOD_PATTERN = /^-- Mod loading issue for: (?<mod>[\w.-]{1,64}) --$/m;

const FAILURE_PATTERN = /^[ \t]*Failure message: (?<detail>[^\r\n]{1,200})/m;

const DESCRIPTION_PATTERN = /^Description: (?<detail>[^\r\n]{1,200})/m;

const JAR_PATTERN = /([^/\\\r\n]+\.jar)$/;

export interface CrashReportAttribution {
	jar: string | null;
	mod: string | null;
	detail: string | null;
}

interface CrashScanMarker {
	report: string | null;
	log: string | null;
}

interface GameLogTail {
	signature: string;
	tail: string;
}

export const readCrashAttribution = (report: string): CrashReportAttribution | null => {
	const path = MOD_FILE_PATTERN.exec(report)?.groups?.path?.trim() ?? null;
	const jar = path === null ? null : (JAR_PATTERN.exec(fileNameOf(path))?.[1] ?? null);
	const mod = FORGE_MOD_PATTERN.exec(report)?.groups?.mod ?? NEOFORGE_MOD_PATTERN.exec(report)?.groups?.mod ?? null;
	const detail =
		FAILURE_PATTERN.exec(report)?.groups?.detail?.trim()
		?? DESCRIPTION_PATTERN.exec(report)?.groups?.detail?.trim()
		?? null;

	if (jar === null && mod === null) {
		return null;
	}

	return {
		detail,
		jar,
		mod,
	};
};

export const readLogAttribution = (log: string): CrashReportAttribution | null => {
	let mod: string | null = null;
	let detail: string | null = null;

	for (const pattern of events.patterns) {
		if (pattern.emit !== MOD_CRASHED) {
			continue;
		}

		const groups = pattern.match.exec(log)?.groups;

		mod ??= groups?.mod ?? null;
		detail ??= groups?.detail ?? null;
	}

	if (mod === null) {
		return null;
	}

	return {
		detail,
		jar: null,
		mod,
	};
};

const readMarker = async (context: Bridge.Context): Promise<CrashScanMarker> => {
	try {
		const parsed = JSON.parse(await context.files.read(CRASH_SCAN_MARKER)) as Partial<CrashScanMarker>;

		return {
			log: typeof parsed.log === "string" ? parsed.log : null,
			report: typeof parsed.report === "string" ? parsed.report : null,
		};
	} catch {
		return {
			log: null,
			report: null,
		};
	}
};

const writeMarker = async (context: Bridge.Context, marker: CrashScanMarker) => {
	await context.files.write(CRASH_SCAN_MARKER, `${JSON.stringify(marker, null, 2)}\n`);
};

const newestReport = async (context: Bridge.Context) => {
	const entries = await context.files.list(CRASH_REPORTS);

	return entries.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt)).at(0) ?? null;
};

const readLogTail = async (context: Bridge.Context): Promise<GameLogTail | null> => {
	const entry = (await context.files.list(LATEST_LOG)).at(0);

	if (!entry || entry.sizeBytes === 0 || entry.sizeBytes > LOG_READ_LIMIT) {
		return null;
	}

	const text = await context.files.read(entry.path);

	return {
		signature: `${entry.sizeBytes}:${entry.modifiedAt}`,
		tail: text.length > LOG_TAIL_LIMIT ? text.slice(-LOG_TAIL_LIMIT) : text,
	};
};

export const reportModCrash = async (context: Bridge.Context) => {
	try {
		const marker = await readMarker(context);
		const newest = await newestReport(context);

		if (newest !== null && marker.report === newest.path) {
			return;
		}

		const named = newest !== null && newest.sizeBytes > 0;
		const log = named ? null : await readLogTail(context);
		const unread = log !== null && marker.log !== log.signature;

		if (!named && !unread) {
			if (newest !== null) {
				await writeMarker(context, {
					log: marker.log,
					report: newest.path,
				});
			}

			return;
		}

		await writeMarker(context, {
			log: log?.signature ?? marker.log,
			report: newest?.path ?? marker.report,
		});

		const attribution =
			named && newest !== null
				? readCrashAttribution(await context.files.read(newest.path))
				: readLogAttribution(log?.tail ?? "");

		if (!attribution) {
			return;
		}

		const jar = attribution.jar ?? (attribution.mod === null ? null : await resolveModJar(context, attribution.mod));

		context.emit(MOD_CRASHED, {
			...(jar === null
				? {}
				: {
						jar,
					}),
			...(attribution.mod === null
				? {}
				: {
						mod: attribution.mod,
					}),
			...(attribution.detail === null
				? {}
				: {
						detail: attribution.detail,
					}),
			source: named ? "crash-report" : "game-log",
		});

		context.log.warn("the last start left a crash naming a mod", {
			jar: jar ?? "",
			mod: attribution.mod ?? "",
			source: named ? "crash-report" : "game-log",
		});
	} catch (error) {
		context.log.warn("could not read what the last crash left behind", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
};
