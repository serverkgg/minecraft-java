import { describe, expect, test } from "bun:test";
import { events } from "./events";

const emitted = (line: string) => {
	return events.patterns.flatMap((pattern) => {
		const match = pattern.match.exec(line);

		return match === null
			? []
			: [
					{
						emit: pattern.emit,
						payload: {
							...pattern.payload,
						},
						groups: match.groups ?? {},
					},
				];
	});
};

const crashed = (line: string) => {
	return emitted(line).filter((event) => event.emit === "ModCrashed");
};

const died = (line: string) => {
	return emitted(line).filter((event) => event.emit === "PlayerDied");
};

const advanced = (line: string) => {
	return emitted(line).filter((event) => event.emit === "PlayerAdvanced");
};

const undersized = (line: string) => {
	return emitted(line).filter((event) => event.emit === "MemoryUndersized");
};

describe("naming the mod that stopped a server from booting", () => {
	test("reads the fabric entrypoint failure", () => {
		const [event] = crashed(
			"[12:01:02] [main/ERROR]: java.lang.RuntimeException: Could not execute entrypoint stage 'main' due to errors, provided by 'fabrically_adds'!",
		);

		expect(event?.groups.mod).toBe("fabrically_adds");
		expect(event?.groups.stage).toBe("main");
	});

	test("reads a prelaunch entrypoint failure too", () => {
		expect(
			crashed(
				"[12:01:02] [main/ERROR]: Could not execute entrypoint stage 'preLaunch' due to errors, provided by 'entity_texture_features'!",
			).at(0)?.groups.mod,
		).toBe("entity_texture_features");
	});

	test("reads a mixin that could not be applied", () => {
		expect(
			crashed(
				"[22:51:01] [main/ERROR]: Mixin apply for mod seasons failed seasons.mixins.json:BiomeMixin from mod seasons -> net.minecraft.class_1959",
			).at(0)?.groups.mod,
		).toBe("seasons");
	});

	test("reads the forge mod that would not start", () => {
		expect(
			crashed(
				"[23May2024 18:31:36.730] [modloading-worker-/ERROR] [net.minecraftforge.fml.javafmlmod.FMLModContainer/LOADING]: Failed to create mod instance. ModID: siren_head, class net.meme.sirenhead.SirenHeadMod",
			).at(0)?.groups.mod,
		).toBe("siren_head");
	});

	test("reads the mod whose event subscribers would not register", () => {
		expect(
			crashed(
				"[22:35:36] [modloading-worker-0/ERROR] [ne.ne.fm.ja.FMLModContainer/LOADING]: Failed to register automatic subscribers. ModID: wakes",
			).at(0)?.groups.mod,
		).toBe("wakes");
	});

	test("reads the class a mod asked a dedicated server to load", () => {
		const [event] = crashed(
			"[14:38:26] [Server thread/ERROR] [ne.mi.fm.lo.RuntimeDistCleaner/DISTXFORM]: Attempted to load class net/minecraft/client/multiplayer/ClientLevel for invalid dist DEDICATED_SERVER",
		);

		expect(event?.groups.detail).toBe("net/minecraft/client/multiplayer/ClientLevel");
	});

	test("says nothing about a healthy start", () => {
		for (const line of [
			'[12:00:00] [Server thread/INFO]: Done (12.345s)! For help, type "help"',
			'[12:00:00] [Server thread/INFO]: Preparing level "world"',
			"[12:00:00] [Server thread/INFO]: Loading 214 mods:",
			"[12:00:00] [Server thread/INFO]: <Meslzy> Could not execute entrypoint stage",
		]) {
			expect(crashed(line)).toEqual([]);
		}
	});
});

describe("telling the platform how a player died", () => {
	test("names the mob that slew a player", () => {
		const [event] = died("[12:34:56] [Server thread/INFO]: Meslzy was slain by Zombie");

		expect(event?.payload.cause).toBe("slain");
		expect(event?.groups.player).toBe("Meslzy");
		expect(event?.groups.skin).toBe("Meslzy");
		expect(event?.groups.killer).toBe("Zombie");
	});

	test("keeps the killer and drops the weapon it was holding", () => {
		const [event] = died(
			"[12:34:56] [Server thread/INFO]: Meslzy was slain by Wither Skeleton using [Netherite Sword]",
		);

		expect(event?.payload.cause).toBe("slain");
		expect(event?.groups.killer).toBe("Wither Skeleton");
	});

	test("reads a bedrock player without the floodgate dot in the skin", () => {
		const [event] = died("[12:34:56] [Server thread/INFO]: .Steve,B was slain by Creeper");

		expect(event?.payload.cause).toBe("slain");
		expect(event?.groups.player).toBe(".Steve,B");
		expect(event?.groups.skin).toBe("Steve,B");
		expect(event?.groups.killer).toBe("Creeper");
	});

	test("reads an arrow, the bow behind it, and a wither skull", () => {
		expect(died("[12:34:56] [Server thread/INFO]: Meslzy was shot by Skeleton").at(0)?.groups.killer).toBe("Skeleton");

		const [withBow] = died("[12:34:56] [Server thread/INFO]: Meslzy was shot by Skeleton using [Bow]");

		expect(withBow?.payload.cause).toBe("shot");
		expect(withBow?.groups.killer).toBe("Skeleton");

		const [skull] = died("[12:34:56] [Server thread/INFO]: Meslzy was shot by a skull from Wither");

		expect(skull?.payload.cause).toBe("shot");
		expect(skull?.groups.killer).toBe("Wither");
	});

	test("reads a creeper blowing a player up", () => {
		const [event] = died("[12:34:56] [Server thread/INFO]: Meslzy was blown up by Creeper");

		expect(event?.payload.cause).toBe("blown-up");
		expect(event?.groups.killer).toBe("Creeper");

		expect(
			died("[12:34:56] [Server thread/INFO]: Meslzy was blown up by Ghast using [Fire Charge]").at(0)?.groups.killer,
		).toBe("Ghast");
	});

	test("reads a bed lit in the nether", () => {
		const [event] = died("[12:34:56] [Server thread/INFO]: Meslzy was killed by [Intentional Game Design]");

		expect(event?.payload.cause).toBe("intentional-game-design");
		expect(event?.groups.player).toBe("Meslzy");
	});

	test("reads a player who blew themselves up", () => {
		const [event] = died("[12:34:56] [Server thread/INFO]: Meslzy blew up");

		expect(event?.payload.cause).toBe("explosion");
		expect(event?.groups.player).toBe("Meslzy");
	});

	test("reads every way a player falls", () => {
		for (const tail of [
			"fell from a high place",
			"fell off a ladder",
			"fell off scaffolding",
			"fell while climbing",
			"fell off some twisting vines",
			"fell off some weeping vines",
			"fell off some vines",
		]) {
			const [event] = died(`[12:34:56] [Server thread/INFO]: Meslzy ${tail}`);

			expect(event?.payload.cause).toBe("fell");
			expect(event?.groups.player).toBe("Meslzy");
		}
	});

	test("reads a hard landing on its own and while fleeing", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy hit the ground too hard");

		expect(alone?.payload.cause).toBe("hard-landing");
		expect(alone?.groups.killer).toBeUndefined();

		const [fleeing] = died(
			"[12:34:56] [Server thread/INFO]: Meslzy hit the ground too hard while trying to escape Enderman",
		);

		expect(fleeing?.payload.cause).toBe("hard-landing");
		expect(fleeing?.groups.killer).toBe("Enderman");
	});

	test("reads a drowning on its own and while fleeing", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy drowned");

		expect(alone?.payload.cause).toBe("drowned");
		expect(alone?.groups.killer).toBeUndefined();

		const [fleeing] = died("[12:34:56] [Server thread/INFO]: Meslzy drowned while trying to escape Drowned");

		expect(fleeing?.payload.cause).toBe("drowned");
		expect(fleeing?.groups.killer).toBe("Drowned");
	});

	test("reads lava on its own and while fleeing", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy tried to swim in lava");

		expect(alone?.payload.cause).toBe("lava");
		expect(alone?.groups.killer).toBeUndefined();

		const [fleeing] = died("[12:34:56] [Server thread/INFO]: Meslzy tried to swim in lava to escape Blaze");

		expect(fleeing?.payload.cause).toBe("lava");
		expect(fleeing?.groups.killer).toBe("Blaze");
	});

	test("reads starving on its own and mid-fight", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy starved to death");

		expect(alone?.payload.cause).toBe("starved");
		expect(alone?.groups.killer).toBeUndefined();

		const [fighting] = died("[12:34:56] [Server thread/INFO]: Meslzy starved to death while fighting Zombie");

		expect(fighting?.payload.cause).toBe("starved");
		expect(fighting?.groups.killer).toBe("Zombie");
	});

	test("reads suffocation on its own and mid-fight", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy suffocated in a wall");

		expect(alone?.payload.cause).toBe("suffocated");
		expect(alone?.groups.killer).toBeUndefined();

		const [fighting] = died("[12:34:56] [Server thread/INFO]: Meslzy suffocated in a wall while fighting Enderman");

		expect(fighting?.payload.cause).toBe("suffocated");
		expect(fighting?.groups.killer).toBe("Enderman");
	});

	test("reads withering on its own and mid-fight", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy withered away");

		expect(alone?.payload.cause).toBe("withered");
		expect(alone?.groups.killer).toBeUndefined();

		const [fighting] = died("[12:34:56] [Server thread/INFO]: Meslzy withered away while fighting Wither Skeleton");

		expect(fighting?.payload.cause).toBe("withered");
		expect(fighting?.groups.killer).toBe("Wither Skeleton");
	});

	test("reads the deaths that name nothing but themselves", () => {
		for (const [tail, cause] of [
			[
				"burned to death",
				"burned",
			],
			[
				"went up in flames",
				"flames",
			],
			[
				"was pricked to death",
				"pricked",
			],
			[
				"fell out of the world",
				"void",
			],
			[
				"froze to death",
				"froze",
			],
		]) {
			const [event] = died(`[12:34:56] [Server thread/INFO]: Meslzy ${tail}`);

			expect(event?.payload.cause).toBe(cause);
			expect(event?.groups.player).toBe("Meslzy");
		}
	});

	test("refuses a death a player typed themselves", () => {
		for (const line of [
			"[12:34:56] [Server thread/INFO]: <Alice> Bob was slain by Zombie",
			"[12:34:56] [Server thread/INFO]: [Alice] Bob drowned",
			"[12:34:56] [Server thread/INFO]: Meslzy drowned the crops before logging off",
			"[12:34:56] [Server thread/INFO]: Meslzy blew up the creeper farm by accident",
		]) {
			expect(died(line)).toEqual([]);
		}
	});
});

describe("telling the platform what a player earned", () => {
	test("reads an advancement", () => {
		const [event] = advanced("[12:34:56] [Server thread/INFO]: Meslzy has made the advancement [Stone Age]");

		expect(event?.payload.type).toBe("advancement");
		expect(event?.groups.player).toBe("Meslzy");
		expect(event?.groups.skin).toBe("Meslzy");
		expect(event?.groups.advancement).toBe("Stone Age");
	});

	test("reads a challenge", () => {
		const [event] = advanced("[12:34:56] [Server thread/INFO]: Meslzy has completed the challenge [Adventuring Time]");

		expect(event?.payload.type).toBe("challenge");
		expect(event?.groups.advancement).toBe("Adventuring Time");
	});

	test("reads a goal for a bedrock player", () => {
		const [event] = advanced("[12:34:56] [Server thread/INFO]: .Steve,B has reached the goal [Sky's the Limit]");

		expect(event?.payload.type).toBe("goal");
		expect(event?.groups.player).toBe(".Steve,B");
		expect(event?.groups.skin).toBe("Steve,B");
		expect(event?.groups.advancement).toBe("Sky's the Limit");
	});

	test("refuses an advancement a player typed themselves", () => {
		for (const line of [
			"[12:34:56] [Server thread/INFO]: <Alice> Bob has made the advancement [Stone Age]",
			"[12:34:56] [Server thread/INFO]: [Alice] Bob has reached the goal [Sky's the Limit]",
			"[12:34:56] [Server thread/INFO]: Meslzy has made the advancement [Stone Age] twice today",
		]) {
			expect(advanced(line)).toEqual([]);
		}
	});
});

describe("naming the memory a pack asks for", () => {
	test("reads the line memorysettings prints on a modern pack", () => {
		const [event] = undersized(
			"[12:34:56] [main/WARN] (memorysettings) You have allocated less memory( 1536 MB) than the recommended minimum for this pack: 4000 MB.",
		);

		expect(event?.groups.allocatedMb).toBe("1536");
		expect(event?.groups.requiredMb).toBe("4000");
	});

	test("reads the older wording with no space around the numbers", () => {
		const [event] = undersized(
			"[12:34:56] [main/WARN]: You have less memory allocated(1536mb) than recommended for this pack, the minimum is: 4000mb.",
		);

		expect(event?.groups.allocatedMb).toBe("1536");
		expect(event?.groups.requiredMb).toBe("4000");
	});

	test("reads the pack that asks for a whole lot", () => {
		const [event] = undersized(
			"[12:34:56] [main/WARN] (memorysettings) You have allocated less memory( 4096 MB) than the recommended minimum for this pack: 12000 MB.",
		);

		expect(event?.groups.allocatedMb).toBe("4096");
		expect(event?.groups.requiredMb).toBe("12000");
	});

	test("stays quiet on a line that only talks about memory", () => {
		for (const line of [
			"[12:34:56] [Server thread/INFO]: Meslzy joined the game",
			"[12:34:56] [main/INFO]: Memory: 1536 MB allocated for this pack",
			"[12:34:56] [main/WARN]: You have allocated enough memory for this pack",
		]) {
			expect(undersized(line)).toEqual([]);
		}
	});
});

describe("what the events module promises the platform", () => {
	test("declares every name it emits outside a console pattern", () => {
		expect(events.emits).toContain("ModCrashed");
	});

	test("stays well inside the platform's event name budget", () => {
		const names = new Set([
			...events.patterns.map((pattern) => pattern.emit),
			...(events.emits ?? []),
		]);

		expect(names.size).toBeLessThanOrEqual(32);
	});
});
