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
import {
	type AcceptedBuild,
	acceptedBuild,
	addonDirectory,
	javaMajorFor,
	ServerVariant,
	VARIANT_LABELS,
} from "../shared";
import { archiveWorld, planWorldArchive } from "../worlds";
import { applyTransition, removeAddons, transitionFor } from "./applyTransition";
import { installFabric } from "./installFabric";
import { installForge } from "./installForge";
import { resolveNext } from "./installIdentity";
import { installNeoForge } from "./installNeoForge";
import { installPaper } from "./installPaper";
import { installPurpur } from "./installPurpur";
import { pinRconProperties } from "./installRcon";
import {
	type InstallIdentity,
	type InstallStamp,
	launchDigestOf,
	launchIntact,
	matchesStamp,
	readInstallStamp,
	writeInstallStamp,
} from "./installStamp";
import { installVanilla } from "./installVanilla";
import type { LaunchPlan } from "./launchPlan";
import { LOADER_ARTIFACTS, preserveRuntime, recoverRuntime } from "./runtimeRecovery";
import { AddonOutcome, type TransitionPlan } from "./transition";
import { transitionActivityText } from "./transitionText";

type Installer = (
	context: Bridge.Context,
	gameVersion: string,
	accepted: AcceptedBuild,
	javaMajor: number,
) => Promise<LaunchPlan>;

const INSTALL_BY_VARIANT: Record<ServerVariant, Installer> = {
	[ServerVariant.Fabric]: (context, _gameVersion, accepted) => installFabric(context, accepted),
	[ServerVariant.Forge]: installForge,
	[ServerVariant.NeoForge]: installNeoForge,
	[ServerVariant.Paper]: (context, _gameVersion, accepted) => installPaper(context, accepted),
	[ServerVariant.Purpur]: (context, gameVersion, accepted) => installPurpur(context, gameVersion, accepted),
	[ServerVariant.Vanilla]: (context, _gameVersion, accepted) => installVanilla(context, accepted),
};

const restorePrevious = async (context: Bridge.Context, stamp: InstallStamp) => {
	try {
		if (!(await recoverRuntime(context, stamp))) {
			context.log.warn("the install failed and no previous server files were saved to put back", {
				variant: stamp.variant,
				version: stamp.version,
			});

			return;
		}

		await writeInstallStamp(context, stamp);

		context.log.warn("the install failed, the previous server files are back in place", {
			variant: stamp.variant,
			version: stamp.version,
			build: stamp.build ?? "",
		});
	} catch (error) {
		context.log.warn("the install failed and the previous server files could not be put back", {
			reason: error instanceof Error ? error.message : String(error),
		});
	}
};

const installOrRestore = async (
	context: Bridge.Context,
	stamp: InstallStamp | null,
	run: () => Promise<LaunchPlan>,
) => {
	try {
		return await run();
	} catch (error) {
		if (stamp) {
			await restorePrevious(context, stamp);
		}

		throw error;
	}
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
		const detaching = plan.kind === ModpackPlanKind.Detach;
		const current = plan.kind !== ModpackPlanKind.Apply && !detaching && matchesStamp(stamp, next);

		if (current && stamp) {
			const matching = await launchIntact(context, stamp);

			if (!matching) {
				context.log("the server files do not match the recorded install, putting the saved files back", {
					variant,
					version,
					target: stamp.launch.target,
				});
			}

			const intact = matching || ((await recoverRuntime(context, stamp)) && (await launchIntact(context, stamp)));

			if (intact) {
				context.log("install is current", {
					variant,
					version,
					build: next.build,
				});

				await finalize(
					context,
					stamp.launchDigest === null
						? {
								...stamp,
								launchDigest: await launchDigestOf(context, stamp.launch),
							}
						: undefined,
				);

				return pendingHold(await settlePendingFiles(context));
			}

			context.log("the recorded install does not match its files, installing it again", {
				variant,
				version,
				target: stamp.launch.target,
			});
		}

		const javaMajor = stamp?.version === version ? stamp.java : await javaMajorFor(context, version);

		const staged =
			plan.kind === ModpackPlanKind.Apply && plan.ref ? await stageModpack(context, plan.ref, variant, version) : null;

		const build = staged ? staged.index.loaderVersion : next.build;
		const accepted = await acceptedBuild(context, variant, version, build);
		const changing = stamp !== null && !current && !(detaching && matchesStamp(stamp, next));
		const transition = stamp && changing ? await transitionFor(context, stamp, next) : null;
		const archive = detaching ? await planWorldArchive(context, plan.sidecar?.title ?? "") : null;

		if (stamp && !current) {
			await preserveRuntime(context, stamp);
		}

		if (detaching) {
			context.log("removing the modpack, the world it built is kept under a new name", {
				modpack: plan.sidecar?.title ?? "",
				world: archive?.from ?? "",
				archived: archive?.to ?? "",
			});

			if (transition && transition.addons === AddonOutcome.Removed) {
				await removeAddons(context);
			}
		} else if (stamp && transition) {
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

		context.log("installing minecraft", {
			variant,
			version,
			build: accepted.build,
			java: javaMajor,
		});

		const launch = await installOrRestore(context, stamp, () => {
			return INSTALL_BY_VARIANT[variant](context, version, accepted, javaMajor);
		});

		let pending: PendingFile[] = [];
		let modpackActivity: Bridge.Activity | null = null;

		if (staged) {
			const applied = await applyModpack(context, staged);

			pending = applied.pending;
			modpackActivity = applied.activity;
		} else if (detaching) {
			if (archive) {
				await archiveWorld(context, archive);
			}

			await detachModpack(context);

			modpackActivity = modpackRemovedActivity(plan.sidecar?.title ?? "", archive?.to ?? null);
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
			launchDigest: await launchDigestOf(context, launch),
		});

		context.log("minecraft is installed", {
			variant,
			version,
			build,
			launch: launch.kind,
		});

		reportInstalled(context, stamp, next, build, javaMajor, detaching ? null : transition);

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
