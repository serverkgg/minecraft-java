import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { install } from "./install";

const STAMP = {
	variant: "vanilla",
	version: "1.21.4",
	build: null,
	java: 21,
	launch: {
		kind: "jar",
		target: "server.jar",
	},
	rconPassword: "kept-rcon-password",
	rconPasswordNext: null,
};

const bootWith = () => {
	const files = new Map<string, string>([
		[
			".serverk-install.json",
			JSON.stringify(STAMP),
		],
		[
			"server.jar",
			"",
		],
		[
			"server.properties",
			"",
		],
	]);
	const variables: Record<string, string> = {
		SERVER_TYPE: "vanilla",
		MC_VERSION: "1.21.4",
	};
	const reported: Bridge.Activity[] = [];
	const emitted: string[] = [];
	const logged: string[] = [];
	const context = {
		variable: (key: string) => variables[key] ?? null,
		secret: () => null,
		files: {
			exists: async (path: string) => files.has(path),
			read: async (path: string) => files.get(path) ?? "",
			write: async (path: string, text: string) => {
				files.set(path, text);
			},
			ensure: async () => {},
			remove: async (path: string) => {
				files.delete(path);
			},
			list: async () => [],
			size: async () => 0,
		},
		codec: {
			javaProperties: {
				read: async () => {
					return {};
				},
				merge: async () => {},
			},
		},
		net: {
			json: async () => {
				throw new Error("offline");
			},
			text: async () => {
				throw new Error("offline");
			},
		},
		logs: {
			tail: async () => [],
		},
		log: Object.assign(
			(message: string) => {
				logged.push(message);
			},
			{
				warn: () => {},
				error: () => {},
			},
		),
		emit: (event: string) => {
			emitted.push(event);
		},
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		reported,
		emitted,
		logged,
	};
};

describe("starting a server whose install is current", () => {
	it("reports nothing, so a plain start never reads as an install", async () => {
		const { context, reported, logged } = bootWith();

		const outcome = await install.run(context);

		expect(outcome).toBeUndefined();
		expect(logged).toContain("install is current");
		expect(reported).toEqual([]);
	});
});
