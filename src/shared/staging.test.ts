import { describe, expect, test } from "bun:test";
import { isUnder, relativeUploadPath } from "./staging";

describe("the path an upload is allowed to land on", () => {
	test("a plain relative path is kept", () => {
		expect(relativeUploadPath("world/level.dat")).toBe("world/level.dat");
	});

	test("surrounding whitespace, leading dots and repeated slashes are folded away", () => {
		expect(relativeUploadPath("  world/level.dat  ")).toBe("world/level.dat");
		expect(relativeUploadPath("./world//level.dat")).toBe("world/level.dat");
		expect(relativeUploadPath("world/./level.dat")).toBe("world/level.dat");
	});

	test("an absolute path is refused", () => {
		expect(relativeUploadPath("/etc/passwd")).toBeNull();
		expect(relativeUploadPath("  /world")).toBeNull();
	});

	test("a path that walks upwards is refused wherever the segment sits", () => {
		expect(relativeUploadPath("..")).toBeNull();
		expect(relativeUploadPath("../world")).toBeNull();
		expect(relativeUploadPath("world/../../etc")).toBeNull();
	});

	test("a path with nothing left in it is refused", () => {
		expect(relativeUploadPath("")).toBeNull();
		expect(relativeUploadPath("   ")).toBeNull();
		expect(relativeUploadPath(".")).toBeNull();
		expect(relativeUploadPath("./")).toBeNull();
	});
});

describe("deciding whether a path sits inside a staging directory", () => {
	test("a child of the directory is inside it", () => {
		expect(isUnder(".serverk-staging/world-upload/level.dat", ".serverk-staging/world-upload")).toBe(true);
	});

	test("the directory itself is not inside itself", () => {
		expect(isUnder(".serverk-staging/world-upload", ".serverk-staging/world-upload")).toBe(false);
		expect(isUnder(".serverk-staging/world-upload/", ".serverk-staging/world-upload")).toBe(false);
	});

	test("a sibling that merely shares the prefix is outside", () => {
		expect(isUnder(".serverk-staging/world-upload-old/level.dat", ".serverk-staging/world-upload")).toBe(false);
	});
});
