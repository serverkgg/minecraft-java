import { describe, expect, test } from "bun:test";
import { lifecycle } from "./lifecycle";

describe("telling a booted server from one that gave up", () => {
	test("the ready line is the vanilla done banner", () => {
		expect(lifecycle.ready?.test('[12:00:00] [Server thread/INFO]: Done (6.313s)! For help, type "help"')).toBe(true);
	});

	test("forge's fatal start line means the game is dead even though the process stays up", () => {
		expect(
			lifecycle.failed?.test(
				"Suspected Mods: None[20:16:17] [main/FATAL] [minecraft/Main]: Failed to start the minecraft server",
			),
		).toBe(true);
	});

	test("a mod warning during loading is not a failed boot", () => {
		expect(
			lifecycle.failed?.test(
				"[20:16:06] [modloading-worker-2/ERROR] [ne.mi.fm.ja.FMLModContainer/LOADING]: Failed to register automatic subscribers. ModID: alexsmobs",
			),
		).toBe(false);
	});
});
