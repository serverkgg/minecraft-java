import { describe, expect, it } from "bun:test";
import { choiceArgument, DIFFICULTIES, GAME_MODES, levelsArgument, XP_MAX_LEVELS, XP_MIN_LEVELS } from "./gameplay";

describe("reading a choice out of an action's arguments", () => {
	it("a declared choice comes back as it is", () => {
		expect(
			choiceArgument(
				{
					mode: "creative",
				},
				"mode",
				GAME_MODES,
			),
		).toBe("creative");
	});

	it("every declared difficulty and game mode is accepted", () => {
		for (const difficulty of DIFFICULTIES) {
			expect(
				choiceArgument(
					{
						difficulty,
					},
					"difficulty",
					DIFFICULTIES,
				),
			).toBe(difficulty);
		}
	});

	it("a value outside the list is refused", () => {
		expect(() =>
			choiceArgument(
				{
					mode: "hardcore",
				},
				"mode",
				GAME_MODES,
			),
		).toThrow();
	});

	it("a missing argument is refused", () => {
		expect(() => choiceArgument({}, "mode", GAME_MODES)).toThrow();
	});
});

describe("reading an experience amount out of an action's arguments", () => {
	it("a whole number inside the range is taken", () => {
		expect(
			levelsArgument({
				amount: 30,
			}),
		).toBe(30);
	});

	it("both ends of the range are allowed", () => {
		expect(
			levelsArgument({
				amount: XP_MIN_LEVELS,
			}),
		).toBe(XP_MIN_LEVELS);
		expect(
			levelsArgument({
				amount: XP_MAX_LEVELS,
			}),
		).toBe(XP_MAX_LEVELS);
	});

	it("anything outside the range is refused", () => {
		expect(() =>
			levelsArgument({
				amount: XP_MIN_LEVELS - 1,
			}),
		).toThrow();
		expect(() =>
			levelsArgument({
				amount: XP_MAX_LEVELS + 1,
			}),
		).toThrow();
	});

	it("a fraction, a missing amount and text are all refused", () => {
		expect(() =>
			levelsArgument({
				amount: 1.5,
			}),
		).toThrow();
		expect(() => levelsArgument({})).toThrow();
		expect(() =>
			levelsArgument({
				amount: "ten",
			}),
		).toThrow();
	});

	it("a whole number written as text is read as a number", () => {
		expect(
			levelsArgument({
				amount: "30",
			}),
		).toBe(30);
	});
});
