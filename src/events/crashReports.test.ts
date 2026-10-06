import { describe, expect, it } from "bun:test";
import { readCrashAttribution, readLogAttribution } from "./crashReports";

const FORGE_REPORT = `---- Minecraft Crash Report ----
// Don't be sad, have a hug! <3

Time: 2026-08-31 04:12:07
Description: Mod loading error has occurred

java.lang.Exception: Mod Loading has failed
	at net.minecraftforge.logging.CrashReportExtender.dumpModLoadingCrashReport(CrashReportExtender.java:47)

-- MOD missingmodschecker --
Details:
	Caused by 0: java.lang.NoClassDefFoundError: java/awt/HeadlessException
	Mod File: /data/mods/MissingModsChecker-1.20.1-1.1.jar
	Failure message: Missing Mods Checker (missingmodschecker) has failed to load correctly
		java.lang.NoClassDefFoundError: java/awt/HeadlessException
	Mod Version: 1.1
	Mod Issue URL: NOT PROVIDED
	Exception message: java.lang.NoClassDefFoundError: java/awt/HeadlessException
Stacktrace:
	at net.minecraftforge.fml.javafmlmod.FMLModContainer.constructMod(FMLModContainer.java:71)
`;

const NEOFORGE_REPORT = `---- Minecraft Crash Report ----
Time: 2026-08-31 04:20:00
Description: Mod loading failures have occurred; consult the issue messages for more details

-- Mod loading issue for: entity_texture_features --
Details:
	Mod file: /data/mods/entity_texture_features_neoforge_1.21.1-6.2.9.jar
	Failure message: Entity Texture Features (entity_texture_features) encountered an error during the load_registries event phase
		java.lang.NoClassDefFoundError: net/minecraft/client/renderer/texture/TextureManager
	Mod version: 6.2.9
	Mod issues URL: <No issues URL found>
	Exception message: java.lang.NoClassDefFoundError
`;

const VANILLA_REPORT = `---- Minecraft Crash Report ----
Time: 2026-08-31 05:00:00
Description: Exception in server tick loop

java.lang.OutOfMemoryError: Java heap space
`;

describe("reading the crash report the last start left behind", () => {
	it("names the jar, the mod and the failure from a forge report", () => {
		expect(readCrashAttribution(FORGE_REPORT)).toEqual({
			jar: "MissingModsChecker-1.20.1-1.1.jar",
			mod: "missingmodschecker",
			detail: "Missing Mods Checker (missingmodschecker) has failed to load correctly",
		});
	});

	it("reads a neoforge report, which spells the labels differently", () => {
		expect(readCrashAttribution(NEOFORGE_REPORT)).toEqual({
			jar: "entity_texture_features_neoforge_1.21.1-6.2.9.jar",
			mod: "entity_texture_features",
			detail:
				"Entity Texture Features (entity_texture_features) encountered an error during the load_registries event phase",
		});
	});

	it("stays quiet on a crash no mod is named in", () => {
		expect(readCrashAttribution(VANILLA_REPORT)).toBeNull();
	});

	it("falls back to the report's own description when no mod failure message is given", () => {
		const attribution = readCrashAttribution(`---- Minecraft Crash Report ----
Description: Exception in server tick loop

-- MOD create --
Details:
	Mod File: /data/mods/create-1.20.1-0.5.1.f.jar
`);

		expect(attribution?.detail).toBe("Exception in server tick loop");
		expect(attribution?.jar).toBe("create-1.20.1-0.5.1.f.jar");
	});

	it("ignores a mod file entry that is not a jar", () => {
		const attribution = readCrashAttribution(`-- MOD minecraft --
Details:
	Mod File: NO FILE INFO
`);

		expect(attribution?.jar).toBeNull();
		expect(attribution?.mod).toBe("minecraft");
	});
});

const EMPTY_REPORT_LOG = `[22:35:36] [modloading-worker-0/FATAL] [ne.ne.fm.ja.AutomaticEventSubscriber/LOADING]: Failed to register class Lcom/leclowndu93150/wakes/event/WakeClientTicker; with @EventBusSubscriber annotation
java.lang.RuntimeException: Attempted to load class net/minecraft/client/multiplayer/ClientLevel for invalid dist DEDICATED_SERVER
[22:35:36] [modloading-worker-0/ERROR] [ne.ne.fm.ja.FMLModContainer/LOADING]: Failed to register automatic subscribers. ModID: wakes
[22:35:36] [main/FATAL] [ne.ne.fm.ModLoader/LOADING]: Failed to wait for future Mod Construction, 1 errors found
`;

describe("reading the game log when the crash report came back empty", () => {
	it("names the mod and the class the console gave away", () => {
		expect(readLogAttribution(EMPTY_REPORT_LOG)).toEqual({
			jar: null,
			mod: "wakes",
			detail: "net/minecraft/client/multiplayer/ClientLevel",
		});
	});

	it("stays quiet when the log names no mod", () => {
		expect(readLogAttribution('[12:00:00] [Server thread/INFO]: Done (12.345s)! For help, type "help"')).toBeNull();
	});

	it("stays quiet when nothing but a client class is named", () => {
		expect(
			readLogAttribution(
				"[14:38:26] [Server thread/ERROR]: Attempted to load class net/minecraft/client/gui/screens/Screen for invalid dist DEDICATED_SERVER",
			),
		).toBeNull();
	});
});

const DUPLICATE_REPORT = `---- Minecraft Crash Report ----
Time: 2026-10-06 04:20:00
Description: Mod loading failures have occurred; consult the issue messages for more details

-- Mod loading issue --
Details:
	Failure message: Mod sodium is present in multiple files: sodium-neoforge-0.6.0+mc1.21.1.jar, sodium-neoforge-0.6.5+mc1.21.1.jar
`;

const MIXIN_REPORT = `---- Minecraft Crash Report ----
Time: 2026-10-06 04:20:00
Description: Mod loading failures have occurred; consult the issue messages for more details

-- Mod loading issue for: seasons --
Details:
	Mod file: /data/mods/seasons-neoforge-1.21.1-2.4.jar
	Failure message: Mixin application of com.example.seasons.mixin.BiomeMixin from Seasons (seasons) has failed
	Mod version: 2.4
`;

const MIXIN_STACK_REPORT = `---- Minecraft Crash Report ----
Description: Exception in server tick loop

java.lang.RuntimeException: Mixin transformation of net.minecraft.class_1297 failed
Caused by: org.spongepowered.asm.mixin.transformer.throwables.MixinTransformerError: An unexpected critical error was encountered
Caused by: org.spongepowered.asm.mixin.injection.throwables.InjectionError: Critical injection failure: Callback method setInWater(Z)Z in expandability-common.mixins.json:swimming.EntityMixin from mod expandability failed injection check, (3/4) succeeded. Scanned 0 target(s). Using refmap expandability-common-refmap.json
`;

describe("readCrashAttribution", () => {
	it("marks a report whose neoforge failure message names two jars for one mod", () => {
		expect(readCrashAttribution(DUPLICATE_REPORT)).toEqual({
			jar: null,
			mod: null,
			detail:
				"Mod sodium is present in multiple files: sodium-neoforge-0.6.0+mc1.21.1.jar, sodium-neoforge-0.6.5+mc1.21.1.jar",
			reason: "duplicate",
		});
	});

	it("marks a report whose failure is a mixin", () => {
		expect(readCrashAttribution(MIXIN_REPORT)).toEqual({
			jar: "seasons-neoforge-1.21.1-2.4.jar",
			mod: "seasons",
			detail: "Mixin application of com.example.seasons.mixin.BiomeMixin from Seasons (seasons) has failed",
			reason: "mixin",
		});
	});

	it("finds the mixin and its mod in a fabric stack when no mod section was written", () => {
		expect(readCrashAttribution(MIXIN_STACK_REPORT)).toEqual({
			jar: null,
			mod: "expandability",
			detail: "Exception in server tick loop",
			reason: "mixin",
		});
	});

	it("leaves a mod that simply failed without a reason", () => {
		expect(readCrashAttribution(FORGE_REPORT)?.reason).toBeUndefined();
	});
});

describe("readLogAttribution", () => {
	it("names the duplicate mod forge listed in the log", () => {
		expect(
			readLogAttribution(`[14Apr2025 11:43:04.120] [main/ERROR] [net.minecraftforge.fml.loading.UniqueModListBuilder/LOADING]: Found duplicate mods:
	Mod ID: 'rubidium' from mod files: rubidium-mc1.20.1-0.7.1.jar, embeddium-0.3.31+mc1.20.1.jar
[14Apr2025 11:43:04.121] [main/ERROR] [net.minecraftforge.fml.loading.moddiscovery.ModDiscoverer/SCAN]: Failed to build unique mod list after mod discovery.
`),
		).toEqual({
			jar: null,
			mod: "rubidium",
			detail: null,
			reason: "duplicate",
		});
	});

	it("keeps a mixin failure that names no mod", () => {
		expect(
			readLogAttribution(
				"[12:00:00] [main/ERROR] [mixin/]: Mixin apply failed seasons.mixins.json:BiomeMixin -> net.minecraft.world.level.biome.Biome: org.spongepowered.asm.mixin.injection.throwables.InvalidInjectionException Critical injection failure",
			),
		).toEqual({
			jar: null,
			mod: null,
			detail: "seasons.mixins.json:BiomeMixin",
			reason: "mixin",
		});
	});
});
