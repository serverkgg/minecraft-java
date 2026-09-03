import { describe, expect, test } from "bun:test";
import { createRequestPacer } from "./requestPacer";

describe("pacing the requests an install sends", () => {
	test("lets a burst through while the window has room", async () => {
		const pacer = createRequestPacer(4, 60_000);
		const started = Date.now();

		for (let count = 0; count < 4; count += 1) {
			await pacer.acquire();
		}

		expect(Date.now() - started).toBeLessThan(50);
	});

	test("holds the request that would go over the budget until the window rolls", async () => {
		const pacer = createRequestPacer(2, 120);
		const started = Date.now();

		await pacer.acquire();
		await pacer.acquire();
		await pacer.acquire();

		expect(Date.now() - started).toBeGreaterThanOrEqual(100);
	});

	test("shares one budget across everything downloading at once", async () => {
		const pacer = createRequestPacer(3, 120);
		const started = Date.now();

		await Promise.all(
			Array.from(
				{
					length: 6,
				},
				async () => {
					await pacer.acquire();
				},
			),
		);

		expect(Date.now() - started).toBeGreaterThanOrEqual(100);
	});

	test("keeps letting requests through once the window has rolled past", async () => {
		const pacer = createRequestPacer(1, 60);

		await pacer.acquire();
		await pacer.acquire();

		const started = Date.now();

		await new Promise((resolve) => {
			setTimeout(resolve, 80);
		});
		await pacer.acquire();

		expect(Date.now() - started).toBeLessThan(160);
	});
});
