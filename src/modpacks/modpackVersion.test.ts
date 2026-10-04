import { describe, expect, it } from "bun:test";
import { pickModpackVersion } from "./modpackVersion";

describe("picking the minecraft version a modpack release runs on", () => {
	it("drops the family tag that sits beside the exact one", () => {
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

	it("drops the family tag whichever order the source lists it in", () => {
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

	it("keeps a single tag as it is", () => {
		expect(
			pickModpackVersion(
				[
					"1.21.4",
				],
				null,
			),
		).toBe("1.21.4");
	});

	it("keeps the version the server is already pinned to when the release carries it", () => {
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

	it("takes the newest tag when the pinned version is not one of them", () => {
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

	it("ignores snapshot ids that are not release versions", () => {
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

	it("drops a bare major tag beside a full one", () => {
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

	it("survives a source that lists the same tag twice", () => {
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

	it("ignores a pinned version that is only the family tag, so a server stuck on it recovers", () => {
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

	it("treats a zero patch as the exact tag beside its family", () => {
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

	it("returns nothing when the release names no release version", () => {
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
