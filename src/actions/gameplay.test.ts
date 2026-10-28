import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { byte, comp, type NBT, string, writeUncompressed } from "prismarine-nbt";
import { gameplay } from "./gameplay";

const hardcoreLevel = (hardcore: number) => {
	const level = comp(
		{
			Data: {
				type: "compound",
				value: {
					difficulty_settings: {
						type: "compound",
						value: {
							difficulty: string(hardcore === 1 ? "hard" : "easy"),
							hardcore: byte(hardcore),
							locked: byte(hardcore),
						},
					},
				},
			},
		},
		"",
	) as NBT;

	return Buffer.from(Bun.gzipSync(new Uint8Array(writeUncompressed(level, "big")))).toString("base64");
};

const recorder = (
	level: string | null = null,
	properties: () => Promise<Record<string, string>> = async () => ({}),
) => {
	const reported: Bridge.Activity[] = [];
	const sent: string[] = [];
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
		codec: {
			javaProperties: {
				read: properties,
			},
		},
		files: {
			exists: async (path: string) => level !== null && path === "world/level.dat",
		},
		exec: async () => ({
			code: 0,
			stdout: level ?? "",
			stderr: "",
		}),
		log: Object.assign(() => {}, {
			warn: () => {},
		}),
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		reported,
		sent,
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

describe("changing the difficulty on a hardcore world", () => {
	it("refuses before the command reaches the console and says how to turn hardcore off", async () => {
		const { context, reported, sent } = recorder(hardcoreLevel(1));

		await expect(
			gameplay.actions.difficulty?.(context, {
				mode: "easy",
			}),
		).rejects.toThrow(
			"Hardcore is on for this world, so the difficulty stays on Hard. To change it, stop the server, then turn hardcore off in the Worlds tab.",
		);
		expect(sent).toEqual([]);
		expect(reported).toEqual([]);
	});

	it("sends the command on a world that isn't hardcore", async () => {
		const { context, sent } = recorder(hardcoreLevel(0));

		await gameplay.actions.difficulty?.(context, {
			mode: "easy",
		});

		expect(sent).toEqual([
			"difficulty easy",
		]);
	});

	it("lets the command through when the world's flag can't be read", async () => {
		const unreadable = recorder(Buffer.from("not a level file").toString("base64"));
		const failing = recorder(hardcoreLevel(1), async () => {
			throw new Error("server.properties is unreadable");
		});

		await gameplay.actions.difficulty?.(unreadable.context, {
			mode: "normal",
		});
		await gameplay.actions.difficulty?.(failing.context, {
			mode: "normal",
		});

		expect(unreadable.sent).toEqual([
			"difficulty normal",
		]);
		expect(failing.sent).toEqual([
			"difficulty normal",
		]);
	});
});
