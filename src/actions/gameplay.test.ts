import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { gameplay } from "./gameplay";

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

describe("what the gameplay actions report", () => {
	it("each action says what changed and to what", async () => {
		const { context, reported } = recorder();

		await gameplay.actions.timeDay?.(context, {});
		await gameplay.actions.weatherThunder?.(context, {});
		await gameplay.actions.saveAll?.(context, {});
		await gameplay.actions.difficulty?.(context, {
			mode: "hard",
		});

		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.GameplayChanged,
			BridgeEventName.GameplayChanged,
			BridgeEventName.GameplayChanged,
			BridgeEventName.GameplayChanged,
		]);
		expect(reported.map((entry) => entry.details)).toEqual([
			{
				what: "time",
				value: "day",
			},
			{
				what: "weather",
				value: "thunder",
			},
			{
				what: "save",
				value: "all",
			},
			{
				what: "difficulty",
				value: "hard",
			},
		]);
		expect(reported.at(3)?.text).toEqual({
			ar: "تم تغيير الصعوبة إلى صعب",
			en: "Set the difficulty to Hard",
		});
	});
});
