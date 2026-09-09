import { describe, expect, test } from "bun:test";
import { BridgeLayout, BridgePlace } from "@serverkgg/bridge";
import type { BridgeSection } from "@serverkgg/bridge/protocol";
import { panel } from "./panel";

const placeOf = (section: BridgeSection | null | undefined) => {
	return section && "place" in section ? section.place : undefined;
};

const sections = panel.tabs.flatMap((tab) => tab.sections);

const tabNamed = (id: string) => {
	return panel.tabs.find((tab) => tab.id === id) ?? null;
};

const sectionNamed = (id: string) => {
	return sections.find((section) => section.id === id) ?? null;
};

const tableNamed = (id: string) => {
	const section = sectionNamed(id);

	return section?.layout === BridgeLayout.Table ? section : null;
};

const formNamed = (id: string) => {
	const section = sectionNamed(id);

	return section?.layout === BridgeLayout.Form ? section : null;
};

const rowActionNamed = (tableId: string, actionId: string) => {
	return tableNamed(tableId)?.actions?.find((action) => action.id === actionId) ?? null;
};

const PLAYERS_SECTION_IDS = [
	"players",
	"whitelist",
	"bans",
];

const HELPED_FORM_IDS = [
	"version",
	"crossplay",
	"version-compat",
	"settings",
];

const PLACE_LAYOUTS: Record<BridgePlace, BridgeLayout[]> = {
	[BridgePlace.Overview]: [
		BridgeLayout.Actions,
		BridgeLayout.Detail,
	],
	[BridgePlace.Players]: [
		BridgeLayout.Actions,
		BridgeLayout.Cards,
		BridgeLayout.Table,
	],
};

describe("laying out the minecraft panel", () => {
	test("gives every tab a unique id", () => {
		const ids = panel.tabs.map((tab) => tab.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	test("gives every section a unique id", () => {
		const ids = sections.map((section) => section.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	test("titles every tab in both arabic and english", () => {
		for (const tab of panel.tabs) {
			expect(tab.title.ar.length).toBeGreaterThan(0);
			expect(tab.title.en.length).toBeGreaterThan(0);
		}
	});

	test("writes every help line in both arabic and english", () => {
		for (const section of sections) {
			if (section.help === undefined) {
				continue;
			}

			expect(section.help.ar.length).toBeGreaterThan(0);
			expect(section.help.en.length).toBeGreaterThan(0);
		}
	});
});

describe("saying what each form is for before the owner reads its fields", () => {
	test("explains the version, crossplay, version compatibility and settings forms", () => {
		for (const id of HELPED_FORM_IDS) {
			expect(formNamed(id)?.help?.ar.length).toBeGreaterThan(0);
			expect(formNamed(id)?.help?.en.length).toBeGreaterThan(0);
		}
	});

	test("names server.properties in the settings help, which is the file it writes", () => {
		expect(formNamed("settings")?.help?.ar).toContain("server.properties");
		expect(formNamed("settings")?.help?.en).toContain("server.properties");
	});
});

describe("handing the roster to the platform's players page", () => {
	test("calls the tab the players by the name the panel uses everywhere", () => {
		expect(tabNamed("players")?.title).toEqual({
			ar: "اللاعبين",
			en: "Players",
		});
	});

	test("places the roster, the whitelist and the ban list on the players page", () => {
		expect(tabNamed("players")?.sections.map((section) => section.id)).toEqual(PLAYERS_SECTION_IDS);

		for (const id of PLAYERS_SECTION_IDS) {
			expect(placeOf(sectionNamed(id))).toBe(BridgePlace.Players);
		}
	});

	test("places every one of them, so the tab leaves the sidebar entirely", () => {
		expect(tabNamed("players")?.sections.every((section) => placeOf(section) !== undefined)).toBe(true);
	});

	test("keeps the tab declared, because the crossplay guide opens it", async () => {
		for (const locale of [
			"ar",
			"en",
		]) {
			const guide = await Bun.file(new URL(`../../guides/crossplay/${locale}.md`, import.meta.url)).text();

			expect(guide).toContain("@[open](panel:players)");
		}

		expect(tabNamed("players")).not.toBeNull();
	});

	test("puts a place only on a layout the page it names can render", () => {
		for (const section of sections) {
			const place = placeOf(section);

			if (place === undefined) {
				continue;
			}

			expect(PLACE_LAYOUTS[place]).toContain(section.layout);
		}
	});
});

describe("moderating a player who already left", () => {
	test("marks the ban as the one roster action that reaches an offline player", () => {
		expect(rowActionNamed("players", "ban")?.offline).toBe(true);
	});

	test("leaves every other roster action to players who are actually connected", () => {
		const offline = (tableNamed("players")?.actions ?? []).filter((action) => action.offline === true);

		expect(offline.map((action) => action.id)).toEqual([
			"ban",
		]);
	});

	test("never marks a row action offline outside the roster, where it means nothing", () => {
		for (const id of [
			"whitelist",
			"bans",
		]) {
			for (const action of tableNamed(id)?.actions ?? []) {
				expect(action.offline).toBeUndefined();
			}
		}
	});
});
