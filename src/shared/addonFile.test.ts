import { describe, expect, test } from "bun:test";
import { addonDirectoryFor, enabledName, fileNameOf } from "./addonFile";
import { ServerVariant } from "./variant";

describe("where an addon is installed", () => {
	test("a mod loader takes mods", () => {
		expect(addonDirectoryFor(ServerVariant.Fabric)).toBe("mods");
		expect(addonDirectoryFor(ServerVariant.Forge)).toBe("mods");
		expect(addonDirectoryFor(ServerVariant.NeoForge)).toBe("mods");
	});

	test("a plugin server, and vanilla, take plugins", () => {
		expect(addonDirectoryFor(ServerVariant.Paper)).toBe("plugins");
		expect(addonDirectoryFor(ServerVariant.Purpur)).toBe("plugins");
		expect(addonDirectoryFor(ServerVariant.Vanilla)).toBe("plugins");
	});
});

describe("reading a file name out of a path", () => {
	test("the last segment is the name", () => {
		expect(fileNameOf("mods/create.jar")).toBe("create.jar");
		expect(fileNameOf("mods/nested/create.jar")).toBe("create.jar");
	});

	test("a bare name is already the name", () => {
		expect(fileNameOf("create.jar")).toBe("create.jar");
	});
});

describe("reading the enabled name of an addon file", () => {
	test("a disabled file answers with the name it has when enabled", () => {
		expect(enabledName("create.jar.disabled")).toBe("create.jar");
	});

	test("an enabled file is unchanged", () => {
		expect(enabledName("create.jar")).toBe("create.jar");
	});

	test("only a trailing suffix counts", () => {
		expect(enabledName("create.disabled.jar")).toBe("create.disabled.jar");
	});
});
