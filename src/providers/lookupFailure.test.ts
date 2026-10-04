import { describe, expect, it } from "bun:test";
import {
	BridgeFailureCode,
	BridgeFailureError,
	BridgeNetError,
	BridgeSecretError,
	BridgeUserError,
} from "@serverkgg/bridge";
import { explainLookup, LookupFailure, lookupFailureOf } from "./lookupFailure";

const MISSING = {
	ar: "ما لقيناه",
	en: "Not found",
};

const SUBJECT = {
	ar: "المود",
	en: "the mod",
};

const refusalOf = async (run: Promise<unknown>) => {
	try {
		await run;
	} catch (error) {
		return error;
	}

	return null;
};

describe("classifying a failed catalog lookup", () => {
	it("404 and 410 mean the thing is gone", () => {
		expect(lookupFailureOf(new BridgeNetError(404, "answered 404"))).toBe(LookupFailure.Missing);
		expect(lookupFailureOf(new BridgeNetError(410, "answered 410"))).toBe(LookupFailure.Missing);
	});

	it("401, 403 and a rejected key mean the source refused us", () => {
		expect(lookupFailureOf(new BridgeNetError(401, "answered 401"))).toBe(LookupFailure.Refused);
		expect(lookupFailureOf(new BridgeNetError(403, "answered 403"))).toBe(LookupFailure.Refused);
		expect(lookupFailureOf(new BridgeSecretError("CURSEFORGE_API_KEY", "rejected"))).toBe(LookupFailure.Refused);
	});

	it("a 5xx or no answer at all is never read as not found", () => {
		expect(lookupFailureOf(new BridgeNetError(500, "answered 500"))).toBe(LookupFailure.Unreachable);
		expect(lookupFailureOf(new BridgeNetError(502, "answered 502"))).toBe(LookupFailure.Unreachable);
		expect(lookupFailureOf(new BridgeNetError(null, "connection refused"))).toBe(LookupFailure.Unreachable);
	});

	it("a rate limit and anything else are left alone", () => {
		expect(lookupFailureOf(new BridgeFailureError(BridgeFailureCode.CatalogRateLimited, "slow down"))).toBeNull();
		expect(lookupFailureOf(new Error("boom"))).toBeNull();
		expect(lookupFailureOf(new BridgeNetError(400, "answered 400"))).toBeNull();
	});
});

describe("explaining a failed lookup to the customer", () => {
	it("not found becomes the caller's text and keeps the original for staff", async () => {
		const original = new BridgeNetError(404, "api.modrinth.com answered 404");
		const error = await refusalOf(explainLookup(() => Promise.reject(original), MISSING, SUBJECT));

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text).toEqual(MISSING);
		expect((error as BridgeUserError).cause).toBe(original);
	});

	it("an unreachable source says so in the download-failure words", async () => {
		const error = await refusalOf(
			explainLookup(() => Promise.reject(new BridgeNetError(null, "connection refused")), MISSING, SUBJECT),
		);

		expect((error as BridgeUserError).text).toEqual({
			ar: "تعذّر الوصول إلى المصدر لتنزيل المود، جرب مرة ثانية.",
			en: "We couldn't reach the source to download the mod. Try again.",
		});
	});

	it("a missing key stays a secret error so the platform can flag it", async () => {
		const original = new BridgeSecretError("CURSEFORGE_API_KEY", "no key");

		expect(await refusalOf(explainLookup(() => Promise.reject(original), MISSING, SUBJECT))).toBe(original);
	});

	it("a rate limit passes through unchanged", async () => {
		const original = new BridgeFailureError(BridgeFailureCode.CatalogRateLimited, "slow down");

		expect(await refusalOf(explainLookup(() => Promise.reject(original), MISSING, SUBJECT))).toBe(original);
	});
});
