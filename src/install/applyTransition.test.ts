import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { applyTransition } from "./applyTransition";
import { AddonOutcome, type TransitionPlan, WorldOutcome } from "./transition";

const ROOT_ENTRIES = [
	"server.jar",
	".serverk-install.json",
	".serverk-staging",
	".serverk-uploads",
	".serverk-packs",
	".serverk-packs/index.json",
];

const wipingContext = () => {
	const removed: string[] = [];
	const context = {
		exec: async () => ({
			code: 0,
			stdout: "",
			stderr: "",
		}),
		files: {
			list: async () => {
				return ROOT_ENTRIES.map((path) => ({
					path,
				}));
			},
			remove: async (path: string) => {
				removed.push(path);
			},
			exists: async () => false,
		},
		log: Object.assign(() => {}, {
			warn: () => {},
		}),
	} as unknown as Bridge.Context;

	return {
		context,
		removed,
	};
};

describe("starting a fresh server on a transition that wipes it", () => {
	it("keeps the driver's staging, the drop points and the modpacks the owner uploaded", async () => {
		const { context, removed } = wipingContext();

		await applyTransition(context, {
			world: WorldOutcome.Wiped,
			addons: AddonOutcome.Removed,
			relocations: [],
		} as unknown as TransitionPlan);

		expect(removed).toContain("server.jar");
		expect(removed).toContain(".serverk-install.json");
		expect(removed).not.toContain(".serverk-staging");
		expect(removed).not.toContain(".serverk-uploads");
		expect(removed).not.toContain(".serverk-packs");
		expect(removed).not.toContain(".serverk-packs/index.json");
	});
});
