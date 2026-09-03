import { describe, expect, test } from "bun:test";
import { decodeModpackRef, encodeModpackRef } from "./modpackRef";

describe("the reference that names an exact modpack release", () => {
	test("a reference survives a round trip", () => {
		expect(decodeModpackRef(encodeModpackRef("curseforge", "1226037", "6620555"))).toEqual({
			provider: "curseforge",
			project: "1226037",
			versionId: "6620555",
		});
	});

	test("a modrinth reference keeps its slug and version id apart", () => {
		expect(decodeModpackRef("modrinth:better-mc:sedjuTAX")).toEqual({
			provider: "modrinth",
			project: "better-mc",
			versionId: "sedjuTAX",
		});
	});

	test("a reference with a missing part is refused", () => {
		expect(decodeModpackRef("modrinth:better-mc")).toBeNull();
		expect(decodeModpackRef("modrinth::sedjuTAX")).toBeNull();
		expect(decodeModpackRef(":better-mc:sedjuTAX")).toBeNull();
		expect(decodeModpackRef("modrinth:better-mc:")).toBeNull();
	});

	test("a reference carrying an extra part is refused rather than guessed at", () => {
		expect(decodeModpackRef("modrinth:better-mc:sedjuTAX:extra")).toBeNull();
	});

	test("an empty reference is refused", () => {
		expect(decodeModpackRef("")).toBeNull();
	});
});
