import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { installedLayout } from "../install/installLayout";
import { formatByteSize, isUnder, relativeUploadPath, WORLD_STAGING } from "../shared";
import {
	activeWorld,
	discoverWorlds,
	findLevelDirectories,
	freeWorldName,
	mainLevelDirectories,
	setActiveWorld,
	type WorldImport,
	worldBaseName,
	worldDimensions,
	worldImportNotice,
	worldPaths,
	worldSize,
} from "./world";
import { cloneWorld, exportWorld, inspectJavaWorld, worldNameArgument } from "./worldTools";

const ACTIVE_MARK = "✓";

const nameOf = (path: string) => {
	return path.split("/").at(-1) ?? "";
};

const uploadedWorldDirectories = async (context: Bridge.Context, source: string) => {
	const found = await findLevelDirectories(context, source);

	if (found.length === 0) {
		throw new BridgeUserError({
			ar: "ما لقينا ملف level.dat جوّا الملف المضغوط، تأكد إنك ضاغط مجلد الماب نفسه",
			en: "the archive holds no level.dat, make sure you zipped the world folder itself",
		});
	}

	if (found.includes(source)) {
		return [
			source,
		];
	}

	return mainLevelDirectories(found);
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
		"delete",
		"resetNether",
		"resetEnd",
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

		const directories = await uploadedWorldDirectories(context, source);

		for (const directory of directories) {
			await inspectJavaWorld(context, directory);
		}

		const imported: WorldImport[] = [];

		for (const directory of directories) {
			const folder = nameOf(directory);
			const name = await freeWorldName(context, worldBaseName(folder));

			const sources = worldPaths(directory);
			const destinations = worldPaths(name);
			for (const [index, path] of sources.entries()) {
				const destination = destinations[index];
				if (destination && (await context.files.exists(path))) {
					await context.files.move(path, destination);
				}
			}

			imported.push({
				folder,
				name,
			});

			context.log("added a world", {
				folder,
				world: name,
			});
		}

		if (!directories.includes(source)) {
			await context.files.remove(source);
		}

		const notice = worldImportNotice(imported);

		return notice
			? {
					notice,
				}
			: undefined;
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
