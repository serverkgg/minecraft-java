import { describe, expect, it } from "bun:test";
import { ServerVariant, StorageEra } from "../shared";
import { planTransition, VersionStep } from "./transition";
import { transitionActivityText } from "./transitionText";

const side = (variant: ServerVariant, version: string) => {
	return {
		variant,
		version,
		era: StorageEra.Legacy,
	};
};

const identity = (variant: ServerVariant, version: string) => {
	return {
		variant,
		version,
		build: null,
	};
};

describe("what a finished move to another type or version says", () => {
	it("an upgrade on the same type keeps the world", () => {
		const plan = planTransition(
			side(ServerVariant.Paper, "1.21.1"),
			side(ServerVariant.Paper, "1.21.4"),
			VersionStep.Upgrade,
		);

		expect(
			transitionActivityText(identity(ServerVariant.Paper, "1.21.1"), identity(ServerVariant.Paper, "1.21.4"), plan),
		).toEqual({
			ar: "تم نقل السيرفر من Paper 1.21.1 إلى Paper 1.21.4، وبقيت الماب كما هي",
			en: "Moved the server from Paper 1.21.1 to Paper 1.21.4, the world was kept",
		});
	});

	it("a move to another ecosystem says the addons were removed", () => {
		const plan = planTransition(
			side(ServerVariant.Paper, "1.21.1"),
			side(ServerVariant.Fabric, "1.21.1"),
			VersionStep.Same,
		);

		expect(
			transitionActivityText(identity(ServerVariant.Paper, "1.21.1"), identity(ServerVariant.Fabric, "1.21.1"), plan)
				.en,
		).toBe(
			"Moved the server from Paper 1.21.1 to Fabric 1.21.1, the world was kept, and plugins and mods were removed because they don't run on Fabric",
		);
	});

	it("a downgrade says the world was wiped", () => {
		const plan = planTransition(
			side(ServerVariant.Vanilla, "1.21.4"),
			side(ServerVariant.Vanilla, "1.20.1"),
			VersionStep.Downgrade,
		);

		const text = transitionActivityText(
			identity(ServerVariant.Vanilla, "1.21.4"),
			identity(ServerVariant.Vanilla, "1.20.1"),
			plan,
		);

		expect(text.en).toContain("the world, plugins, mods and settings were deleted");
		expect(text.ar).toContain("تم حذف الماب");
	});
});
