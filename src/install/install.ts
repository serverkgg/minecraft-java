import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { reportModCrash } from "../events";
import {
	applyModpack,
	detachModpack,
	ModpackPlanKind,
	type PendingFile,
	pendingHold,
	settlePendingFiles,
	stageModpack,
} from "../modpacks";
import { SEEDED_PROPERTIES } from "../settings";
import { addonDirectory, javaMajorFor, ServerVariant } from "../shared";
import { applyTransition, transitionFor, wipeData } from "./applyTransition";
import { installFabric } from "./installFabric";
import { installForge } from "./installForge";
import { resolveNext } from "./installIdentity";
import { installNeoForge } from "./installNeoForge";
import { installPaper } from "./installPaper";
import { installPurpur } from "./installPurpur";
import { pinRconProperties } from "./installRcon";
import { type InstallStamp, matchesStamp, readInstallStamp } from "./installStamp";
import { installVanilla } from "./installVanilla";
import type { LaunchPlan } from "./launchPlan";
import { LOADER_ARTIFACTS, preserveRuntime, recoverRuntime } from "./runtimeRecovery";

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

		const mismatched = plan.kind === ModpackPlanKind.Apply && staged === null;

		if (mismatched) {
			throw new BridgeUserError({
				ar: "المودباك المختار مو متاح أو ما يناسب نوع السيرفر ونسخته. اختَر إصدار متوافق؛ ما غيّرنا ملفاتك.",
				en: "The selected modpack is unavailable or incompatible with this server type and version. Choose a compatible release; your files were not changed.",
			});
		}

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
			const transition = await transitionFor(context, stamp, next);

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

		if (staged) {
			pending = await applyModpack(context, staged);
		} else if (detaching) {
			await detachModpack(context);
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
