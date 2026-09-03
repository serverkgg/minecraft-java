import { describe, expect, test } from "bun:test";
import { type CompanionRecord, parseCompanionSidecar } from "./companionSidecar";

const record = (overrides: Partial<CompanionRecord> = {}): CompanionRecord => ({
	jar: "plugins/Geyser-Spigot.jar",
	gameVersion: "1.21.11",
	source: "geyser",
	version: "2.9.1",
	...overrides,
});

describe("reading the record of the companions we installed", () => {
	test("a complete sidecar is read back whole", () => {
		const written = {
			entries: {
				geyser: record(),
				floodgate: record({
					jar: "plugins/floodgate-spigot.jar",
					source: "floodgate",
				}),
			},
		};

		expect(parseCompanionSidecar(JSON.stringify(written))).toEqual(written);
	});

	test("an entry missing a field is dropped, so we reinstall that companion instead of trusting it", () => {
		expect(
			parseCompanionSidecar(
				JSON.stringify({
					entries: {
						geyser: record(),
						floodgate: {
							jar: "plugins/floodgate-spigot.jar",
							source: "floodgate",
						},
					},
				}),
			),
		).toEqual({
			entries: {
				geyser: record(),
			},
		});
	});

	test("an entry whose version is not text is dropped", () => {
		expect(
			parseCompanionSidecar(
				JSON.stringify({
					entries: {
						geyser: {
							...record(),
							version: 2,
						},
					},
				}),
			).entries,
		).toEqual({});
	});

	test("a sidecar with no entries, or entries of the wrong shape, reads as empty", () => {
		expect(parseCompanionSidecar("{}").entries).toEqual({});
		expect(parseCompanionSidecar('{"entries":[]}').entries).toEqual({});
		expect(parseCompanionSidecar('{"entries":null}').entries).toEqual({});
	});

	test("a truncated or empty file reads as empty instead of throwing", () => {
		expect(parseCompanionSidecar("").entries).toEqual({});
		expect(parseCompanionSidecar('{"entries":{').entries).toEqual({});
	});
});
