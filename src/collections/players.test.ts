import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { playerPresence, players } from "./players";

const recorder = () => {
	const sent: string[] = [];
	const emitted: string[] = [];
	const reported: Bridge.Activity[] = [];
	const context = {
		variable: () => null,
		command: async (input: string) => {
			sent.push(input);

			return {
				sent: input,
				line: null,
				groups: {},
			};
		},
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
		sent,
		emitted,
		reported,
	};
};

const STEVE = {
	id: "Steve",
	name: "Steve",
};

describe("the player a kick or a ban is reported against", () => {
	it("a java name is carried as it is", () => {
		expect(playerPresence("Notch")).toEqual({
			platform: "java",
			player: "Notch",
			skin: "Notch",
		});
	});

	it("a bedrock name keeps its prefix in the line and drops it for the head", () => {
		expect(playerPresence(".Steve")).toEqual({
			platform: "bedrock",
			player: ".Steve",
			skin: "Steve",
		});
	});
});

describe("what the player actions report", () => {
	it("a kick keeps its event and also reports the player", async () => {
		const { context, emitted, reported } = recorder();

		await players.actions?.kick?.(context, STEVE, {});

		expect(emitted).toEqual([
			BridgeEventName.PlayerKicked,
		]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.PlayerKicked,
				text: {
					ar: "تم طرد Steve",
					en: "Kicked Steve",
				},
				subject: "Steve",
				details: playerPresence("Steve"),
			},
		]);
	});

	it("a ban keeps its event and also reports the player", async () => {
		const { context, emitted, reported } = recorder();

		await players.actions?.ban?.(context, STEVE, {});

		expect(emitted).toEqual([
			BridgeEventName.PlayerBanned,
		]);
		expect(
			reported.map((entry) => [
				entry.name,
				entry.subject,
			]),
		).toEqual([
			[
				BridgeEventName.PlayerBanned,
				"Steve",
			],
		]);
	});

	it("making a player an operator is reported as access granted", async () => {
		const { context, reported } = recorder();

		await players.actions?.op?.(context, STEVE, {});

		expect(reported.at(0)).toMatchObject({
			name: BridgeEventName.AccessGranted,
			subject: "Steve",
			details: {
				list: "operators",
				player: "Steve",
			},
		});
	});

	it("xp, game mode and kill each say what changed", async () => {
		const { context, reported } = recorder();

		await players.actions?.xp?.(context, STEVE, {
			amount: 5,
		});
		await players.actions?.gamemode?.(context, STEVE, {
			mode: "creative",
		});
		await players.actions?.kill?.(context, STEVE, {});

		expect(reported.map((entry) => entry.text)).toEqual([
			{
				ar: "تمت زيادة خبرة Steve 5 مستويات",
				en: "Gave Steve 5 levels of experience",
			},
			{
				ar: "تم تغيير وضع اللعب لـ Steve إلى الإبداع",
				en: "Set Steve's game mode to Creative",
			},
			{
				ar: "تم قتل Steve داخل اللعبة",
				en: "Killed Steve in game",
			},
		]);
		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.PlayerChanged,
			BridgeEventName.PlayerChanged,
			BridgeEventName.PlayerChanged,
		]);
		expect(reported.at(0)?.details).toMatchObject({
			change: "xp",
			amount: 5,
		});
		expect(reported.at(1)?.details).toMatchObject({
			change: "gamemode",
			mode: "creative",
		});
	});

	it("a refused argument runs nothing and reports nothing", async () => {
		const { context, sent, reported } = recorder();

		await expect(
			players.actions?.gamemode?.(context, STEVE, {
				mode: "god",
			}),
		).rejects.toThrow();
		expect(sent).toEqual([]);
		expect(reported).toEqual([]);
	});
});
