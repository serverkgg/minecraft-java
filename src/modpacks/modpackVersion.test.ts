import { describe, expect, test } from "bun:test";
import { pickModpackVersion } from "./modpackVersion";

describe("picking the minecraft version a modpack release runs on", () => {
	test("drops the family tag that sits beside the exact one", () => {
		expect(
			pickModpackVersion(
				[
					"1.20.1",
					"1.20",
				],
				null,
			),
		).toBe("1.20.1");
	});

	test("drops the family tag whichever order the source lists it in", () => {
		expect(
			pickModpackVersion(
				[
					"1.20",
					"1.20.1",
				],
				null,
			),
		).toBe("1.20.1");
	});

	test("keeps a single tag as it is", () => {
		expect(
			pickModpackVersion(
				[
					"1.21.4",
				],
				null,
			),
		).toBe("1.21.4");
	});

	test("keeps the version the server is already pinned to when the release carries it", () => {
		expect(
			pickModpackVersion(
				[
					"1.20.1",
					"1.20.2",
				],
				"1.20.1",
			),
		).toBe("1.20.1");
	});

	test("takes the newest tag when the pinned version is not one of them", () => {
		expect(
			pickModpackVersion(
				[
					"1.20.1",
					"1.20.2",
				],
				"26.3",
			),
		).toBe("1.20.2");
	});

	test("ignores snapshot ids that are not release versions", () => {
		expect(
			pickModpackVersion(
				[
					"1.20.1",
					"23w31a",
				],
				null,
			),
		).toBe("1.20.1");
	});

	test("drops a bare major tag beside a full one", () => {
		expect(
			pickModpackVersion(
				[
					"26",
					"26.3",
				],
				null,
			),
		).toBe("26.3");
	});

	test("survives a source that lists the same tag twice", () => {
		expect(
			pickModpackVersion(
				[
					"1.20.1",
					"1.20.1",
				],
				null,
			),
		).toBe("1.20.1");
	});

	test("ignores a pinned version that is only the family tag, so a server stuck on it recovers", () => {
		expect(
			pickModpackVersion(
				[
					"1.20.1",
					"1.20",
				],
				"1.20",
			),
		).toBe("1.20.1");
	});

	test("treats a zero patch as the exact tag beside its family", () => {
		expect(
			pickModpackVersion(
				[
					"1.20",
					"1.20.0",
				],
				null,
			),
		).toBe("1.20.0");
	});

	test("returns nothing when the release names no release version", () => {
		expect(pickModpackVersion([], null)).toBeNull();
		expect(
			pickModpackVersion(
				[
					"23w31a",
				],
				null,
			),
		).toBeNull();
	});
});
