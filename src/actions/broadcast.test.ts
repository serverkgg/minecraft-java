import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BRIDGE_ACTIVITY_EXCERPT_LENGTH_LIMIT, BridgeEventName } from "@serverkgg/bridge/protocol";
import { broadcast } from "./broadcast";

const recorder = () => {
	const reported: Bridge.Activity[] = [];
	const context = {
		command: async (input: string) => {
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
		reported,
	};
};

describe("what a broadcast reports", () => {
	it("a short chat message is quoted whole", async () => {
		const { context, reported } = recorder();

		await broadcast.actions.say?.(context, {
			message: "restart in 5 minutes",
		});

		expect(reported).toEqual([
			{
				name: BridgeEventName.BroadcastSent,
				text: {
					ar: "تم إرسال رسالة بالشات: «restart in 5 minutes»",
					en: 'Sent a chat message: "restart in 5 minutes"',
				},
				details: {
					channel: "chat",
					excerpt: "restart in 5 minutes",
				},
			},
		]);
	});

	it("a long on-screen message is cut to the excerpt limit", async () => {
		const { context, reported } = recorder();
		const message = "welcome ".repeat(30);

		await broadcast.actions.title?.(context, {
			message,
		});

		const excerpt = String(reported.at(0)?.details?.excerpt ?? "");

		expect(reported.at(0)?.name).toBe(BridgeEventName.BroadcastSent);
		expect(excerpt.length).toBeLessThanOrEqual(BRIDGE_ACTIVITY_EXCERPT_LENGTH_LIMIT);
		expect(excerpt.endsWith("…")).toBe(true);
		expect(reported.at(0)?.text.en).toBe(`Showed an on-screen message: "${excerpt}"`);
	});
});
