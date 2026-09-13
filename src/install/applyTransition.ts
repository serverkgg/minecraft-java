import type { Bridge } from "@serverkgg/bridge";
import { eraOf, releaseOrder, STAGING_ROOT } from "../shared";
import { discoverWorlds, resetActiveWorld, worldPaths } from "../worlds";
import type { InstallIdentity, InstallStamp } from "./installStamp";
import {
	AddonOutcome,
	expandRelocation,
	planTransition,
	stepOf,
	type TransitionPlan,
	WorldOutcome,
	type WorldRelocation,
} from "./transition";

const WIPE_DIRECTORIES = [
	"world",
	"world_nether",
	"world_the_end",
	"mods",
	"plugins",
	"config",
	"defaultconfigs",
	"libraries",
	"versions",
	"logs",
	"crash-reports",
	"cache",
	".cache",
	".fabric",
];

export const ADDON_DIRECTORIES = [
	"plugins",
	"mods",
	"config",
	"defaultconfigs",
];

const COMPANION_SIDECAR = ".serverk-companions.json";

const PARKED_SUFFIX = ".old";

const parentOf = (path: string) => {
	return path.split("/").slice(0, -1).join("/");
};

export const wipeData = async (context: Bridge.Context) => {
	for (const directory of WIPE_DIRECTORIES) {
		await context.files.remove(directory);
	}

	for (const world of await discoverWorlds(context)) {
		for (const path of worldPaths(world)) {
			await context.files.remove(path);
		}
	}

	for (const entry of await context.files.list("*")) {
		if (entry.path === STAGING_ROOT || entry.path.startsWith(`${STAGING_ROOT}/`)) {
			continue;
		}
		await context.files.remove(entry.path);
	}

	await resetActiveWorld(context);
};

const relocate = async (context: Bridge.Context, relocation: WorldRelocation) => {
	if (!(await context.files.exists(relocation.from))) {
		return;
	}

	const parent = parentOf(relocation.to);

	if (parent.length > 0) {
		await context.files.ensure(parent);
	}

	if (await context.files.exists(relocation.to)) {
		const parked = `${relocation.to}${PARKED_SUFFIX}`;

		await context.files.remove(parked);
		await context.files.move(relocation.to, parked);

		context.log.warn("the new server type already had files in this place, we parked them beside it", {
			path: relocation.to,
			parked,
		});
	}

	await context.files.move(relocation.from, relocation.to);

	context.log("moved world files where the new server type looks for them", {
		from: relocation.from,
		to: relocation.to,
	});

	if (relocation.removeAfter === null) {
		return;
	}

	if (!(await context.files.exists(relocation.from)) && (await context.files.exists(relocation.removeAfter))) {
		await context.files.remove(relocation.removeAfter);
	}
};

const removeAddons = async (context: Bridge.Context) => {
	for (const directory of ADDON_DIRECTORIES) {
		await context.files.remove(directory);
	}

	await context.files.remove(COMPANION_SIDECAR);

	context.log("removing the plugins and mods with their settings, they do not run on the new server type", {
		directories: ADDON_DIRECTORIES.join(", "),
	});
};

export const transitionFor = async (
	context: Bridge.Context,
	stamp: InstallStamp,
	next: InstallIdentity,
): Promise<TransitionPlan> => {
	const order = await releaseOrder(context);

	return planTransition(
		{
			variant: stamp.variant,
			version: stamp.version,
			era: eraOf(order, stamp.version),
		},
		{
			variant: next.variant,
			version: next.version,
			era: eraOf(order, next.version),
		},
		stepOf(order, stamp.version, next.version),
	);
};

export const applyTransition = async (context: Bridge.Context, plan: TransitionPlan) => {
	if (plan.world === WorldOutcome.Wiped) {
		await wipeData(context);

		context.log("starting a fresh server, the backup taken before this change has your old files");

		return;
	}

	if (plan.relocations.length > 0) {
		for (const world of await discoverWorlds(context)) {
			for (const relocation of plan.relocations) {
				await relocate(context, expandRelocation(relocation, world));
			}
		}
	}

	if (plan.addons === AddonOutcome.Removed) {
		await removeAddons(context);
	}
};
