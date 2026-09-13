import { type Bridge, BridgeDetailTone, BridgeKind, BridgeUserError } from "@serverkgg/bridge";

const PROFILE_URL = /https:\/\/spark\.lucko\.me\/[A-Za-z0-9]+/g;

export const profileLinks = (lines: string[]) =>
	[
		...new Set(lines.flatMap((line) => line.match(PROFILE_URL) ?? [])),
	].slice(-3);

export const diagnostics: Bridge.Detail = {
	kind: BridgeKind.Detail,
	requiresRunning: true,
	refreshSeconds: 30,
	async read(context) {
		const urls = profileLinks(await context.logs.tail(200));
		return {
			id: "diagnostics",
			title: {
				ar: "فحص اللاق",
				en: "Lag diagnostics",
			},
			subtitle: null,
			description: {
				ar: "شغّل الفحص وقت اللاق وأصحابك داخل السيرفر. يحتاج spark؛ مدمج في إصدارات Paper وPurpur الحديثة، أو ركّبه من الإضافات أو المودات.",
				en: "Run a profile while lag occurs and players are online. Requires spark, bundled in recent Paper/Purpur versions or available from the addon catalog.",
			},
			image: null,
			badges: [
				{
					label: {
						ar: "بقرارك فقط",
						en: "Owner initiated",
					},
					tone: BridgeDetailTone.Neutral,
				},
			],
			stats: [],
			links: urls.map((url, index) => ({
				label: {
					ar: `تقرير الأداء ${index + 1}`,
					en: `Performance report ${index + 1}`,
				},
				url,
			})),
			stale: false,
			actions: [
				"profile",
				"cancel",
			],
		};
	},
	actions: {
		async profile(context) {
			const result = await context.command("spark profiler start --timeout 60", {
				expect: /(?:profiler|profiling|Unknown command|unknown or incomplete command|already running)/i,
				timeoutMs: 10_000,
			});
			if (!result.line || /unknown|incomplete/i.test(result.line)) {
				throw new BridgeUserError({
					ar: "spark ما رد. ركّبه من كتالوج الإضافات أو المودات وجرّب مرة ثانية.",
					en: "spark did not respond. Install it from the addon catalog and retry.",
				});
			}
			return null;
		},
		async cancel(context) {
			await context.command("spark profiler cancel");
			return null;
		},
	},
};
