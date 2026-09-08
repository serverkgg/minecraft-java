import { describe, expect, test } from "bun:test";
import { playerPresence } from "./players";

describe("the player a kick or a ban is reported against", () => {
	test("a java name is carried as it is", () => {
		expect(playerPresence("Notch")).toEqual({
			platform: "java",
			player: "Notch",
			skin: "Notch",
		});
	});

	test("a bedrock name keeps its prefix in the line and drops it for the head", () => {
		expect(playerPresence(".Steve")).toEqual({
			platform: "bedrock",
			player: ".Steve",
			skin: "Steve",
		});
	});
});
