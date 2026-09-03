import { describe, expect, test } from "bun:test";
import { decodeProviderRef, encodeProviderRef } from "./providerRef";

describe("the reference that names a project on a provider", () => {
	test("a reference survives a round trip", () => {
		expect(decodeProviderRef(encodeProviderRef("modrinth", "AANobbMI"))).toEqual({
			provider: "modrinth",
			project: "AANobbMI",
		});
	});

	test("only the first separator splits, so a project holding one stays whole", () => {
		expect(decodeProviderRef("curseforge:mc-mods:238222")).toEqual({
			provider: "curseforge",
			project: "mc-mods:238222",
		});
	});

	test("a reference with no provider, no project or no separator is refused", () => {
		expect(decodeProviderRef(":AANobbMI")).toBeNull();
		expect(decodeProviderRef("modrinth:")).toBeNull();
		expect(decodeProviderRef("modrinth")).toBeNull();
		expect(decodeProviderRef("")).toBeNull();
	});
});
