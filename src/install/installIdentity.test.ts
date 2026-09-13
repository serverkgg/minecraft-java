import { expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { ServerVariant } from "../shared";
import { resolveNext } from "./installIdentity";
import type { InstallStamp } from "./installStamp";
import { LaunchKind } from "./launchPlan";

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
const contextWith = (variables: Record<string, string>) =>
	({
		variable: (key: string) => variables[key] ?? null,
		files: {
			exists: async () => false,
		},
		net: {
			json: async () => {
				throw new Error("no network needed for a pinned restore");
			},
		},
	}) as unknown as Bridge.Context;

test("latest selectors reuse the archived exact identity even with runtime files missing", async () => {
	const result = await resolveNext(
		contextWith({
			SERVER_TYPE: "paper",
			MC_VERSION: "latest",
			LOADER_VERSION: "latest",
		}),
		stamp,
	);
	expect(result.next).toEqual({
		variant: ServerVariant.Paper,
		version: "1.21.4",
		build: "123",
	});
});

test("an explicit selected build overrides the archived build", async () => {
	const result = await resolveNext(
		contextWith({
			SERVER_TYPE: "paper",
			MC_VERSION: "1.21.4",
			LOADER_VERSION: "456",
		}),
		stamp,
	);
	expect(result.next.build).toBe("456");
});
