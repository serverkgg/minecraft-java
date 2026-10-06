import { describe, expect, it } from "bun:test";
import { eraOf, layoutOf, ServerVariant, StorageEra, VARIANT_LABELS, WorldLayout } from "../shared";
import {
	AddonOutcome,
	expandRelocation,
	planTransition,
	RelocationKind,
	stepOf,
	TransitionNote,
	UNIFIED_WORLD_DATA_FILES,
	VersionStep,
	WorldLoss,
	WorldOutcome,
} from "./transition";

const RELEASES = [
	"26.2",
	"26.1.2",
	"26.1.1",
	"26.1",
	"1.21.11",
	"1.21.10",
];

const ORDER = new Map(
	RELEASES.map((version, index) => [
		version,
		index,
	]),
);

const ERA_VERSIONS: Record<StorageEra, string> = {
	[StorageEra.Legacy]: "1.21.11",
	[StorageEra.Unified]: "26.2",
};

const ERA_TITLES: Record<StorageEra, string> = {
	[StorageEra.Legacy]: "before 26.1",
	[StorageEra.Unified]: "from 26.1 on",
};

interface Row {
	from: ServerVariant;
	to: ServerVariant;
	addons: AddonOutcome;
	worldLoss: WorldLoss;
	moves: boolean;
}

const kept = (from: ServerVariant, to: ServerVariant): Row => {
	return {
		from,
		to,
		addons: AddonOutcome.Kept,
		worldLoss: WorldLoss.None,
		moves: false,
	};
};

const swapped = (from: ServerVariant, to: ServerVariant, worldLoss: WorldLoss, moves: boolean): Row => {
	return {
		from,
		to,
		addons: AddonOutcome.Removed,
		worldLoss,
		moves,
	};
};

const leavingMods = (from: ServerVariant, to: ServerVariant) => {
	return swapped(from, to, WorldLoss.ModContent, false);
};

const leavingPlugins = (from: ServerVariant, to: ServerVariant) => {
	return swapped(from, to, WorldLoss.None, true);
};

const joiningPlugins = (from: ServerVariant, to: ServerVariant) => {
	return swapped(from, to, WorldLoss.None, false);
};

const TABLE: Row[] = [
	kept(ServerVariant.Fabric, ServerVariant.Fabric),
	leavingMods(ServerVariant.Fabric, ServerVariant.Forge),
	leavingMods(ServerVariant.Fabric, ServerVariant.NeoForge),
	leavingMods(ServerVariant.Fabric, ServerVariant.Paper),
	leavingMods(ServerVariant.Fabric, ServerVariant.Purpur),
	leavingMods(ServerVariant.Fabric, ServerVariant.Vanilla),

	leavingMods(ServerVariant.Forge, ServerVariant.Fabric),
	kept(ServerVariant.Forge, ServerVariant.Forge),
	leavingMods(ServerVariant.Forge, ServerVariant.NeoForge),
	leavingMods(ServerVariant.Forge, ServerVariant.Paper),
	leavingMods(ServerVariant.Forge, ServerVariant.Purpur),
	leavingMods(ServerVariant.Forge, ServerVariant.Vanilla),

	leavingMods(ServerVariant.NeoForge, ServerVariant.Fabric),
	leavingMods(ServerVariant.NeoForge, ServerVariant.Forge),
	kept(ServerVariant.NeoForge, ServerVariant.NeoForge),
	leavingMods(ServerVariant.NeoForge, ServerVariant.Paper),
	leavingMods(ServerVariant.NeoForge, ServerVariant.Purpur),
	leavingMods(ServerVariant.NeoForge, ServerVariant.Vanilla),

	leavingPlugins(ServerVariant.Paper, ServerVariant.Fabric),
	leavingPlugins(ServerVariant.Paper, ServerVariant.Forge),
	leavingPlugins(ServerVariant.Paper, ServerVariant.NeoForge),
	kept(ServerVariant.Paper, ServerVariant.Paper),
	kept(ServerVariant.Paper, ServerVariant.Purpur),
	leavingPlugins(ServerVariant.Paper, ServerVariant.Vanilla),

	leavingPlugins(ServerVariant.Purpur, ServerVariant.Fabric),
	leavingPlugins(ServerVariant.Purpur, ServerVariant.Forge),
	leavingPlugins(ServerVariant.Purpur, ServerVariant.NeoForge),
	kept(ServerVariant.Purpur, ServerVariant.Paper),
	kept(ServerVariant.Purpur, ServerVariant.Purpur),
	leavingPlugins(ServerVariant.Purpur, ServerVariant.Vanilla),

	joiningPlugins(ServerVariant.Vanilla, ServerVariant.Fabric),
	joiningPlugins(ServerVariant.Vanilla, ServerVariant.Forge),
	joiningPlugins(ServerVariant.Vanilla, ServerVariant.NeoForge),
	joiningPlugins(ServerVariant.Vanilla, ServerVariant.Paper),
	joiningPlugins(ServerVariant.Vanilla, ServerVariant.Purpur),
	kept(ServerVariant.Vanilla, ServerVariant.Vanilla),
];

const relocationOf = (row: Row, era: StorageEra) => {
	if (!row.moves) {
		return null;
	}

	return era === StorageEra.Legacy ? RelocationKind.LegacyDimensions : RelocationKind.UnifiedWorldData;
};

const claimOf = (row: Row, era: StorageEra) => {
	const claims = [
		row.worldLoss === WorldLoss.ModContent
			? "keeps the world but everything the mods added to it is lost"
			: "keeps the world",
	];

	if (row.moves) {
		claims.push(
			era === StorageEra.Legacy
				? "moves its Nether and End into it"
				: "moves its world-settings files where the new type looks for them",
		);
	}

	claims.push(
		row.addons === AddonOutcome.Removed
			? "and removes the plugins and mods with their settings"
			: "and keeps the plugins and mods",
	);

	return `${VARIANT_LABELS[row.from]} to ${VARIANT_LABELS[row.to]} ${claims.join(", ")}`;
};

const sideOf = (variant: ServerVariant, era: StorageEra) => {
	return {
		variant,
		version: ERA_VERSIONS[era],
		era,
	};
};

const planFor = (row: Row, era: StorageEra, step: VersionStep) => {
	return planTransition(sideOf(row.from, era), sideOf(row.to, era), step);
};

describe("the version order tells an upgrade from a downgrade", () => {
	it("staying on the same version is no step at all", () => {
		expect(stepOf(ORDER, "26.2", "26.2")).toBe(VersionStep.Same);
	});

	it("26.2 to 26.1.2 is a downgrade", () => {
		expect(stepOf(ORDER, "26.2", "26.1.2")).toBe(VersionStep.Downgrade);
	});

	it("1.21.11 to 26.1 is an upgrade even though the numbering scheme changed", () => {
		expect(stepOf(ORDER, "1.21.11", "26.1")).toBe(VersionStep.Upgrade);
	});

	it("1.21.10 to 1.21.11 is an upgrade", () => {
		expect(stepOf(ORDER, "1.21.10", "1.21.11")).toBe(VersionStep.Upgrade);
	});

	it("a version the manifest does not list leaves the direction unknown", () => {
		expect(stepOf(ORDER, "26.2", "26.3")).toBe(VersionStep.Unknown);
		expect(stepOf(ORDER, "1.7.10", "26.2")).toBe(VersionStep.Unknown);
	});
});

describe("26.1 is where minecraft moved every dimension inside the world folder", () => {
	it("26.1 is already on the new layout", () => {
		expect(eraOf(ORDER, "26.1")).toBe(StorageEra.Unified);
	});

	it("26.2 is on the new layout", () => {
		expect(eraOf(ORDER, "26.2")).toBe(StorageEra.Unified);
	});

	it("1.21.11 is on the old layout", () => {
		expect(eraOf(ORDER, "1.21.11")).toBe(StorageEra.Legacy);
	});

	it("a version we cannot look up falls back to its numbering scheme", () => {
		expect(eraOf(ORDER, "1.7.10")).toBe(StorageEra.Legacy);
		expect(eraOf(ORDER, "27.1")).toBe(StorageEra.Unified);
	});

	it("before 26.1 paper keeps its dimensions beside the world and vanilla keeps them inside it", () => {
		expect(layoutOf(ServerVariant.Paper, StorageEra.Legacy)).toBe(WorldLayout.Bukkit);
		expect(layoutOf(ServerVariant.Vanilla, StorageEra.Legacy)).toBe(WorldLayout.Vanilla);
	});

	it("from 26.1 on every server type keeps its dimensions in the same place", () => {
		expect(layoutOf(ServerVariant.Paper, StorageEra.Unified)).toBe(WorldLayout.Unified);
		expect(layoutOf(ServerVariant.Fabric, StorageEra.Unified)).toBe(WorldLayout.Unified);
	});
});

for (const era of [
	StorageEra.Legacy,
	StorageEra.Unified,
]) {
	describe(`changing the server type on the same version, ${ERA_TITLES[era]}`, () => {
		for (const row of TABLE) {
			it(claimOf(row, era), () => {
				const plan = planFor(row, era, VersionStep.Same);

				expect(plan.world).toBe(WorldOutcome.Kept);
				expect(plan.worldLoss).toBe(row.worldLoss);
				expect(plan.addons).toBe(row.addons);
				expect(plan.relocation).toBe(relocationOf(row, era));
			});
		}
	});
}

describe("the version step decides the world", () => {
	it("going back to an older version always starts a fresh world, whatever the type", () => {
		for (const row of TABLE) {
			const plan = planFor(row, StorageEra.Unified, VersionStep.Downgrade);

			expect(plan.world).toBe(WorldOutcome.Wiped);
			expect(plan.worldLoss).toBe(WorldLoss.None);
			expect(plan.addons).toBe(AddonOutcome.Removed);
			expect(plan.relocation).toBeNull();
			expect(plan.relocations).toEqual([]);
		}
	});

	it("a version we cannot place keeps the world and still asks before it happens", () => {
		for (const row of TABLE) {
			const plan = planFor(row, StorageEra.Unified, VersionStep.Unknown);

			expect(plan.world).toBe(WorldOutcome.Kept);
			expect(plan.notes).toContain(TransitionNote.VersionUnknown);
		}
	});

	it("moving to a newer version on the same mod loader warns that the mods may need an update", () => {
		for (const row of TABLE) {
			const plan = planFor(row, StorageEra.Unified, VersionStep.Upgrade);
			const staysOnAModLoader =
				row.from === row.to
				&& [
					ServerVariant.Fabric,
					ServerVariant.Forge,
					ServerVariant.NeoForge,
				].includes(row.from);

			expect(plan.notes.includes(TransitionNote.ModsMayNeedUpdate)).toBe(staysOnAModLoader);
		}
	});

	it("moving to a newer version keeps the world everywhere", () => {
		for (const row of TABLE) {
			expect(planFor(row, StorageEra.Unified, VersionStep.Upgrade).world).toBe(WorldOutcome.Kept);
		}
	});
});

describe("what we move when a world leaves paper or purpur", () => {
	it("before 26.1 the Nether and the End folders go inside the world and the empty ones go away", () => {
		const plan = planFor(
			leavingPlugins(ServerVariant.Paper, ServerVariant.Vanilla),
			StorageEra.Legacy,
			VersionStep.Same,
		);

		expect(plan.relocations).toEqual([
			{
				from: "<world>_nether/DIM-1",
				to: "<world>/DIM-1",
				removeAfter: "<world>_nether",
			},
			{
				from: "<world>_the_end/DIM1",
				to: "<world>/DIM1",
				removeAfter: "<world>_the_end",
			},
		]);
	});

	it("from 26.1 on the five world-settings files move out of the overworld folder", () => {
		expect(UNIFIED_WORLD_DATA_FILES).toEqual([
			"game_rules.dat",
			"scheduled_events.dat",
			"wandering_trader.dat",
			"weather.dat",
			"world_gen_settings.dat",
		]);

		const plan = planFor(
			leavingPlugins(ServerVariant.Purpur, ServerVariant.Fabric),
			StorageEra.Unified,
			VersionStep.Same,
		);

		expect(plan.relocations.map((relocation) => relocation.from)).toEqual(
			UNIFIED_WORLD_DATA_FILES.map((file) => `<world>/dimensions/minecraft/overworld/data/minecraft/${file}`),
		);
		expect(plan.relocations.map((relocation) => relocation.to)).toEqual(
			UNIFIED_WORLD_DATA_FILES.map((file) => `<world>/data/minecraft/${file}`),
		);
		expect(plan.relocations.every((relocation) => relocation.removeAfter === null)).toBe(true);
	});

	it("a world moving onto paper needs no move because paper rearranges it itself", () => {
		for (const era of [
			StorageEra.Legacy,
			StorageEra.Unified,
		]) {
			const plan = planFor(joiningPlugins(ServerVariant.Vanilla, ServerVariant.Paper), era, VersionStep.Same);

			expect(plan.relocation).toBeNull();
			expect(plan.relocations).toEqual([]);
		}
	});

	it("a move is written against the world it is applied to", () => {
		expect(
			expandRelocation(
				{
					from: "<world>_nether/DIM-1",
					to: "<world>/DIM-1",
					removeAfter: "<world>_nether",
				},
				"survival",
			),
		).toEqual({
			from: "survival_nether/DIM-1",
			to: "survival/DIM-1",
			removeAfter: "survival_nether",
		});

		expect(
			expandRelocation(
				{
					from: "<world>/dimensions/minecraft/overworld/data/minecraft/weather.dat",
					to: "<world>/data/minecraft/weather.dat",
					removeAfter: null,
				},
				"world",
			),
		).toEqual({
			from: "world/dimensions/minecraft/overworld/data/minecraft/weather.dat",
			to: "world/data/minecraft/weather.dat",
			removeAfter: null,
		});
	});
});
