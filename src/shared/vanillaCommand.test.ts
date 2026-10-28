import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { vanillaCommand, vanillaCommandOf } from "./vanillaCommand";
import { ServerVariant } from "./variant";

const recorder = (serverType: string | null) => {
	const sent: string[] = [];
	const context = {
		variable: (key: string) => (key === "SERVER_TYPE" ? serverType : null),
		command: async (input: string) => {
			sent.push(input);

			return {
				sent: input,
				line: null,
				groups: {},
			};
		},
	} as unknown as Bridge.Context;

	return {
		context,
		sent,
	};
};

describe("sending a vanilla command", () => {
	it("a paper or purpur server gets the minecraft namespace, so a plugin's command of the same name is passed over", () => {
		expect(vanillaCommandOf(ServerVariant.Paper, "list")).toBe("minecraft:list");
		expect(vanillaCommandOf(ServerVariant.Purpur, "banlist players")).toBe("minecraft:banlist players");
	});

	it("a vanilla or modded server gets the plain command, which is the only form it knows", () => {
		for (const variant of [
			ServerVariant.Vanilla,
			ServerVariant.Fabric,
			ServerVariant.Forge,
			ServerVariant.NeoForge,
		]) {
			expect(vanillaCommandOf(variant, "list")).toBe("list");
		}
	});

	it("follows the server type the server was installed as", async () => {
		const paper = recorder("paper");
		const unset = recorder(null);

		await vanillaCommand(paper.context, "kick Steve");
		await vanillaCommand(unset.context, "kick Steve");

		expect(paper.sent).toEqual([
			"minecraft:kick Steve",
		]);
		expect(unset.sent).toEqual([
			"kick Steve",
		]);
	});
});
