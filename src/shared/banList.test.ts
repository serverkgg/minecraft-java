import { describe, expect, test } from "bun:test";
import { parseBanList } from "./banList";

const NO_BANS = [
	"[12:04:11] [Server thread/INFO]: There are no bans",
].join("\n");

const ONE_BAN = [
	"[12:05:02] [Server thread/INFO]: There are 1 ban(s):",
	"[12:05:02] [Server thread/INFO]: Steve was banned by Server: Banned by an operator.",
].join("\n");

const THREE_BANS = [
	"[12:06:41] [Server thread/INFO]: There are 3 ban(s):",
	"[12:06:41] [Server thread/INFO]: Steve was banned by Server: Banned by an operator.",
	"[12:06:41] [Server thread/INFO]: Alex was banned by Notch: griefing the spawn twice",
	"[12:06:41] [Server thread/INFO]: .Gamer Tag was banned by Server: (Unknown)",
].join("\n");

const LEGACY_BANS = [
	"[12:07:10] [Server thread/INFO]: There are 1 bans:",
	"[12:07:10] [Server thread/INFO]: Herobrine was banned by Server: Banned by an operator.",
].join("\n");

const AFTER_OLDER_REPLY = [
	"[12:08:00] [Server thread/INFO]: There are 2 ban(s):",
	"[12:08:00] [Server thread/INFO]: Steve was banned by Server: Banned by an operator.",
	"[12:08:00] [Server thread/INFO]: Alex was banned by Server: Banned by an operator.",
	"[12:09:31] [Server thread/INFO]: Alex was unbanned",
	"[12:09:40] [Server thread/INFO]: There are 1 ban(s):",
	"[12:09:40] [Server thread/INFO]: Steve was banned by Server: Banned by an operator.",
].join("\n");

describe("reading the ban list the server prints", () => {
	test("a server with nobody banned lists nothing", () => {
		expect(parseBanList(NO_BANS)).toEqual([]);
	});

	test("a single ban carries the player, who banned them and why", () => {
		expect(parseBanList(ONE_BAN)).toEqual([
			{
				name: "Steve",
				source: "Server",
				reason: "Banned by an operator.",
			},
		]);
	});

	test("several bans keep their order, a reason with spaces, and a bedrock name with spaces", () => {
		expect(parseBanList(THREE_BANS)).toEqual([
			{
				name: "Steve",
				source: "Server",
				reason: "Banned by an operator.",
			},
			{
				name: "Alex",
				source: "Notch",
				reason: "griefing the spawn twice",
			},
			{
				name: ".Gamer Tag",
				source: "Server",
				reason: "(Unknown)",
			},
		]);
	});

	test("an older server that writes bans without the plural marker still reads", () => {
		expect(parseBanList(LEGACY_BANS)).toEqual([
			{
				name: "Herobrine",
				source: "Server",
				reason: "Banned by an operator.",
			},
		]);
	});

	test("only the newest reply in the console is read, so an earlier one leaves no ghosts", () => {
		expect(parseBanList(AFTER_OLDER_REPLY)).toEqual([
			{
				name: "Steve",
				source: "Server",
				reason: "Banned by an operator.",
			},
		]);
	});

	test("console lines that hold no reply at all list nothing", () => {
		expect(parseBanList("")).toEqual([]);
		expect(parseBanList("[12:10:00] [Server thread/INFO]: Steve joined the game")).toEqual([]);
	});
});
