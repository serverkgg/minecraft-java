import { describe, expect, test } from "bun:test";
import { mapConcurrent } from "./mapConcurrent";

const settle = () => {
	return new Promise((resolve) => {
		setTimeout(resolve, 1);
	});
};

describe("running work a few items at a time", () => {
	test("runs every item exactly once", async () => {
		const seen: number[] = [];

		await mapConcurrent(
			[
				1,
				2,
				3,
				4,
				5,
				6,
				7,
			],
			3,
			async (item) => {
				await settle();

				seen.push(item);
			},
		);

		expect(seen.sort((a, b) => a - b)).toEqual([
			1,
			2,
			3,
			4,
			5,
			6,
			7,
		]);
	});

	test("never runs more than the width at once", async () => {
		let running = 0;
		let peak = 0;

		await mapConcurrent(
			Array.from(
				{
					length: 20,
				},
				(_, index) => index,
			),
			4,
			async () => {
				running += 1;
				peak = Math.max(peak, running);

				await settle();

				running -= 1;
			},
		);

		expect(peak).toBe(4);
	});

	test("does nothing when there is nothing to do", async () => {
		let calls = 0;

		await mapConcurrent([], 4, async () => {
			calls += 1;
		});

		expect(calls).toBe(0);
	});

	test("still works when the width is wider than the list, or nonsense", async () => {
		const seen: number[] = [];

		await mapConcurrent(
			[
				1,
				2,
			],
			99,
			async (item) => {
				seen.push(item);
			},
		);
		await mapConcurrent(
			[
				3,
			],
			0,
			async (item) => {
				seen.push(item);
			},
		);

		expect(seen.sort((a, b) => a - b)).toEqual([
			1,
			2,
			3,
		]);
	});

	test("lets a failure surface instead of swallowing it", async () => {
		expect(
			mapConcurrent(
				[
					1,
					2,
					3,
				],
				2,
				async (item) => {
					if (item === 2) {
						throw new Error("nope");
					}
				},
			),
		).rejects.toThrow("nope");
	});
});
