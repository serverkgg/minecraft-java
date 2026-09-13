import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { STAGING_ROOT } from "../shared";
import { type InstallStamp, matchesStamp, parseInstallStamp } from "./installStamp";

export const LOADER_ARTIFACTS = [
	"server.jar",
	"libraries",
	"versions",
	".fabric",
	"run.sh",
	"run.bat",
	"user_jvm_args.txt",
];
export const RUNTIME_RECOVERY = `${STAGING_ROOT}/runtime-previous`;

export const preserveRuntime = async (context: Bridge.Context, stamp: InstallStamp | null) => {
	if (!stamp || !(await context.files.exists(stamp.launch.target))) {
		return;
	}
	const staging = `${STAGING_ROOT}/runtime-next`;
	await context.files.remove(staging);
	await context.files.ensure(staging);
	for (const path of LOADER_ARTIFACTS) {
		if (!(await context.files.exists(path))) {
			continue;
		}
		const copied = await context.exec(
			[
				"cp",
				"-R",
				"--no-dereference",
				"--",
				path,
				`${staging}/${path}`,
			],
			{
				timeoutMs: 300_000,
			},
		);
		if (copied.code !== 0) {
			await context.files.remove(staging);
			throw new BridgeUserError({
				ar: "ما قدرنا نحفظ ملفات التشغيل القديمة. تأكد من المساحة وجرّب التحديث مرة ثانية.",
				en: "Could not preserve the previous runtime. Check disk space and retry the update.",
			});
		}
	}
	await context.files.write(
		`${staging}/identity.json`,
		JSON.stringify({
			variant: stamp.variant,
			version: stamp.version,
			build: stamp.build,
			java: stamp.java,
			launch: stamp.launch,
		}),
	);
	await context.files.remove(RUNTIME_RECOVERY);
	await context.files.move(staging, RUNTIME_RECOVERY);
};

export const recoverRuntime = async (context: Bridge.Context, stamp: InstallStamp) => {
	const metadata = `${RUNTIME_RECOVERY}/identity.json`;
	if (!(await context.files.exists(metadata))) {
		return false;
	}
	const recorded = parseInstallStamp(await context.files.read(metadata));
	if (
		!recorded
		|| !matchesStamp(recorded, stamp)
		|| recorded.java !== stamp.java
		|| recorded.launch.target !== stamp.launch.target
		|| recorded.launch.kind !== stamp.launch.kind
	) {
		return false;
	}
	if (!(await context.files.exists(`${RUNTIME_RECOVERY}/${stamp.launch.target}`))) {
		return false;
	}
	for (const path of LOADER_ARTIFACTS) {
		await context.files.remove(path);
		const source = `${RUNTIME_RECOVERY}/${path}`;
		if (!(await context.files.exists(source))) {
			continue;
		}
		const copied = await context.exec(
			[
				"cp",
				"-R",
				"--no-dereference",
				"--",
				source,
				path,
			],
			{
				timeoutMs: 300_000,
			},
		);
		if (copied.code !== 0) {
			throw new BridgeUserError({
				ar: "ما قدرنا نسترجع ملفات التشغيل المحفوظة. تأكد من المساحة وجرّب مرة ثانية.",
				en: "Could not recover the preserved runtime. Check disk space and retry.",
			});
		}
	}
	return true;
};
