import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { rconAccess } from "./rconAccess";

const PASSWORD = "hunter2-rcon-secret";

const STAMP = {
	variant: "paper",
	version: "1.21.4",
	build: "100",
	java: 21,
	launch: {
		kind: "jar",
		target: "server.jar",
	},
	rconPassword: PASSWORD,
	rconPasswordNext: null,
};

describe("rotating the RCON password", () => {
	it("reports the target and never the password", async () => {
		const reported: Bridge.Activity[] = [];
		let written = "";
		const context = {
			files: {
				exists: async () => true,
				read: async () => JSON.stringify(STAMP),
				write: async (_path: string, text: string) => {
					written = text;
				},
			},
			log: () => {},
			activity: {
				report: (entry: Bridge.Activity) => {
					reported.push(entry);
				},
			},
		} as unknown as Bridge.Context;

		await rconAccess.actions?.rotate?.(context, {});

		const next = JSON.parse(written).rconPasswordNext;
		const serialized = JSON.stringify(reported);

		expect(reported).toEqual([
			{
				name: BridgeEventName.SecretRotated,
				text: {
					ar: "تم تغيير كلمة مرور RCON",
					en: "Changed the RCON password",
				},
				subject: "RCON",
				details: {
					target: "rcon",
				},
			},
		]);
		expect(serialized).not.toContain(PASSWORD);
		expect(serialized).not.toContain(next);
	});
});
