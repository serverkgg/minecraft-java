import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { reportModCrash } from "../events";
import {
	applyModpack,
	detachModpack,
	ModpackPlanKind,
	modpackRemovedActivity,
	type PendingFile,
	pendingHold,
	settlePendingFiles,
	stageModpack,
} from "../modpacks";
import { SEEDED_PROPERTIES } from "../settings";
import { addonDirectory, javaMajorFor, ServerVariant, VARIANT_LABELS } from "../shared";
import { applyTransition, transitionFor, wipeData } from "./applyTransition";
import { installFabric } from "./installFabric";
import { installForge } from "./installForge";
import { resolveNext } from "./installIdentity";
import { installNeoForge } from "./installNeoForge";
import { installPaper } from "./installPaper";
import { installPurpur } from "./installPurpur";
import { pinRconProperties } from "./installRcon";
import { type InstallIdentity, type InstallStamp, matchesStamp, readInstallStamp } from "./installStamp";
import { installVanilla } from "./installVanilla";
import type { LaunchPlan } from "./launchPlan";
import { LOADER_ARTIFACTS, preserveRuntime, recoverRuntime } from "./runtimeRecovery";
import type { TransitionPlan } from "./transition";
import { transitionActivityText } from "./transitionText";

type Installer = (
	context: Bridge.Context,
	gameVersion: string,
	build: string | null,
	javaMajor: number,
) => Promise<LaunchPlan>;

const INSTALL_BY_VARIANT: Record<ServerVariant, Installer> = {
	[ServerVariant.Fabric]: (context, gameVersion, build) => installFabric(context, gameVersion, build),
	[ServerVariant.Forge]: installForge,
	[ServerVariant.NeoForge]: installNeoForge,
	[ServerVariant.Paper]: (context, gameVersion, build) => installPaper(context, gameVersion, build),
	[ServerVariant.Purpur]: (context, gameVersion, build) => installPurpur(context, gameVersion, build),
	[ServerVariant.Vanilla]: (context, gameVersion) => installVanilla(context, gameVersion),
};

const finalize = async (context: Bridge.Context, stamp?: InstallStamp) => {
	await context.files.write("eula.txt", "eula=true\n");

	if (!(await context.files.exists("server.properties"))) {
		await context.codec.javaProperties.merge("server.properties", SEEDED_PROPERTIES);
	}

	await context.files.ensure(addonDirectory(context), "logs");
	await pinRconProperties(context, stamp);
};

const reportInstalled = (
	context: Bridge.Context,
	stamp: InstallStamp | null,
	next: InstallIdentity,
	build: string | null,
	javaMajor: number,
	transition: TransitionPlan | null,
) => {
	const name = `${VARIANT_LABELS[next.variant]} ${next.version}`;

	context.activity.report({
		name: BridgeEventName.GameInstalled,
		text: {
			ar: `تم تثبيت ماينكرافت ${name}`,
			en: `Installed Minecraft ${name}`,
		},
		subject: name,
		details: {
			variant: next.variant,
			version: next.version,
			build,
			java: javaMajor,
		},
	});

	if (!stamp || !transition || (stamp.variant === next.variant && stamp.version === next.version)) {
		return;
	}

	context.activity.report({
		name: BridgeEventName.ServerUpdated,
		text: transitionActivityText(stamp, next, transition),
		subject: name,
		details: {
			from: `${VARIANT_LABELS[stamp.variant]} ${stamp.version}`,
			to: name,
			world: transition.world,
			addons: transition.addons,
		},
	});
};

export const install: Bridge.Install = {
	kind: BridgeKind.Install,
	async run(context) {
		await reportModCrash(context);

		const stamp = await readInstallStamp(context);
		const { next, plan } = await resolveNext(context, stamp);
		const { variant, version } = next;
		const javaMajor = stamp?.version === version ? stamp.java : await javaMajorFor(context, version);

		const staged =
			plan.kind === ModpackPlanKind.Apply && plan.ref ? await stageModpack(context, plan.ref, variant, version) : null;

		let transition: TransitionPlan | null = null;

		if (
			stamp
			&& (!matchesStamp(stamp, next) || plan.kind === ModpackPlanKind.Apply || plan.kind === ModpackPlanKind.Detach)
		) {
			await preserveRuntime(context, stamp);
		}

		if (plan.kind === ModpackPlanKind.Detach) {
			context.log("removing the modpack, and the world it built goes with it", {
				modpack: plan.sidecar?.title ?? "",
			});

			await wipeData(context);
		} else if (plan.kind !== ModpackPlanKind.Apply && matchesStamp(stamp, next) && stamp) {
			if ((await context.files.exists(stamp.launch.target)) || (await recoverRuntime(context, stamp))) {
				context.log("install is current", {
					variant,
					version,
					build: next.build,
				});

				await finalize(context);

				return pendingHold(await settlePendingFiles(context));
			}

			context.log("the recorded install is missing its files, installing it again", {
				variant,
				version,
				target: stamp.launch.target,
			});
		} else if (stamp) {
			transition = await transitionFor(context, stamp, next);

			context.log("reinstalling", {
				from: `${stamp.variant} ${stamp.version}`,
				to: `${variant} ${version}`,
				world: transition.world,
				addons: transition.addons,
				relocation: transition.relocation ?? "",
			});

			await applyTransition(context, transition);
		}

		for (const artifact of LOADER_ARTIFACTS) {
			await context.files.remove(artifact);
		}

		const detaching = plan.kind === ModpackPlanKind.Detach;

		const build = staged ? staged.index.loaderVersion : next.build;

		context.log("installing minecraft", {
			variant,
			version,
			build,
			java: javaMajor,
		});

		const launch = await INSTALL_BY_VARIANT[variant](context, version, build, javaMajor);

		let pending: PendingFile[] = [];
		let modpackActivity: Bridge.Activity | null = null;

		if (staged) {
			const applied = await applyModpack(context, staged);

			pending = applied.pending;
			modpackActivity = applied.activity;
		} else if (detaching) {
			await detachModpack(context);

			modpackActivity = modpackRemovedActivity(plan.sidecar?.title ?? "");
		} else {
			pending = await settlePendingFiles(context);
		}

		await finalize(context, {
			variant,
			version,
			build,
			java: javaMajor,
			launch,
			rconPassword: stamp?.rconPassword ?? null,
			rconPasswordNext: stamp?.rconPasswordNext ?? null,
		});

		context.log("minecraft is installed", {
			variant,
			version,
			build,
			launch: launch.kind,
		});

		reportInstalled(context, stamp, next, build, javaMajor, transition);

		if (modpackActivity) {
			context.activity.report(modpackActivity);
		}

		return pendingHold(pending);
	},
	async describe(context) {
		const stamp = await readInstallStamp(context);

		return {
			version: stamp?.version ?? null,
			variant: stamp?.variant ?? null,
			build: stamp?.build ?? null,
		};
	},
};
