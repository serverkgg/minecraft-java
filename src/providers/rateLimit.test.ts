import { describe, expect, test } from "bun:test";
import { BridgeFailureCode, BridgeFailureError, BridgeNetError } from "@serverkgg/bridge";
import { asRateLimit } from "./rateLimit";

describe("turning a provider's refusal into something the panel can say", () => {
	test("a throttled response becomes a rate limit failure naming the provider", () => {
		const failure = asRateLimit(new BridgeNetError(429, "too many requests"), "Modrinth");

		expect(failure).toBeInstanceOf(BridgeFailureError);
		expect((failure as BridgeFailureError).code).toBe(BridgeFailureCode.CatalogRateLimited);
		expect((failure as BridgeFailureError).message).toContain("Modrinth");
	});

	test("an overloaded provider is treated the same way", () => {
		expect(asRateLimit(new BridgeNetError(503, "unavailable"), "CurseForge")).toBeInstanceOf(BridgeFailureError);
	});

	test("any other status is passed through untouched, so the real error is not hidden", () => {
		const error = new BridgeNetError(404, "not found");

		expect(asRateLimit(error, "Modrinth")).toBe(error);
	});

	test("a network error with no status is passed through untouched", () => {
		const error = new BridgeNetError(null, "connection refused");

		expect(asRateLimit(error, "Modrinth")).toBe(error);
	});

	test("an error that did not come from the network is passed through untouched", () => {
		const error = new Error("the pack has no server file");

		expect(asRateLimit(error, "CurseForge")).toBe(error);
	});
});
