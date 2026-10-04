import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { RCON_PASSWORD_LENGTH } from "@serverkgg/bridge/rcon";
import { ServerVariant } from "../shared";
import {
	generateRconPassword,
	pinRconProperties,
	promoteRconPassword,
	RCON_PORT,
	rconPasswordOf,
	rconProperties,
} from "./installRcon";
import type { InstallStamp } from "./installStamp";
import { LaunchKind } from "./launchPlan";

const generate = () => "generated";

describe("promoting the rcon password the process is started with", () => {
	it("generates the first password when the stamp carries none", () => {
		expect(
			promoteRconPassword(
				{
					rconPassword: null,
					rconPasswordNext: null,
				},
				generate,
			),
		).toEqual({
			rconPassword: "generated",
			rconPasswordNext: null,
		});
	});

	it("keeps the live password when nothing is pending", () => {
		expect(
			promoteRconPassword(
				{
					rconPassword: "live",
					rconPasswordNext: null,
				},
				generate,
			),
		).toEqual({
			rconPassword: "live",
			rconPasswordNext: null,
		});
	});

	it("moves a rotated password into place and clears the pending slot", () => {
		expect(
			promoteRconPassword(
				{
					rconPassword: "live",
					rconPasswordNext: "next",
				},
				generate,
			),
		).toEqual({
			rconPassword: "next",
			rconPasswordNext: null,
		});
	});

	it("generates a password of the shared length", () => {
		expect(generateRconPassword()).toHaveLength(RCON_PASSWORD_LENGTH);
	});
});

describe("telling the customer which password to use", () => {
	it("answers nothing before the first boot generated one", () => {
		expect(rconPasswordOf(null)).toBeNull();
		expect(
			rconPasswordOf({
				rconPassword: null,
				rconPasswordNext: null,
			}),
		).toBeNull();
	});

	it("answers the live password with nothing pending", () => {
		expect(
			rconPasswordOf({
				rconPassword: "live",
				rconPasswordNext: null,
			}),
		).toEqual({
			value: "live",
			pending: false,
		});
	});

	it("answers the rotated password as pending until the restart promotes it", () => {
		expect(
			rconPasswordOf({
				rconPassword: "live",
				rconPasswordNext: "next",
			}),
		).toEqual({
			value: "next",
			pending: true,
		});
		expect(
			rconPasswordOf({
				rconPassword: null,
				rconPasswordNext: "next",
			}),
		).toEqual({
			value: "next",
			pending: true,
		});
	});
});

describe("pinning rcon into server.properties", () => {
	it("enables rcon only while remote access is on, on the manifest port", () => {
		expect(rconProperties(true, "secret")).toEqual({
			"enable-rcon": "true",
			"rcon.port": RCON_PORT,
			"rcon.password": "secret",
		});
		expect(rconProperties(false, "secret")).toEqual({
			"enable-rcon": "false",
			"rcon.port": RCON_PORT,
			"rcon.password": "secret",
		});
	});

	it("listens on the port the manifest publishes", () => {
		expect(RCON_PORT).toBe(25_575);
	});
});

it("a fresh install commits its password only after writing RCON properties", async () => {
	const calls: string[] = [];
	const stamp: InstallStamp = {
		variant: ServerVariant.Paper,
		version: "1.21.4",
		build: "123",
		java: 21,
		launch: {
			kind: LaunchKind.Jar,
			target: "server.jar",
		},
		rconPassword: null,
		rconPasswordNext: null,
	};
	let stored: InstallStamp | null = null;
	const context = {
		variable: () => null,
		files: {
			write: async (_path: string, text: string) => {
				calls.push("stamp");
				stored = JSON.parse(text);
			},
		},
		codec: {
			javaProperties: {
				merge: async () => {
					calls.push("properties");
				},
			},
		},
	} as unknown as Bridge.Context;
	await pinRconProperties(context, stamp);
	expect(calls).toEqual([
		"properties",
		"stamp",
	]);
	expect(stored).toMatchObject({
		version: "1.21.4",
		rconPasswordNext: null,
	});
});
