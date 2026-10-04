import { describe, expect, it } from "bun:test";
import {
	compareVersionDesc,
	isStable,
	mavenVersions,
	neoForgeBuildPrefix,
	neoForgePrefix,
	pinnedChoice,
	toOptions,
} from "./minecraftMeta";

describe("telling a finished release from a test build", () => {
	it("a plain release is stable", () => {
		expect(isStable("1.21.11")).toBe(true);
		expect(isStable("26.1")).toBe(true);
	});

	it("release candidates, pre-releases and snapshots are not", () => {
		expect(isStable("1.21.11-rc1")).toBe(false);
		expect(isStable("1.21.11-pre2")).toBe(false);
		expect(isStable("1.21.11-SNAPSHOT")).toBe(false);
	});
});

describe("ordering versions newest first", () => {
	it("a higher segment sorts ahead of a lower one", () => {
		expect(compareVersionDesc("1.21.11", "1.21.9")).toBeLessThan(0);
		expect(compareVersionDesc("1.21.9", "1.21.11")).toBeGreaterThan(0);
	});

	it("the same version ties", () => {
		expect(compareVersionDesc("1.21.11", "1.21.11")).toBe(0);
	});

	it("a missing segment counts as zero, so 1.21 sits behind 1.21.1", () => {
		expect(compareVersionDesc("1.21.1", "1.21")).toBeLessThan(0);
		expect(compareVersionDesc("1.21", "1.21.0")).toBe(0);
	});

	it("sorting a list puts the newest release first", () => {
		expect(
			[
				"1.21.9",
				"1.21.11",
				"1.20.4",
				"1.21.10",
			].sort(compareVersionDesc),
		).toEqual([
			"1.21.11",
			"1.21.10",
			"1.21.9",
			"1.20.4",
		]);
	});
});

describe("turning a version list into select options", () => {
	it("each value becomes its own label in both languages", () => {
		expect(
			toOptions([
				"1.21.11",
			]),
		).toEqual([
			{
				value: "1.21.11",
				label: {
					ar: "1.21.11",
					en: "1.21.11",
				},
			},
		]);
	});

	it("nothing is marked latest unless the caller asks for it", () => {
		const options = toOptions([
			"1.21.11",
			"1.21.10",
		]);

		expect(options.every((option) => option.latest === undefined)).toBe(true);
	});

	it("only the first option is marked latest when asked", () => {
		const options = toOptions(
			[
				"1.21.11",
				"1.21.10",
			],
			true,
		);

		expect(options.at(0)?.latest).toBe(true);
		expect(options.at(1)?.latest).toBeUndefined();
	});

	it("an empty list stays empty", () => {
		expect(toOptions([], true)).toEqual([]);
	});
});

describe("reading versions out of a maven metadata document", () => {
	it("every version tag is collected in document order", () => {
		expect(
			mavenVersions(
				"<metadata><versioning><versions><version>1.21.1-52.0.1</version><version>1.21.1-52.0.2</version></versions></versioning></metadata>",
			),
		).toEqual([
			"1.21.1-52.0.1",
			"1.21.1-52.0.2",
		]);
	});

	it("a document with no versions yields nothing rather than throwing", () => {
		expect(mavenVersions("<metadata></metadata>")).toEqual([]);
		expect(mavenVersions("")).toEqual([]);
	});
});

describe("matching a neoforge build to a game version", () => {
	it("a legacy 1.x version drops the leading one and takes two segments", () => {
		expect(neoForgePrefix("1.21.1")).toBe("21.1.");
		expect(neoForgePrefix("1.20.4")).toBe("20.4.");
	});

	it("a legacy version with no patch is padded with a zero", () => {
		expect(neoForgePrefix("1.21")).toBe("21.0.");
	});

	it("a modern version keeps three segments", () => {
		expect(neoForgePrefix("26.1.2")).toBe("26.1.2.");
		expect(neoForgePrefix("26.1")).toBe("26.1.0.");
	});

	it("a three-segment build is matched on its first two segments", () => {
		expect(neoForgeBuildPrefix("21.1.176")).toBe("21.1.");
	});

	it("a four-segment build is matched on its first three", () => {
		expect(neoForgeBuildPrefix("26.1.0.12")).toBe("26.1.0.");
	});
});

describe("deciding whether the player pinned a choice or left it to us", () => {
	it("an explicit value is the pin", () => {
		expect(pinnedChoice("1.21.11")).toBe("1.21.11");
		expect(pinnedChoice("21.1.176")).toBe("21.1.176");
	});

	it("latest, blank and unset all mean we choose", () => {
		expect(pinnedChoice("latest")).toBeNull();
		expect(pinnedChoice("")).toBeNull();
		expect(pinnedChoice(null)).toBeNull();
	});
});
