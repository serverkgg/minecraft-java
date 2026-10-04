import { describe, expect, it } from "bun:test";
import { ServerVariant, variantFrom } from "./variant";

describe("reading the server type the player picked", () => {
	it("every declared variant is taken as it is", () => {
		for (const variant of Object.values(ServerVariant)) {
			expect(variantFrom(variant)).toBe(variant);
		}
	});

	it("a server with no type is vanilla", () => {
		expect(variantFrom(null)).toBe(ServerVariant.Vanilla);
		expect(variantFrom("")).toBe(ServerVariant.Vanilla);
	});

	it("a type we do not know installs vanilla instead of failing the boot", () => {
		expect(variantFrom("spigot")).toBe(ServerVariant.Vanilla);
		expect(variantFrom("Paper")).toBe(ServerVariant.Vanilla);
	});
});
