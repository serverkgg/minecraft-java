import { describe, expect, it } from "bun:test";
import { isUnder, relativeUploadPath } from "./staging";

describe("the path an upload is allowed to land on", () => {
	it("a plain relative path is kept", () => {
		expect(relativeUploadPath("world/level.dat")).toBe("world/level.dat");
	});

	it("surrounding whitespace, leading dots and repeated slashes are folded away", () => {
		expect(relativeUploadPath("  world/level.dat  ")).toBe("world/level.dat");
		expect(relativeUploadPath("./world//level.dat")).toBe("world/level.dat");
		expect(relativeUploadPath("world/./level.dat")).toBe("world/level.dat");
	});

	it("an absolute path is refused", () => {
		expect(relativeUploadPath("/etc/passwd")).toBeNull();
		expect(relativeUploadPath("  /world")).toBeNull();
	});

	it("a path that walks upwards is refused wherever the segment sits", () => {
		expect(relativeUploadPath("..")).toBeNull();
		expect(relativeUploadPath("../world")).toBeNull();
		expect(relativeUploadPath("world/../../etc")).toBeNull();
	});

	it("a path with nothing left in it is refused", () => {
		expect(relativeUploadPath("")).toBeNull();
		expect(relativeUploadPath("   ")).toBeNull();
		expect(relativeUploadPath(".")).toBeNull();
		expect(relativeUploadPath("./")).toBeNull();
	});
});

describe("deciding whether a path sits inside a staging directory", () => {
	it("a child of the directory is inside it", () => {
		expect(isUnder(".serverk-uploads/world/level.dat", ".serverk-uploads/world")).toBe(true);
	});

	it("the directory itself is not inside itself", () => {
		expect(isUnder(".serverk-uploads/world", ".serverk-uploads/world")).toBe(false);
		expect(isUnder(".serverk-uploads/world/", ".serverk-uploads/world")).toBe(false);
	});

	it("a sibling that merely shares the prefix is outside", () => {
		expect(isUnder(".serverk-uploads/world-old/level.dat", ".serverk-uploads/world")).toBe(false);
	});
});
