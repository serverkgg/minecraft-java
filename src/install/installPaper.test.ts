import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeNetError, BridgeUserError } from "@serverkgg/bridge";
import type { PaperBuild } from "../shared";
import { installPaper } from "./installPaper";

const contextWith = (answer: PaperBuild[] | Error) => {
	return {
		net: {
			json: async () => {
				if (answer instanceof Error) {
					throw answer;
				}

				return answer;
			},
		},
	} as unknown as Bridge.Context;
};

const thrownBy = async (context: Bridge.Context) => {
	return await installPaper(context, "1.99", null).then(
		() => null,
		(error: unknown) => error,
	);
};

describe("installing Paper on a version it has no build for", () => {
	test("a 404 from the build list becomes text the customer can act on", async () => {
		const error = await thrownBy(contextWith(new BridgeNetError(404, "fill.papermc.io answered 404")));

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"Paper has no build for Minecraft 1.99 yet. Pick another version or server type.",
		);
		expect((error as BridgeUserError).text.ar).toBe(
			"ما فيه إصدار من Paper لماينكرافت 1.99 لين الحين. اختر نسخة ثانية أو نوع سيرفر ثاني.",
		);
	});

	test("an empty build list says the same thing", async () => {
		const error = await thrownBy(contextWith([]));

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toContain("Paper has no build for Minecraft 1.99");
	});

	test("any other network failure keeps its own path", async () => {
		const failure = new BridgeNetError(503, "fill.papermc.io answered 503");
		const error = await thrownBy(contextWith(failure));

		expect(error).toBe(failure);
	});
});
