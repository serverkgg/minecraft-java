import { describe, expect, it } from "bun:test";
import { BridgeStream } from "@serverkgg/bridge";
import { events } from "./events";

const emitted = (line: string) => {
	return events.patterns.flatMap((pattern) => {
		const match = pattern.match.exec(line);

		return match === null
			? []
			: [
					{
						emit: pattern.emit,
						stream: pattern.stream ?? null,
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

const lastOf = (line: string, name: string) => {
	return emitted(line)
		.filter((event) => event.emit === name)
		.at(-1);
};

describe("naming the mod that stopped a server from booting", () => {
	it("reads the fabric entrypoint failure", () => {
		const [event] = crashed(
			"[12:01:02] [main/ERROR]: java.lang.RuntimeException: Could not execute entrypoint stage 'main' due to errors, provided by 'fabrically_adds'!",
		);

		expect(event?.groups.mod).toBe("fabrically_adds");
		expect(event?.groups.stage).toBe("main");
	});

	it("reads a prelaunch entrypoint failure too", () => {
		expect(
			crashed(
				"[12:01:02] [main/ERROR]: Could not execute entrypoint stage 'preLaunch' due to errors, provided by 'entity_texture_features'!",
			).at(0)?.groups.mod,
		).toBe("entity_texture_features");
	});

	it("reads a mixin that could not be applied", () => {
		expect(
			crashed(
				"[22:51:01] [main/ERROR]: Mixin apply for mod seasons failed seasons.mixins.json:BiomeMixin from mod seasons -> net.minecraft.class_1959",
			).at(0)?.groups.mod,
		).toBe("seasons");
	});

	it("reads the forge mod that would not start", () => {
		expect(
			crashed(
				"[23May2024 18:31:36.730] [modloading-worker-/ERROR] [net.minecraftforge.fml.javafmlmod.FMLModContainer/LOADING]: Failed to create mod instance. ModID: siren_head, class net.meme.sirenhead.SirenHeadMod",
			).at(0)?.groups.mod,
		).toBe("siren_head");
	});

	it("reads the mod whose event subscribers would not register", () => {
		expect(
			crashed(
				"[22:35:36] [modloading-worker-0/ERROR] [ne.ne.fm.ja.FMLModContainer/LOADING]: Failed to register automatic subscribers. ModID: wakes",
			).at(0)?.groups.mod,
		).toBe("wakes");
	});

	it("reads the class a mod asked a dedicated server to load", () => {
		const [event] = crashed(
			"[14:38:26] [Server thread/ERROR] [ne.mi.fm.lo.RuntimeDistCleaner/DISTXFORM]: Attempted to load class net/minecraft/client/multiplayer/ClientLevel for invalid dist DEDICATED_SERVER",
		);

		expect(event?.groups.detail).toBe("net/minecraft/client/multiplayer/ClientLevel");
	});

	it("says nothing about a healthy start", () => {
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
	it("names the mob that slew a player", () => {
		const [event] = died("[12:34:56] [Server thread/INFO]: Meslzy was slain by Zombie");

		expect(event?.payload.cause).toBe("slain");
		expect(event?.groups.player).toBe("Meslzy");
		expect(event?.groups.skin).toBe("Meslzy");
		expect(event?.groups.killer).toBe("Zombie");
	});

	it("keeps the killer and drops the weapon it was holding", () => {
		const [event] = died(
			"[12:34:56] [Server thread/INFO]: Meslzy was slain by Wither Skeleton using [Netherite Sword]",
		);

		expect(event?.payload.cause).toBe("slain");
		expect(event?.groups.killer).toBe("Wither Skeleton");
	});

	it("reads a bedrock player without the floodgate dot in the skin", () => {
		const [event] = died("[12:34:56] [Server thread/INFO]: .Steve,B was slain by Creeper");

		expect(event?.payload.cause).toBe("slain");
		expect(event?.groups.player).toBe(".Steve,B");
		expect(event?.groups.skin).toBe("Steve,B");
		expect(event?.groups.killer).toBe("Creeper");
	});

	it("reads an arrow, the bow behind it, and a wither skull", () => {
		expect(died("[12:34:56] [Server thread/INFO]: Meslzy was shot by Skeleton").at(0)?.groups.killer).toBe("Skeleton");

		const [withBow] = died("[12:34:56] [Server thread/INFO]: Meslzy was shot by Skeleton using [Bow]");

		expect(withBow?.payload.cause).toBe("shot");
		expect(withBow?.groups.killer).toBe("Skeleton");

		const [skull] = died("[12:34:56] [Server thread/INFO]: Meslzy was shot by a skull from Wither");

		expect(skull?.payload.cause).toBe("shot");
		expect(skull?.groups.killer).toBe("Wither");
	});

	it("reads a creeper blowing a player up", () => {
		const [event] = died("[12:34:56] [Server thread/INFO]: Meslzy was blown up by Creeper");

		expect(event?.payload.cause).toBe("blown-up");
		expect(event?.groups.killer).toBe("Creeper");

		expect(
			died("[12:34:56] [Server thread/INFO]: Meslzy was blown up by Ghast using [Fire Charge]").at(0)?.groups.killer,
		).toBe("Ghast");
	});

	it("reads a bed lit in the nether", () => {
		const [event] = died("[12:34:56] [Server thread/INFO]: Meslzy was killed by [Intentional Game Design]");

		expect(event?.payload.cause).toBe("intentional-game-design");
		expect(event?.groups.player).toBe("Meslzy");
	});

	it("reads a player who blew themselves up", () => {
		const [event] = died("[12:34:56] [Server thread/INFO]: Meslzy blew up");

		expect(event?.payload.cause).toBe("explosion");
		expect(event?.groups.player).toBe("Meslzy");
	});

	it("reads every way a player falls", () => {
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

	it("reads a hard landing on its own and while fleeing", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy hit the ground too hard");

		expect(alone?.payload.cause).toBe("hard-landing");
		expect(alone?.groups.killer).toBeUndefined();

		const [fleeing] = died(
			"[12:34:56] [Server thread/INFO]: Meslzy hit the ground too hard while trying to escape Enderman",
		);

		expect(fleeing?.payload.cause).toBe("hard-landing");
		expect(fleeing?.groups.killer).toBe("Enderman");
	});

	it("reads a drowning on its own and while fleeing", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy drowned");

		expect(alone?.payload.cause).toBe("drowned");
		expect(alone?.groups.killer).toBeUndefined();

		const [fleeing] = died("[12:34:56] [Server thread/INFO]: Meslzy drowned while trying to escape Drowned");

		expect(fleeing?.payload.cause).toBe("drowned");
		expect(fleeing?.groups.killer).toBe("Drowned");
	});

	it("reads lava on its own and while fleeing", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy tried to swim in lava");

		expect(alone?.payload.cause).toBe("lava");
		expect(alone?.groups.killer).toBeUndefined();

		const [fleeing] = died("[12:34:56] [Server thread/INFO]: Meslzy tried to swim in lava to escape Blaze");

		expect(fleeing?.payload.cause).toBe("lava");
		expect(fleeing?.groups.killer).toBe("Blaze");
	});

	it("reads starving on its own and mid-fight", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy starved to death");

		expect(alone?.payload.cause).toBe("starved");
		expect(alone?.groups.killer).toBeUndefined();

		const [fighting] = died("[12:34:56] [Server thread/INFO]: Meslzy starved to death while fighting Zombie");

		expect(fighting?.payload.cause).toBe("starved");
		expect(fighting?.groups.killer).toBe("Zombie");
	});

	it("reads suffocation on its own and mid-fight", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy suffocated in a wall");

		expect(alone?.payload.cause).toBe("suffocated");
		expect(alone?.groups.killer).toBeUndefined();

		const [fighting] = died("[12:34:56] [Server thread/INFO]: Meslzy suffocated in a wall while fighting Enderman");

		expect(fighting?.payload.cause).toBe("suffocated");
		expect(fighting?.groups.killer).toBe("Enderman");
	});

	it("reads withering on its own and mid-fight", () => {
		const [alone] = died("[12:34:56] [Server thread/INFO]: Meslzy withered away");

		expect(alone?.payload.cause).toBe("withered");
		expect(alone?.groups.killer).toBeUndefined();

		const [fighting] = died("[12:34:56] [Server thread/INFO]: Meslzy withered away while fighting Wither Skeleton");

		expect(fighting?.payload.cause).toBe("withered");
		expect(fighting?.groups.killer).toBe("Wither Skeleton");
	});

	it("reads the deaths that name nothing but themselves", () => {
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

	it("refuses a death a player typed themselves", () => {
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
	it("reads an advancement", () => {
		const [event] = advanced("[12:34:56] [Server thread/INFO]: Meslzy has made the advancement [Stone Age]");

		expect(event?.payload.type).toBe("advancement");
		expect(event?.groups.player).toBe("Meslzy");
		expect(event?.groups.skin).toBe("Meslzy");
		expect(event?.groups.advancement).toBe("Stone Age");
	});

	it("reads a challenge", () => {
		const [event] = advanced("[12:34:56] [Server thread/INFO]: Meslzy has completed the challenge [Adventuring Time]");

		expect(event?.payload.type).toBe("challenge");
		expect(event?.groups.advancement).toBe("Adventuring Time");
	});

	it("reads a goal for a bedrock player", () => {
		const [event] = advanced("[12:34:56] [Server thread/INFO]: .Steve,B has reached the goal [Sky's the Limit]");

		expect(event?.payload.type).toBe("goal");
		expect(event?.groups.player).toBe(".Steve,B");
		expect(event?.groups.skin).toBe("Steve,B");
		expect(event?.groups.advancement).toBe("Sky's the Limit");
	});

	it("refuses an advancement a player typed themselves", () => {
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
	it("reads the line memorysettings prints on a modern pack", () => {
		const [event] = undersized(
			"[12:34:56] [main/WARN] (memorysettings) You have allocated less memory( 1536 MB) than the recommended minimum for this pack: 4000 MB.",
		);

		expect(event?.groups.allocatedMb).toBe("1536");
		expect(event?.groups.requiredMb).toBe("4000");
	});

	it("reads the older wording with no space around the numbers", () => {
		const [event] = undersized(
			"[12:34:56] [main/WARN]: You have less memory allocated(1536mb) than recommended for this pack, the minimum is: 4000mb.",
		);

		expect(event?.groups.allocatedMb).toBe("1536");
		expect(event?.groups.requiredMb).toBe("4000");
	});

	it("reads the pack that asks for a whole lot", () => {
		const [event] = undersized(
			"[12:34:56] [main/WARN] (memorysettings) You have allocated less memory( 4096 MB) than the recommended minimum for this pack: 12000 MB.",
		);

		expect(event?.groups.allocatedMb).toBe("4096");
		expect(event?.groups.requiredMb).toBe("12000");
	});

	it("stays quiet on a line that only talks about memory", () => {
		for (const line of [
			"[12:34:56] [Server thread/INFO]: Meslzy joined the game",
			"[12:34:56] [main/INFO]: Memory: 1536 MB allocated for this pack",
			"[12:34:56] [main/WARN]: You have allocated enough memory for this pack",
		]) {
			expect(undersized(line)).toEqual([]);
		}
	});
});

describe("events", () => {
	describe("telling the platform two jars claim one mod", () => {
		it("reads forge's duplicate header and the mod line under it, from UniqueModListBuilder", () => {
			const header = lastOf(
				"[14Apr2025 11:43:04.120] [main/ERROR] [net.minecraftforge.fml.loading.UniqueModListBuilder/LOADING]: Found duplicate mods:",
				"ModCrashed",
			);
			const line = lastOf(
				"\tMod ID: 'rubidium' from mod files: rubidium-mc1.20.1-0.7.1.jar, embeddium-0.3.31+mc1.20.1.jar",
				"ModCrashed",
			);

			expect(header?.payload.reason).toBe("duplicate");
			expect(line?.payload.reason).toBe("duplicate");
			expect(line?.groups.mod).toBe("rubidium");
			expect(line?.groups.jars).toBe("rubidium-mc1.20.1-0.7.1.jar, embeddium-0.3.31+mc1.20.1.jar");
		});

		it("reads neoforge's duplicate_mod issue line from UniqueModListBuilder", () => {
			const event = lastOf(
				"ERROR: fml.modloadingissue.duplicate_mod [sodium; sodium-neoforge-0.6.0+mc1.21.1.jar, sodium-neoforge-0.6.5+mc1.21.1.jar]",
				"ModCrashed",
			);

			expect(event?.payload.reason).toBe("duplicate");
			expect(event?.payload.loader).toBe("neoforge");
			expect(event?.groups.mod).toBe("sodium");
			expect(event?.groups.jars).toBe("sodium-neoforge-0.6.0+mc1.21.1.jar, sodium-neoforge-0.6.5+mc1.21.1.jar");
		});

		it("reads the duplicate line forge printed on 1.7.10", () => {
			const event = lastOf(
				"[22:32:46] [Server thread/ERROR] [FML/]: Found a duplicate mod Baubles at [/aternos/server/mods/1.7.10/Baubles-1.7.10-1.0.1.10.jar, /aternos/server/mods/Baubles-1.7.10-1.0.1.10.jar]",
				"ModCrashed",
			);

			expect(event?.payload.reason).toBe("duplicate");
			expect(event?.groups.mod).toBe("Baubles");
			expect(event?.groups.jars).toBe(
				"/aternos/server/mods/1.7.10/Baubles-1.7.10-1.0.1.10.jar, /aternos/server/mods/Baubles-1.7.10-1.0.1.10.jar",
			);
		});

		it("reads the duplicate versions line older fabric loaders printed", () => {
			const event = lastOf(
				"net.fabricmc.loader.discovery.ModResolutionException: Duplicate versions for mod ID 'fabric': [0.30.3+1.16 at /server/mods/fabric-api-0.30.3+1.16.jar]",
				"ModCrashed",
			);

			expect(event?.payload.reason).toBe("duplicate");
			expect(event?.groups.mod).toBe("fabric");
		});

		it("matches fabric's duplicate line from ModResolver", () => {
			const event = lastOf(
				"Caused by: net.fabricmc.loader.impl.discovery.ModResolutionException: duplicate mod sodium",
				"ModCrashed",
			);

			expect(event?.payload.reason).toBe("duplicate");
			expect(event?.groups.mod).toBe("sodium");
		});

		it("says nothing about a library listed twice or a dependency line", () => {
			for (const line of [
				"[12:00:00] [main/ERROR]: Found duplicate plugins or libraries:",
				"[12:00:00] [main/INFO]: Loading 214 mods:",
			]) {
				expect(lastOf(line, "ModCrashed")).toBeUndefined();
			}
		});
	});

	describe("telling the platform a mixin could not be applied", () => {
		it("marks the fabric mixin line it already read", () => {
			const event = lastOf(
				"[22:51:01] [main/ERROR]: Mixin apply for mod seasons failed seasons.mixins.json:BiomeMixin from mod seasons -> net.minecraft.class_1959",
				"ModCrashed",
			);

			expect(event?.payload.reason).toBe("mixin");
			expect(event?.payload.loader).toBe("fabric");
			expect(event?.groups.mod).toBe("seasons");
		});

		it("leaves the bare transformer error alone and reads the injection failure that names the mod", () => {
			const transformer = lastOf(
				"Caused by: org.spongepowered.asm.mixin.transformer.throwables.MixinTransformerError: An unexpected critical error was encountered",
				"ModCrashed",
			);
			const injection = lastOf(
				"Caused by: org.spongepowered.asm.mixin.injection.throwables.InjectionError: Critical injection failure: Callback method setInWater(Z)Z in expandability-common.mixins.json:swimming.EntityMixin from mod expandability failed injection check, (3/4) succeeded. Scanned 0 target(s). Using refmap expandability-common-refmap.json",
				"ModCrashed",
			);

			expect(transformer).toBeUndefined();
			expect(injection?.payload.reason).toBe("mixin");
			expect(injection?.groups.mod).toBe("expandability");
			expect(injection?.groups.detail).toBe("expandability-common.mixins.json:swimming.EntityMixin");
		});

		it("reads the apply line upstream Mixin's MixinProcessor prints on forge", () => {
			const event = lastOf(
				"[12:00:00] [main/ERROR] [mixin/]: Mixin apply failed seasons.mixins.json:BiomeMixin -> net.minecraft.world.level.biome.Biome: org.spongepowered.asm.mixin.injection.throwables.InvalidInjectionException Critical injection failure",
				"ModCrashed",
			);

			expect(event?.payload.reason).toBe("mixin");
			expect(event?.groups.detail).toBe("seasons.mixins.json:BiomeMixin");
		});

		it("reads MixinProcessor's apply error with and without the mod fabric adds", () => {
			const upstream = lastOf(
				"Caused by: org.spongepowered.asm.mixin.throwables.MixinApplyError: Mixin [seasons.mixins.json:BiomeMixin] from phase [DEFAULT] in config [seasons.mixins.json] FAILED during APPLY",
				"ModCrashed",
			);
			const fabric = lastOf(
				"Caused by: org.spongepowered.asm.mixin.throwables.MixinApplyError: Mixin [seasons.mixins.json:BiomeMixin from mod seasons] from phase [DEFAULT] in config [seasons.mixins.json] FAILED during APPLY",
				"ModCrashed",
			);

			expect(upstream?.payload.reason).toBe("mixin");
			expect(upstream?.groups.detail).toBe("seasons.mixins.json:BiomeMixin");
			expect(upstream?.groups.mod).toBeUndefined();
			expect(fabric?.groups.mod).toBe("seasons");
		});

		it("reads the mixin failure neoforge's FMLModContainer logs with the mod", () => {
			const event = lastOf(
				"[12:00:00] [modloading-worker-0/ERROR] [ne.ne.fm.ja.FMLModContainer/LOADING]: Failed to apply mixin. Mixin Class: com.example.seasons.mixin.BiomeMixin, ModID: seasons",
				"ModCrashed",
			);

			expect(event?.payload.reason).toBe("mixin");
			expect(event?.payload.loader).toBe("neoforge");
			expect(event?.groups.mod).toBe("seasons");
			expect(event?.groups.detail).toBe("com.example.seasons.mixin.BiomeMixin");
		});

		it("says nothing about a mixin that only warns", () => {
			for (const line of [
				"[19:11:23] [main/WARN]: @Mixin target net.minecraft.class_287 was not found owo.mixins.json:BufferBuilderAccessor from mod owo",
				"[19:11:24] [main/INFO]: Initializing MixinExtras via com.llamalad7.mixinextras.service.MixinExtrasServiceImpl(version=0.4.1).",
			]) {
				expect(lastOf(line, "ModCrashed")).toBeUndefined();
			}
		});
	});

	describe("telling the platform a world came from a newer game", () => {
		it("reads the chunk paper refuses to downgrade, as paper's troubleshooting docs show it", () => {
			const event = lastOf(
				"java.lang.RuntimeException: Server attempted to load chunk saved with newer version of minecraft! 3955 > 3465",
				"WorldCorrupt",
			);

			expect(event?.payload.reason).toBe("newer-version");
			expect(event?.groups.worldDataVersion).toBe("3955");
			expect(event?.groups.serverDataVersion).toBe("3465");
		});

		it("reads the line vanilla 1.21.11's Main logs when both level.dat files fail", () => {
			const event = lastOf(
				"[12:00:00] [main/ERROR]: Failed to load world data from ./world/level.dat and ./world/level.dat_old. World files may be corrupted. Shutting down.",
				"WorldCorrupt",
			);

			expect(event?.payload.reason).toBeUndefined();
			expect(event?.groups.path).toBe("./world/level.dat");
		});

		it("reads the wording vanilla 26.1 and paper's WorldMigrationSupport share", () => {
			const event = lastOf(
				"[12:00:00 ERROR]: Failed to load world data. World files may be corrupted. Shutting down.",
				"WorldCorrupt",
			);

			expect(event).toBeDefined();
			expect(event?.groups.path).toBeUndefined();
		});

		it("waits while vanilla still tries the backup level.dat", () => {
			expect(
				lastOf("[12:00:00] [main/WARN]: Failed to load world data from ./world/level.dat", "WorldCorrupt"),
			).toBeUndefined();
		});

		it("keeps a damaged level.dat without a reason", () => {
			const event = lastOf("[12:00:00] [main/ERROR]: Failed to read world/level.dat", "WorldCorrupt");

			expect(event?.payload.reason).toBeUndefined();
			expect(event?.groups.path).toBe("world/level.dat");
		});
	});

	describe("telling threads apart from the heap when java runs out of memory", () => {
		it("reads the thread limit in openjdk's current wording, from stderr only", () => {
			const event = lastOf(
				"java.lang.OutOfMemoryError: unable to create native thread: possibly out of memory or process/resource limits reached",
				"ServerCrashed",
			);

			expect(event?.payload.reason).toBe("threads");
			expect(event?.stream).toBe(BridgeStream.Stderr);
			expect(event?.groups.error).toBe(
				"java.lang.OutOfMemoryError: unable to create native thread: possibly out of memory or process/resource limits reached",
			);
		});

		it("reads the java 8 wording too", () => {
			const event = lastOf(
				'Exception in thread "Server thread" java.lang.OutOfMemoryError: unable to create new native thread',
				"ServerCrashed",
			);

			expect(event?.payload.reason).toBe("threads");
		});

		it("keeps the plain heap case without a reason", () => {
			const crashed = emitted("java.lang.OutOfMemoryError: Java heap space").filter(
				(event) => event.emit === "ServerCrashed",
			);

			expect(crashed).toHaveLength(1);
			expect(crashed[0]?.payload.reason).toBeUndefined();
			expect(crashed[0]?.groups.error).toBe("java.lang.OutOfMemoryError: Java heap space");
		});
	});
});

describe("what the events module promises the platform", () => {
	it("declares every name it emits outside a console pattern", () => {
		expect(events.emits).toContain("ModCrashed");
		expect(events.emits).toContain("PlayerKicked");
		expect(events.emits).toContain("PlayerBanned");
	});

	it("stays well inside the platform's event name budget", () => {
		const names = new Set([
			...events.patterns.map((pattern) => pattern.emit),
			...(events.emits ?? []),
		]);

		expect(names.size).toBeLessThanOrEqual(32);
	});
});
