import { describe, expect, test } from "bun:test";
import { ServerVariant } from "../shared";
import type { InstallIdentity, InstallStamp } from "./installStamp";
import { matchesStamp, parseInstallStamp } from "./installStamp";
import { LaunchKind } from "./launchPlan";

const stamp = (overrides: Partial<InstallStamp> = {}): InstallStamp => ({
	variant: ServerVariant.NeoForge,
	version: "1.21.1",
	build: "21.1.176",
	java: 21,
	launch: {
		kind: LaunchKind.Args,
		target: "libraries/net/neoforged/neoforge/21.1.176/unix_args.txt",
	},
	...overrides,
});

const identity = (overrides: Partial<InstallIdentity> = {}): InstallIdentity => ({
	variant: ServerVariant.NeoForge,
	version: "1.21.1",
	build: "21.1.176",
	...overrides,
});

describe("reading the record of what is already installed", () => {
	test("a complete stamp is read back whole", () => {
		const written = stamp();

		expect(parseInstallStamp(JSON.stringify(written))).toEqual(written);
	});

	test("a vanilla stamp carries no build", () => {
		const written = stamp({
			variant: ServerVariant.Vanilla,
			build: null,
			launch: {
				kind: LaunchKind.Jar,
				target: "server.jar",
			},
		});

		expect(parseInstallStamp(JSON.stringify(written))).toEqual(written);
	});

	test("a build that is not text is read as no build rather than rejecting the stamp", () => {
		expect(
			parseInstallStamp(
				JSON.stringify({
					...stamp(),
					build: 176,
				}),
			)?.build,
		).toBeNull();
	});

	test("a stamp written by a version we no longer know is thrown away, so the install runs again", () => {
		expect(
			parseInstallStamp(
				JSON.stringify({
					...stamp(),
					variant: "spigot",
				}),
			),
		).toBeNull();
	});

	test("a stamp missing the version, the java major or the launch plan is thrown away", () => {
		expect(
			parseInstallStamp(
				JSON.stringify({
					...stamp(),
					version: undefined,
				}),
			),
		).toBeNull();
		expect(
			parseInstallStamp(
				JSON.stringify({
					...stamp(),
					java: "21",
				}),
			),
		).toBeNull();
		expect(
			parseInstallStamp(
				JSON.stringify({
					...stamp(),
					launch: undefined,
				}),
			),
		).toBeNull();
	});

	test("a launch plan with an unknown kind or an empty target is thrown away", () => {
		expect(
			parseInstallStamp(
				JSON.stringify({
					...stamp(),
					launch: {
						kind: "script",
						target: "run.sh",
					},
				}),
			),
		).toBeNull();
		expect(
			parseInstallStamp(
				JSON.stringify({
					...stamp(),
					launch: {
						kind: LaunchKind.Jar,
						target: "",
					},
				}),
			),
		).toBeNull();
	});

	test("a truncated or empty file is thrown away instead of throwing", () => {
		expect(parseInstallStamp("")).toBeNull();
		expect(parseInstallStamp('{"variant":"neoforge"')).toBeNull();
		expect(parseInstallStamp("null")).toBeNull();
	});
});

describe("deciding whether the install on disk is the one being asked for", () => {
	test("the same variant, version and build is a match, so nothing is reinstalled", () => {
		expect(matchesStamp(stamp(), identity())).toBe(true);
	});

	test("a server with nothing installed never matches", () => {
		expect(matchesStamp(null, identity())).toBe(false);
	});

	test("any of the three moving parts changing is a mismatch", () => {
		expect(
			matchesStamp(
				stamp(),
				identity({
					variant: ServerVariant.Forge,
				}),
			),
		).toBe(false);
		expect(
			matchesStamp(
				stamp(),
				identity({
					version: "1.21.4",
				}),
			),
		).toBe(false);
		expect(
			matchesStamp(
				stamp(),
				identity({
					build: "21.1.180",
				}),
			),
		).toBe(false);
	});

	test("a pinned build against an unpinned request is a mismatch", () => {
		expect(
			matchesStamp(
				stamp(),
				identity({
					build: null,
				}),
			),
		).toBe(false);
	});
});
