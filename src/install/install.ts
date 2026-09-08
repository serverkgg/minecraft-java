import { type Bridge, BridgeKind } from "@serverkgg/bridge";
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
import { matchesStamp, readInstallStamp, writeInstallStamp } from "./installStamp";
import { installVanilla } from "./installVanilla";
import type { LaunchPlan } from "./launchPlan";

const LOADER_ARTIFACTS = [
	"server.jar",
	"libraries",
	"versions",
	".fabric",
	"run.sh",
	"run.bat",
	"user_jvm_args.txt",
];

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

const finalize = async (context: Bridge.Context) => {
	await context.files.write("eula.txt", "eula=true\n");

	if (!(await context.files.exists("server.properties"))) {
		await context.codec.properties.merge("server.properties", SEEDED_PROPERTIES);
	}

	await pinRconProperties(context);
	await context.files.ensure(addonDirectory(context), "logs");
};

export const install: Bridge.Install = {
	kind: BridgeKind.Install,
	async run(context) {
		await reportModCrash(context);

		const stamp = await readInstallStamp(context);
		const { next, plan } = await resolveNext(context, stamp);
		const { variant, version } = next;
		const javaMajor = await javaMajorFor(context, version);

		if (plan.kind === ModpackPlanKind.Detach) {
			context.log("removing the modpack, and the world it built goes with it", {
				modpack: plan.sidecar?.title ?? "",
			});

			await wipeData(context);
		} else if (plan.kind !== ModpackPlanKind.Apply && matchesStamp(stamp, next) && stamp) {
			if (await context.files.exists(stamp.launch.target)) {
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

		const staged =
			plan.kind === ModpackPlanKind.Apply && plan.ref ? await stageModpack(context, plan.ref, variant, version) : null;

		const mismatched = plan.kind === ModpackPlanKind.Apply && staged === null && plan.sidecar !== null;

		if (mismatched) {
			throw new Error(
				`the modpack "${plan.sidecar?.title ?? ""}" does not fit this server any more, so nothing was changed — choose a version built for ${variant} ${version}, or remove the modpack`,
			);
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

		await writeInstallStamp(context, {
			variant,
			version,
			build,
			java: javaMajor,
			launch,
			rconPassword: stamp?.rconPassword ?? null,
			rconPasswordNext: stamp?.rconPasswordNext ?? null,
		});

		let pending: PendingFile[] = [];

		if (staged) {
			pending = await applyModpack(context, staged);
		} else if (detaching) {
			await detachModpack(context);
		} else {
			pending = await settlePendingFiles(context);
		}

		await finalize(context);

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
