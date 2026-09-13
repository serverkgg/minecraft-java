import { type Bridge, BridgeDetailFormat, BridgeDetailTone, BridgeKind } from "@serverkgg/bridge";
import { readInstallStamp } from "../install";
import { readModpackSidecar } from "../modpacks";
import { VARIANT_LABELS } from "../shared";
import { CROSSPLAY, featureEnabled } from "./companion";

export const connectionStatus: Bridge.Detail = {
	kind: BridgeKind.Detail,
	refreshSeconds: 30,
	async read(context) {
		const stamp = await readInstallStamp(context);
		const pack = await readModpackSidecar(context);
		const java = context.server.running
			? await context.probe.minecraftPing(context.port("game")).catch(() => null)
			: null;
		const enabled = featureEnabled(context, CROSSPLAY);
		const bedrock =
			enabled && context.server.running
				? await context.probe.raknetPing(context.port("bedrock")).catch(() => null)
				: null;
		return {
			id: "connection-status",
			title: {
				ar: "جاهزية الدخول",
				en: "Join readiness",
			},
			subtitle: stamp ? `${VARIANT_LABELS[stamp.variant]} ${stamp.version}` : null,
			description: pack
				? {
						ar: `ركّب ${pack.title} ${pack.version} على جهازك قبل الدخول. عنوان السيرفر في صفحة الوصول.`,
						en: `Install ${pack.title} ${pack.version} on your computer before joining. Find the address on the Access page.`,
					}
				: {
						ar: "افتح صفحة الوصول وانسخ العنوان. بيدروك هنا يدخل عالم جافا عن طريق Geyser؛ مو سيرفر بيدروك أصلي.",
						en: "Copy the address from the Access page. Bedrock here joins the Java world through Geyser; this is not a native Bedrock server.",
					},
			image: null,
			badges: [
				{
					label: java
						? {
								ar: "جافا يرد",
								en: "Java responds",
							}
						: {
								ar: "جافا ما يرد الحين",
								en: "Java not responding",
							},
					tone: java ? BridgeDetailTone.Success : BridgeDetailTone.Warning,
				},
				{
					label: !enabled
						? {
								ar: "الكروس بلاي مقفل",
								en: "Crossplay off",
							}
						: bedrock
							? {
									ar: "بيدروك يرد",
									en: "Bedrock responds",
								}
							: {
									ar: "بيدروك ما يرد؛ راجع الإعدادات والكونسول",
									en: "Bedrock not responding; check settings and console",
								},
					tone: bedrock ? BridgeDetailTone.Success : BridgeDetailTone.Warning,
				},
			],
			stats: [
				{
					key: "java",
					label: {
						ar: "نسخة جافا للدخول",
						en: "Java client version",
					},
					value: stamp?.version ?? null,
					format: BridgeDetailFormat.Text,
				},
				{
					key: "bedrock",
					label: {
						ar: "نسخة بيدروك اللي يعلنها السيرفر",
						en: "Advertised Bedrock version",
					},
					value: bedrock?.version ?? null,
					format: BridgeDetailFormat.Text,
				},
				{
					key: "pack",
					label: {
						ar: "المودباك المطلوب",
						en: "Required modpack",
					},
					value: pack
						? `${pack.title} ${pack.version}`
						: {
								ar: "ما فيه",
								en: "None",
							},
					format: BridgeDetailFormat.Text,
				},
				{
					key: "missing",
					label: {
						ar: "ملفات المودباك الناقصة",
						en: "Missing modpack files",
					},
					value: pack?.pending.length ?? 0,
					format: BridgeDetailFormat.Number,
				},
			],
			links: [
				...(pack?.pageUrl
					? [
							{
								label: {
									ar: "نزّل المودباك",
									en: "Download modpack",
								},
								url: pack.pageUrl,
							},
						]
					: []),
				{
					label: {
						ar: "نسخ الكروس بلاي المدعومة",
						en: "Supported crossplay versions",
					},
					url: "https://geysermc.org/wiki/geyser/supported-versions/",
				},
			],
			stale: false,
			actions: [],
		};
	},
};
