import { END_SUFFIX, NETHER_SUFFIX, ServerVariant, StorageEra, VANILLA_END, VANILLA_NETHER } from "../shared";

export const WORLD_TOKEN = "<world>";

export const UNIFIED_WORLD_DATA_FILES = [
	"game_rules.dat",
	"scheduled_events.dat",
	"wandering_trader.dat",
	"weather.dat",
	"world_gen_settings.dat",
];

const UNIFIED_OVERWORLD_DATA = `${WORLD_TOKEN}/dimensions/minecraft/overworld/data/minecraft`;

const UNIFIED_WORLD_DATA = `${WORLD_TOKEN}/data/minecraft`;

export enum VersionStep {
	Downgrade = "downgrade",
	Same = "same",
	Unknown = "unknown",
	Upgrade = "upgrade",
}

export enum Ecosystem {
	Fabric = "fabric",
	Forge = "forge",
	NeoForge = "neoforge",
	Plugin = "plugin",
	Vanilla = "vanilla",
}

export enum WorldOutcome {
	Kept = "kept",
	Wiped = "wiped",
}

export enum WorldLoss {
	ModContent = "modContent",
	None = "none",
}

export enum AddonOutcome {
	Kept = "kept",
	Removed = "removed",
}

export enum RelocationKind {
	LegacyDimensions = "legacyDimensions",
	UnifiedWorldData = "unifiedWorldData",
}

export enum TransitionNote {
	ModsMayNeedUpdate = "modsMayNeedUpdate",
	VersionUnknown = "versionUnknown",
}

export interface TransitionSide {
	variant: ServerVariant;
	version: string;
	era: StorageEra;
}

export interface WorldRelocation {
	from: string;
	to: string;
	removeAfter: string | null;
}

export interface TransitionPlan {
	step: VersionStep;
	world: WorldOutcome;
	worldLoss: WorldLoss;
	addons: AddonOutcome;
	relocation: RelocationKind | null;
	relocations: WorldRelocation[];
	notes: TransitionNote[];
}

const ECOSYSTEM_BY_VARIANT: Record<ServerVariant, Ecosystem> = {
	[ServerVariant.Fabric]: Ecosystem.Fabric,
	[ServerVariant.Forge]: Ecosystem.Forge,
	[ServerVariant.NeoForge]: Ecosystem.NeoForge,
	[ServerVariant.Paper]: Ecosystem.Plugin,
	[ServerVariant.Purpur]: Ecosystem.Plugin,
	[ServerVariant.Vanilla]: Ecosystem.Vanilla,
};

const MODDED_ECOSYSTEMS = [
	Ecosystem.Fabric,
	Ecosystem.Forge,
	Ecosystem.NeoForge,
];

const LEGACY_DIMENSION_RELOCATIONS: WorldRelocation[] = [
	{
		from: `${WORLD_TOKEN}${NETHER_SUFFIX}/${VANILLA_NETHER}`,
		to: `${WORLD_TOKEN}/${VANILLA_NETHER}`,
		removeAfter: `${WORLD_TOKEN}${NETHER_SUFFIX}`,
	},
	{
		from: `${WORLD_TOKEN}${END_SUFFIX}/${VANILLA_END}`,
		to: `${WORLD_TOKEN}/${VANILLA_END}`,
		removeAfter: `${WORLD_TOKEN}${END_SUFFIX}`,
	},
];

const UNIFIED_WORLD_DATA_RELOCATIONS: WorldRelocation[] = UNIFIED_WORLD_DATA_FILES.map((file) => {
	return {
		from: `${UNIFIED_OVERWORLD_DATA}/${file}`,
		to: `${UNIFIED_WORLD_DATA}/${file}`,
		removeAfter: null,
	};
});

const RELOCATIONS_BY_KIND: Record<RelocationKind, WorldRelocation[]> = {
	[RelocationKind.LegacyDimensions]: LEGACY_DIMENSION_RELOCATIONS,
	[RelocationKind.UnifiedWorldData]: UNIFIED_WORLD_DATA_RELOCATIONS,
};

export const ecosystemOf = (variant: ServerVariant) => {
	return ECOSYSTEM_BY_VARIANT[variant];
};

export const isModded = (ecosystem: Ecosystem) => {
	return MODDED_ECOSYSTEMS.includes(ecosystem);
};

export const expandRelocation = (relocation: WorldRelocation, world: string): WorldRelocation => {
	return {
		from: relocation.from.replaceAll(WORLD_TOKEN, world),
		to: relocation.to.replaceAll(WORLD_TOKEN, world),
		removeAfter: relocation.removeAfter === null ? null : relocation.removeAfter.replaceAll(WORLD_TOKEN, world),
	};
};

export const stepOf = (order: Map<string, number>, from: string, to: string): VersionStep => {
	if (from === to) {
		return VersionStep.Same;
	}

	const fromIndex = order.get(from);
	const toIndex = order.get(to);

	if (fromIndex === undefined || toIndex === undefined) {
		return VersionStep.Unknown;
	}

	return toIndex < fromIndex ? VersionStep.Upgrade : VersionStep.Downgrade;
};

export const planTransition = (from: TransitionSide, to: TransitionSide, step: VersionStep): TransitionPlan => {
	const fromEcosystem = ecosystemOf(from.variant);
	const toEcosystem = ecosystemOf(to.variant);
	const changed = fromEcosystem !== toEcosystem;

	const world = step === VersionStep.Downgrade ? WorldOutcome.Wiped : WorldOutcome.Kept;
	const kept = world === WorldOutcome.Kept;

	const worldLoss = kept && changed && isModded(fromEcosystem) ? WorldLoss.ModContent : WorldLoss.None;
	const addons = changed || !kept ? AddonOutcome.Removed : AddonOutcome.Kept;

	const relocation =
		kept && changed && fromEcosystem === Ecosystem.Plugin
			? from.era === StorageEra.Legacy
				? RelocationKind.LegacyDimensions
				: RelocationKind.UnifiedWorldData
			: null;

	const notes: TransitionNote[] = [];

	if (step === VersionStep.Upgrade && !changed && isModded(fromEcosystem)) {
		notes.push(TransitionNote.ModsMayNeedUpdate);
	}

	if (step === VersionStep.Unknown) {
		notes.push(TransitionNote.VersionUnknown);
	}

	return {
		step,
		world,
		worldLoss,
		addons,
		relocation,
		relocations: relocation === null ? [] : RELOCATIONS_BY_KIND[relocation],
		notes,
	};
};
