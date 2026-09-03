import { describe, expect, test } from "bun:test";
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
	test("names the jar, the mod and the failure from a forge report", () => {
		expect(readCrashAttribution(FORGE_REPORT)).toEqual({
			jar: "MissingModsChecker-1.20.1-1.1.jar",
			mod: "missingmodschecker",
			detail: "Missing Mods Checker (missingmodschecker) has failed to load correctly",
		});
	});

	test("reads a neoforge report, which spells the labels differently", () => {
		expect(readCrashAttribution(NEOFORGE_REPORT)).toEqual({
			jar: "entity_texture_features_neoforge_1.21.1-6.2.9.jar",
			mod: "entity_texture_features",
			detail:
				"Entity Texture Features (entity_texture_features) encountered an error during the load_registries event phase",
		});
	});

	test("stays quiet on a crash no mod is named in", () => {
		expect(readCrashAttribution(VANILLA_REPORT)).toBeNull();
	});

	test("falls back to the report's own description when no mod failure message is given", () => {
		const attribution = readCrashAttribution(`---- Minecraft Crash Report ----
Description: Exception in server tick loop

-- MOD create --
Details:
	Mod File: /data/mods/create-1.20.1-0.5.1.f.jar
`);

		expect(attribution?.detail).toBe("Exception in server tick loop");
		expect(attribution?.jar).toBe("create-1.20.1-0.5.1.f.jar");
	});

	test("ignores a mod file entry that is not a jar", () => {
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
	test("names the mod and the class the console gave away", () => {
		expect(readLogAttribution(EMPTY_REPORT_LOG)).toEqual({
			jar: null,
			mod: "wakes",
			detail: "net/minecraft/client/multiplayer/ClientLevel",
		});
	});

	test("stays quiet when the log names no mod", () => {
		expect(readLogAttribution('[12:00:00] [Server thread/INFO]: Done (12.345s)! For help, type "help"')).toBeNull();
	});

	test("stays quiet when nothing but a client class is named", () => {
		expect(
			readLogAttribution(
				"[14:38:26] [Server thread/ERROR]: Attempted to load class net/minecraft/client/gui/screens/Screen for invalid dist DEDICATED_SERVER",
			),
		).toBeNull();
	});
});
