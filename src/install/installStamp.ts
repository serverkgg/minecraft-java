import type { Bridge } from "@serverkgg/bridge";
import { ServerVariant } from "../shared";
import { LaunchKind, type LaunchPlan } from "./launchPlan";

const STAMP_FILE = ".serverk-install.json";

export interface InstallIdentity {
	variant: ServerVariant;
	version: string;
	build: string | null;
}

export interface InstallStamp extends InstallIdentity {
	java: number;
	launch: LaunchPlan;
}

const LAUNCH_KINDS = new Set<string>(Object.values(LaunchKind));

const VARIANTS = Object.values(ServerVariant);

const parseVariant = (value: unknown) => {
	return VARIANTS.find((variant) => variant === value) ?? null;
};

const parseLaunch = (value: unknown): LaunchPlan | null => {
	if (value === null || typeof value !== "object") {
		return null;
	}

	const candidate = value as Partial<LaunchPlan>;

	if (typeof candidate.kind !== "string" || !LAUNCH_KINDS.has(candidate.kind)) {
		return null;
	}

	if (typeof candidate.target !== "string" || candidate.target.length === 0) {
		return null;
	}

	return {
		kind: candidate.kind,
		target: candidate.target,
	};
};

export const parseStamp = (text: string): InstallStamp | null => {
	try {
		const parsed = JSON.parse(text) as Partial<InstallStamp>;
		const launch = parseLaunch(parsed.launch);
		const variant = parseVariant(parsed.variant);

		if (variant === null || typeof parsed.version !== "string") {
			return null;
		}

		if (typeof parsed.java !== "number" || !launch) {
			return null;
		}

		return {
			variant,
			version: parsed.version,
			build: typeof parsed.build === "string" ? parsed.build : null,
			java: parsed.java,
			launch,
		};
	} catch {
		return null;
	}
};

export const readStamp = async (context: Bridge.Context): Promise<InstallStamp | null> => {
	if (!(await context.files.exists(STAMP_FILE))) {
		return null;
	}

	try {
		return parseStamp(await context.files.read(STAMP_FILE));
	} catch {
		return null;
	}
};

export const writeStamp = async (context: Bridge.Context, stamp: InstallStamp) => {
	await context.files.write(STAMP_FILE, `${JSON.stringify(stamp, null, 2)}\n`);
};

export const matchesStamp = (stamp: InstallStamp | null, next: InstallIdentity) => {
	return (
		stamp !== null && stamp.variant === next.variant && stamp.version === next.version && stamp.build === next.build
	);
};

export const installedGameVersion = async (context: Bridge.Context) => {
	return (await readStamp(context))?.version ?? null;
};
