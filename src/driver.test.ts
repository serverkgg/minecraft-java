import { describe, expect, test } from "bun:test";
import { BridgeLayout, BridgeSetupStepKind } from "@serverkgg/bridge";
import { GuideOpenTab } from "@serverkgg/bridge/guides";
import { RCON_ACCESS_MODULE, RCON_ACCESS_VARIABLE } from "@serverkgg/bridge/rcon";
import { driver } from "./driver";

const modules = driver.modules ?? {};

const tabs = driver.panel?.tabs ?? [];

const sections = tabs.flatMap((tab) => tab.sections);

const steps = driver.setup?.steps ?? [];

const formSection = (tabId: string, sectionId: string) => {
	const tab = tabs.find((entry) => entry.id === tabId);
	const section = tab?.sections.find((entry) => entry.id === sectionId);

	return section?.layout === BridgeLayout.Form ? section : null;
};

describe("walking the customer through the first run", () => {
	test("puts the version ahead of the name, because changing it reinstalls", () => {
		expect(steps.map((step) => step.id)).toEqual([
			"version",
			"name",
			"invite",
		]);
	});

	test("blocks nothing, because a fresh minecraft server already runs", () => {
		expect(steps.filter((step) => step.required !== false)).toEqual([]);
	});

	test("needs no driver step, so the setup declares no submit", () => {
		expect(steps.filter((step) => step.kind === BridgeSetupStepKind.Driver)).toEqual([]);
		expect(driver.setup?.submit).toBeUndefined();
	});

	test("points every form step at a form section the panel really declares", () => {
		for (const step of steps) {
			if (step.kind !== BridgeSetupStepKind.Form) {
				continue;
			}

			expect(formSection(step.tab, step.section)).not.toBeNull();
		}
	});

	test("names only fields that section really carries", () => {
		for (const step of steps) {
			if (step.kind !== BridgeSetupStepKind.Form) {
				continue;
			}

			const keys = (formSection(step.tab, step.section)?.fields ?? []).map((field) => field.key);

			for (const key of step.fields ?? []) {
				expect(keys).toContain(key);
			}
		}
	});

	test("hands the whole version section over rather than a subset of it", () => {
		const version = steps.find((step) => step.id === "version");

		expect(version?.kind === BridgeSetupStepKind.Form && version.fields).toBeUndefined();
	});

	test("sends the invite step to the access page, where the address lives", () => {
		const invite = steps.find((step) => step.id === "invite");

		expect(invite?.kind === BridgeSetupStepKind.Open && invite.target.tab).toBe(GuideOpenTab.Access);
	});

	test("titles and explains every step in both arabic and english", () => {
		for (const step of steps) {
			expect(step.title.ar.length).toBeGreaterThan(0);
			expect(step.title.en.length).toBeGreaterThan(0);
			expect(step.help?.ar.length).toBeGreaterThan(0);
			expect(step.help?.en.length).toBeGreaterThan(0);
		}
	});

	test("keeps the setup singleton out of the panel modules, because its id is reserved", () => {
		expect(Object.keys(modules)).not.toContain("setup");
	});
});

describe("assembling the minecraft driver", () => {
	test("registers every module the panel binds a section to", () => {
		for (const section of sections) {
			if (section.layout !== BridgeLayout.Form) {
				expect(Object.keys(modules)).toContain(section.module);
			}
		}
	});

	test("declares the remote access toggle the rcon port is published by, beside its card", () => {
		expect(formSection("settings", "rcon-access")?.fields.map((field) => field.key)).toContain(RCON_ACCESS_VARIABLE);
		expect(Object.keys(modules)).toContain(RCON_ACCESS_MODULE);
	});
});
