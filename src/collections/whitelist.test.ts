import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { whitelist } from "./whitelist";

const recorder = (variables: Record<string, string> = {}) => {
	const sent: string[] = [];
	const reported: Bridge.Activity[] = [];
	const context = {
		variable: (key: string) => variables[key] ?? null,
		command: async (input: string) => {
			sent.push(input);

			return {
				sent: input,
				line: null,
				groups: {},
			};
		},
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		sent,
		reported,
	};
};

describe("what the whitelist reports", () => {
	test("adding a java player grants whitelist access by name", async () => {
		const { context, sent, reported } = recorder();

		await whitelist.add?.(context, " Steve ");

		expect(sent).toEqual([
			"whitelist add Steve",
		]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.AccessGranted,
				text: {
					ar: "تمت إضافة Steve للقائمة البيضاء",
					en: "Added Steve to the whitelist",
				},
				subject: "Steve",
				details: {
					list: "whitelist",
					player: "Steve",
					platform: "java",
				},
			},
		]);
	});

	test("a bedrock player added through floodgate is reported as bedrock", async () => {
		const { context, sent, reported } = recorder({
			CROSSPLAY: "true",
			SERVER_TYPE: "paper",
		});

		await whitelist.add?.(context, ".Alex Pro");

		expect(sent).toEqual([
			'fwhitelist add ".Alex Pro"',
		]);
		expect(reported.at(0)).toMatchObject({
			name: BridgeEventName.AccessGranted,
			subject: ".Alex Pro",
			details: {
				list: "whitelist",
				platform: "bedrock",
			},
		});
	});

	test("removing a player revokes whitelist access", async () => {
		const { context, reported } = recorder();

		await whitelist.actions?.remove?.(
			context,
			{
				id: "Steve",
				name: "Steve",
			},
			{},
		);

		expect(reported.at(0)).toMatchObject({
			name: BridgeEventName.AccessRevoked,
			subject: "Steve",
			text: {
				en: "Removed Steve from the whitelist",
			},
		});
	});
});
