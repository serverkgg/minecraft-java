import { type Bridge, BridgeConfirm, BridgeKind } from "@serverkgg/bridge";
import { ModpackPlanKind } from "../modpacks";
import { transitionFor } from "./applyTransition";
import { resolveNext } from "./installIdentity";
import { matchesStamp, readStamp } from "./installStamp";
import {
	freshInstallLines,
	modpackDetachLines,
	transitionLines,
	unchangedLines,
	versionOrderUnknownLines,
} from "./transitionText";

export const transitionPreview: Bridge.Preview = {
	kind: BridgeKind.Preview,
	async preview(context) {
		const stamp = await readStamp(context);
		const { next, plan } = await resolveNext(context, stamp, true);

		if (plan.kind === ModpackPlanKind.Detach) {
			return {
				confirm: BridgeConfirm.Strong,
				lines: modpackDetachLines(next),
			};
		}

		if (plan.kind !== ModpackPlanKind.Apply && matchesStamp(stamp, next) && stamp) {
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

		try {
			const transitionPlan = await transitionFor(context, stamp, next);

			return {
				confirm: transitionPlan.confirm,
				lines: transitionLines(stamp, next, transitionPlan),
			};
		} catch {
			return {
				confirm: BridgeConfirm.Strong,
				lines: versionOrderUnknownLines(),
			};
		}
	},
};
