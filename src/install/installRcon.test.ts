import { describe, expect, test } from "bun:test";
import { RCON_PASSWORD_LENGTH } from "@serverkgg/bridge/rcon";
import { generateRconPassword, promoteRconPassword, RCON_PORT, rconPasswordOf, rconProperties } from "./installRcon";

const generate = () => "generated";

describe("promoting the rcon password the process is started with", () => {
	test("generates the first password when the stamp carries none", () => {
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

	test("keeps the live password when nothing is pending", () => {
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

	test("moves a rotated password into place and clears the pending slot", () => {
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

	test("generates a password of the shared length", () => {
		expect(generateRconPassword()).toHaveLength(RCON_PASSWORD_LENGTH);
	});
});

describe("telling the customer which password to use", () => {
	test("answers nothing before the first boot generated one", () => {
		expect(rconPasswordOf(null)).toBeNull();
		expect(
			rconPasswordOf({
				rconPassword: null,
				rconPasswordNext: null,
			}),
		).toBeNull();
	});

	test("answers the live password with nothing pending", () => {
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

	test("answers the rotated password as pending until the restart promotes it", () => {
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
	test("enables rcon only while remote access is on, on the manifest port", () => {
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

	test("listens on the port the manifest publishes", () => {
		expect(RCON_PORT).toBe(25_575);
	});
});
