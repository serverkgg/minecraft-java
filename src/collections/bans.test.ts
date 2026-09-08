import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { bans } from "./bans";

const HEADER = "[00:08:49 INFO]: There are 1 ban(s):";

const ENTRY = "[00:08:49 INFO]: ServerkBot was banned by Server: Banned by an operator.";

const REPLY = [
	"[12:06:41] [Server thread/INFO]: There are 2 ban(s):",
	"[12:06:41] [Server thread/INFO]: Steve was banned by Server: Banned by an operator.",
	"[12:06:41] [Server thread/INFO]: Alex was banned by Notch: griefing the spawn twice",
];

const contextWith = (options: { count?: string; printed?: string[][]; sent?: string[] }) => {
	const printed = options.printed ?? [];

	let read = 0;

	return {
		command: async (input: string) => {
			options.sent?.push(input);

			return {
				sent: input,
				line: null,
				groups:
					options.count === undefined
						? {}
						: {
								count: options.count,
							},
			};
		},
		logs: {
			tail: async () => {
				const answer = printed.at(Math.min(read, printed.length - 1)) ?? [];

				read += 1;

				return answer;
			},
		},
	} as unknown as Bridge.Context;
};

describe("reading who is banned from the server", () => {
	test("a server with no bans asks the console once and lists nothing", async () => {
		const sent: string[] = [];

		expect(
			await bans.list(
				contextWith({
					sent,
				}),
			),
		).toEqual([]);
		expect(sent).toEqual([
			"banlist players",
		]);
	});

	test("each ban becomes a row keyed by the player name", async () => {
		expect(
			await bans.list(
				contextWith({
					count: "2",
					printed: [
						REPLY,
					],
				}),
			),
		).toEqual([
			{
				id: "Steve",
				name: "Steve",
				source: "Server",
				reason: "Banned by an operator.",
			},
			{
				id: "Alex",
				name: "Alex",
				source: "Notch",
				reason: "griefing the spawn twice",
			},
		]);
	});

	test("an entry the server writes after the header is waited for instead of being missed", async () => {
		expect(
			await bans.list(
				contextWith({
					count: "1",
					printed: [
						[
							HEADER,
						],
						[
							HEADER,
							ENTRY,
						],
					],
				}),
			),
		).toEqual([
			{
				id: "ServerkBot",
				name: "ServerkBot",
				source: "Server",
				reason: "Banned by an operator.",
			},
		]);
	});

	test("an entry that never arrives lists what the console did print instead of hanging", async () => {
		expect(
			await bans.list(
				contextWith({
					count: "1",
					printed: [
						[
							HEADER,
						],
					],
				}),
			),
		).toEqual([]);
	});
});

describe("lifting a ban", () => {
	test("pardons the player by name", async () => {
		const sent: string[] = [];

		await bans.actions?.remove?.(
			contextWith({
				sent,
			}),
			{
				id: "Steve",
				name: "Steve",
			},
			{},
		);

		expect(sent).toEqual([
			"pardon Steve",
		]);
	});
});
