import type { Bridge } from "@serverkgg/bridge";
import { parseStamp, readStamp, writeStamp } from "@serverkgg/bridge/install";
import { ServerVariant } from "../shared";
import { LaunchKind, type LaunchPlan } from "./launchPlan";

export interface InstallIdentity {
	variant: ServerVariant;
	version: string;
	build: string | null;
}

export interface InstallStamp extends InstallIdentity {
	java: number;
	launch: LaunchPlan;
	rconPassword: string | null;
	rconPasswordNext: string | null;
}

const LAUNCH_KINDS = new Set<string>(Object.values(LaunchKind));

const VARIANTS = Object.values(ServerVariant);

const parseText = (value: unknown) => {
	return typeof value === "string" && value.length > 0 ? value : null;
};

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

const installStampOf = (parsed: Partial<InstallStamp> | null): InstallStamp | null => {
	if (parsed === null) {
		return null;
	}

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
		rconPassword: parseText(parsed.rconPassword),
		rconPasswordNext: parseText(parsed.rconPasswordNext),
	};
};

export const parseInstallStamp = (text: string): InstallStamp | null => {
	return installStampOf(parseStamp<Partial<InstallStamp>>(text));
};

export const readInstallStamp = async (context: Bridge.Context): Promise<InstallStamp | null> => {
	return installStampOf(await readStamp<Partial<InstallStamp>>(context));
};

export const writeInstallStamp = async (context: Bridge.Context, stamp: InstallStamp) => {
	await writeStamp(context, stamp);
};

export const matchesStamp = (stamp: InstallStamp | null, next: InstallIdentity) => {
	return (
		stamp !== null && stamp.variant === next.variant && stamp.version === next.version && stamp.build === next.build
	);
};

export const installedGameVersion = async (context: Bridge.Context) => {
	return (await readInstallStamp(context))?.version ?? null;
};
