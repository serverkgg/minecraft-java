import { describe, expect, it } from "bun:test";
import { ADDON_SIDECAR, parseSidecar, type SidecarEntry, sidecarPath } from "./addonSidecar";

const entry: SidecarEntry = {
	provider: "modrinth",
	project: "AANobbMI",
	version: "sedjuTAX",
	title: "Sodium",
	gameVersion: "1.21.11",
	icon: null,
	pageUrl: "https://modrinth.com/mod/sodium",
};

describe("where the catalog record of a directory lives", () => {
	it("the sidecar sits inside the directory it describes", () => {
		expect(sidecarPath("mods")).toBe(`mods/${ADDON_SIDECAR}`);
		expect(sidecarPath("plugins")).toBe(`plugins/${ADDON_SIDECAR}`);
	});
});

describe("reading the record of what the catalog installed", () => {
	it("a complete sidecar is read back whole", () => {
		const written = {
			"sodium.jar": entry,
		};

		expect(parseSidecar(JSON.stringify(written))).toEqual(written);
	});

	it("a file holding anything but an object reads as empty", () => {
		expect(parseSidecar("[]")).toEqual({});
		expect(parseSidecar("null")).toEqual({});
		expect(parseSidecar('"sodium"')).toEqual({});
	});

	it("a truncated or empty file reads as empty instead of throwing", () => {
		expect(parseSidecar("")).toEqual({});
		expect(parseSidecar('{"sodium.jar":')).toEqual({});
	});
});
