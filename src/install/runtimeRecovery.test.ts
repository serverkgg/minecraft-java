import { expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { ServerVariant } from "../shared";
import type { InstallStamp } from "./installStamp";
import { LaunchKind } from "./launchPlan";
import { RUNTIME_RECOVERY, recoverRuntime } from "./runtimeRecovery";

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
const fixture = (recorded: InstallStamp) => {
	const copies: string[][] = [];
	const context = {
		files: {
			exists: async (path: string) =>
				path === `${RUNTIME_RECOVERY}/identity.json` || path === `${RUNTIME_RECOVERY}/server.jar`,
			read: async () => JSON.stringify(recorded),
			remove: async () => {},
		},
		exec: async (args: string[]) => {
			copies.push(args);
			return {
				code: 0,
			};
		},
	} as unknown as Bridge.Context;
	return {
		context,
		copies,
	};
};

test("runtime recovery refuses a different Minecraft build", async () => {
	const { context, copies } = fixture({
		...stamp,
		build: "999",
	});
	expect(await recoverRuntime(context, stamp)).toBe(false);
	expect(copies).toHaveLength(0);
});

test("runtime recovery reuses only the exact preserved identity", async () => {
	const { context, copies } = fixture(stamp);
	expect(await recoverRuntime(context, stamp)).toBe(true);
	expect(copies).toEqual([
		[
			"cp",
			"-R",
			"--no-dereference",
			"--",
			`${RUNTIME_RECOVERY}/server.jar`,
			"server.jar",
		],
	]);
});
