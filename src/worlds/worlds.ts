import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { installedLayout } from "../install/installLayout";
import { formatByteSize, isUnder, relativeUploadPath, WORLD_STAGING } from "../shared";
import {
	activeWorld,
	discoverWorlds,
	findLevelDirectories,
	safeWorldName,
	setActiveWorld,
	worldDimensions,
	worldPaths,
	worldSize,
} from "./world";
import { cloneWorld, exportWorld, inspectJavaWorld, worldNameArgument } from "./worldTools";

const ACTIVE_MARK = "✓";

const nameOf = (path: string) => {
	return path.split("/").at(-1) ?? "";
};

const uploadedWorldDirectory = async (context: Bridge.Context, source: string) => {
	const found = await findLevelDirectories(context, source);

	if (found.length === 0) {
		throw new BridgeUserError({
			ar: "ما لقينا ملف level.dat جوّا الملف المضغوط، تأكد إنك ضاغط مجلد الماب نفسه",
			en: "the archive holds no level.dat, make sure you zipped the world folder itself",
		});
	}

	if (found.includes(source)) {
		return source;
	}

	const main = found.filter(
		(candidate) => !found.some((other) => candidate === `${other}_nether` || candidate === `${other}_the_end`),
	);
	const nested = main.at(0);

	if (main.length > 1 || nested === undefined) {
		throw new BridgeUserError({
			ar: "الملف فيه أكثر من ماب، ارفع كل ماب لحالها",
			en: "the archive holds more than one world, upload them one at a time",
		});
	}

	return nested;
};

const refuseActiveWorld = async (context: Bridge.Context, name: string) => {
	if ((await activeWorld(context)) !== name) {
		return;
	}

	throw new BridgeUserError({
		ar: "ما تقدر تحذف الماب الشغّالة، فعّل ماب ثانية أول",
		en: "you cannot delete the active world, activate another one first",
	});
};

export const worlds: Bridge.Collection = {
	kind: BridgeKind.Collection,
	protectedActions: [
		"add",
		"activate",
		"clone",
		"delete",
		"resetNether",
		"resetEnd",
		"export",
	],

	async list(context) {
		const active = await activeWorld(context);
		const rows: Bridge.Row[] = [];

		for (const name of await discoverWorlds(context)) {
			rows.push({
				id: name,
				name,
				size: formatByteSize(await worldSize(context, name)),
				active: name === active ? ACTIVE_MARK : "",
				path: `.serverk-exports/${name}.zip`,
			});
		}

		return rows;
	},

	async add(context, input) {
		const source = relativeUploadPath(input);

		if (source === null || !isUnder(source, WORLD_STAGING) || !(await context.files.exists(source))) {
			throw new BridgeUserError({
				ar: "ما لقينا الملفات اللي رفعتها",
				en: "the uploaded files were not found",
			});
		}

		const directory = await uploadedWorldDirectory(context, source);
		await inspectJavaWorld(context, directory);
		const name = safeWorldName(nameOf(directory));

		if (name.length === 0) {
			throw new BridgeUserError({
				ar: "سمّ مجلد الماب بأحرف إنجليزية وأرقام وارفعه مرة ثانية",
				en: "name the world folder with latin letters and digits and upload it again",
			});
		}

		for (const path of worldPaths(name)) {
			if (await context.files.exists(path)) {
				throw new BridgeUserError({
					ar: `عندك ماب اسمها "${name}"، غيّر اسم المجلد وارفعه`,
					en: `a world named "${name}" is already here`,
				});
			}
		}

		const sources = worldPaths(directory);
		const destinations = worldPaths(name);
		for (const [index, path] of sources.entries()) {
			const destination = destinations[index];
			if (destination && (await context.files.exists(path))) {
				await context.files.move(path, destination);
			}
		}

		if (directory !== source) {
			await context.files.remove(source);
		}

		context.log("added a world", {
			world: name,
		});
	},

	actions: {
		async export(context, row) {
			await exportWorld(context, row.id);
		},
		async clone(context, row, args) {
			await cloneWorld(context, row.id, worldNameArgument(args.name));
		},
		async activate(context, row) {
			if ((await activeWorld(context)) === row.id) {
				throw new BridgeUserError({
					ar: "هذي الماب شغّالة أصلًا",
					en: "this world is already the active one",
				});
			}

			await setActiveWorld(context, row.id);

			context.log("switched the active world", {
				world: row.id,
			});
		},

		async delete(context, row) {
			await refuseActiveWorld(context, row.id);

			for (const path of worldPaths(row.id)) {
				await context.files.remove(path);
			}

			context.log("deleted a world", {
				world: row.id,
			});
		},

		async resetNether(context, row) {
			const { nether } = worldDimensions(row.id, await installedLayout(context));

			await context.files.remove(nether);

			context.log("reset the nether", {
				world: row.id,
				path: nether,
			});
		},

		async resetEnd(context, row) {
			const { end } = worldDimensions(row.id, await installedLayout(context));

			await context.files.remove(end);

			context.log("reset the end", {
				world: row.id,
				path: end,
			});
		},
	},
};
