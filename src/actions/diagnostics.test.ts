import { expect, test } from "bun:test";
import { profileLinks } from "./diagnostics";

test("reports expose only spark URLs, never arbitrary log content", () => {
	expect(
		profileLinks([
			"password=private https://spark.lucko.me/abc123",
			"https://evil.example/token",
			"again https://spark.lucko.me/abc123",
		]),
	).toEqual([
		"https://spark.lucko.me/abc123",
	]);
});
