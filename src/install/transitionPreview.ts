import { type Bridge, BridgeConfirm, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { COMPANION_FEATURES, CompanionReadiness, companionReadiness } from "../companions";
import { ModpackPlanKind } from "../modpacks";
import { acceptedBuild } from "../shared";
import { planWorldArchive } from "../worlds";
import { transitionFor } from "./applyTransition";
import { type InstallNext, resolveNext } from "./installIdentity";
import { type InstallIdentity, type InstallStamp, matchesStamp, readInstallStamp } from "./installStamp";
import {
	type CompanionNotice,
	companionLines,
	freshInstallLines,
	modpackDetachLines,
	transitionLines,
	unchangedLines,
	versionOrderUnknownLines,
} from "./transitionText";

const refusalOf = async (context: Bridge.Context, { next, plan }: InstallNext) => {
	if (plan.kind === ModpackPlanKind.Apply) {
		return null;
	}

	try {
		await acceptedBuild(context, next.variant, next.version, next.build);

		return null;
	} catch (error) {
		return error instanceof BridgeUserError ? error.text : null;
	}
};

const archiveNameOf = async (context: Bridge.Context, pack: string) => {
	try {
		return (await planWorldArchive(context, pack))?.to ?? null;
	} catch {
		return null;
	}
};

const companionNotices = async (context: Bridge.Context, from: InstallStamp, to: InstallIdentity) => {
	const notices: CompanionNotice[] = [];

	for (const feature of COMPANION_FEATURES) {
		if (context.variable(feature.variable) !== "true" || !feature.variants.includes(from.variant)) {
			continue;
		}

		const readiness = await companionReadiness(context, feature, to.variant, to.version);

		if (readiness === CompanionReadiness.Unresolved || readiness === CompanionReadiness.Unsupported) {
			notices.push({
				feature,
				readiness,
			});
		}
	}

	return companionLines(to, notices);
};

export const transitionPreview: Bridge.Preview = {
	kind: BridgeKind.Preview,
	async preview(context) {
		const stamp = await readInstallStamp(context);
		const resolved = await resolveNext(context, stamp, true);
		const { next, plan } = resolved;
		const detaching = plan.kind === ModpackPlanKind.Detach;
		const current = plan.kind !== ModpackPlanKind.Apply && !detaching && matchesStamp(stamp, next);

		const refusal = current ? null : await refusalOf(context, resolved);

		if (refusal) {
			return {
				confirm: BridgeConfirm.Normal,
				lines: [
					refusal,
				],
				blocked: true,
			};
		}

		if (detaching) {
			return {
				confirm: BridgeConfirm.Normal,
				lines: modpackDetachLines(next, await archiveNameOf(context, plan.sidecar?.title ?? "")),
			};
		}

		if (current && stamp) {
			return {
				confirm: BridgeConfirm.Normal,
				lines: unchangedLines(next),
			};
		}

		if (stamp === null) {
			return {
				confirm: BridgeConfirm.Normal,
				lines: freshInstallLines(next),
			};
		}

		const companions = await companionNotices(context, stamp, next);

		try {
			const transitionPlan = await transitionFor(context, stamp, next);

			return {
				confirm: BridgeConfirm.Normal,
				lines: [
					...transitionLines(stamp, next, transitionPlan),
					...companions,
				],
			};
		} catch {
			return {
				confirm: BridgeConfirm.Normal,
				lines: [
					...versionOrderUnknownLines(),
					...companions,
				],
			};
		}
	},
};
