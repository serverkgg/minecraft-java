import { describe, expect, test } from "bun:test";
import { ServerVariant, variantFrom } from "./variant";

describe("reading the server type the player picked", () => {
	test("every declared variant is taken as it is", () => {
		for (const variant of Object.values(ServerVariant)) {
			expect(variantFrom(variant)).toBe(variant);
		}
	});

	test("a server with no type is vanilla", () => {
		expect(variantFrom(null)).toBe(ServerVariant.Vanilla);
		expect(variantFrom("")).toBe(ServerVariant.Vanilla);
	});

	test("a type we do not know installs vanilla instead of failing the boot", () => {
		expect(variantFrom("spigot")).toBe(ServerVariant.Vanilla);
		expect(variantFrom("Paper")).toBe(ServerVariant.Vanilla);
	});
});
