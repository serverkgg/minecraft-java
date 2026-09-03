import { describe, expect, test } from "bun:test";
import { parseModIds } from "./modIndex";

const NEOFORGE_MODS_TOML = `modLoader="javafml"
loaderVersion="[21,)"
license="LGPL-3.0"
issueTrackerURL="https://github.com/leclowndu93150/Wakes/issues"

[[mods]]
modId="wakes"
version="1.4.0"
displayName="Wakes"
authors="leclowndu93150"
description='''
Adds wakes and splashes to the water.
'''

[[dependencies.wakes]]
    modId="neoforge"
    type="required"
    versionRange="[21,)"
    ordering="NONE"
    side="BOTH"
`;

const FORGE_MODS_TOML = `modLoader = "javafml"
loaderVersion = "[47,)"

[[mods]]
    modId = "missingmodschecker"
    version = "1.1"

[[mods]]
    modId = "missingmodschecker_core"
    version = "1.1"
`;

const FABRIC_MOD_JSON = `{
  "schemaVersion": 1,
  "id": "wakes",
  "version": "1.4.0",
  "name": "Wakes",
  "environment": "client",
  "entrypoints": {
    "client": [
      "com.goby56.wakes.WakesClient"
    ]
  },
  "depends": {
    "fabricloader": ">=0.15.0",
    "minecraft": "~1.21"
  }
}
`;

const QUILT_MOD_JSON = `{
  "schema_version": 1,
  "quilt_loader": {
    "group": "com.goby56",
    "id": "wakes",
    "version": "1.4.0",
    "metadata": {
      "name": "Wakes"
    }
  }
}
`;

describe("reading the mod ids a jar declares", () => {
	test("reads the id out of a neoforge mods.toml", () => {
		expect(parseModIds("neoforge.mods.toml", NEOFORGE_MODS_TOML)).toEqual([
			"wakes",
		]);
	});

	test("reads every mods entry a forge mods.toml declares", () => {
		expect(parseModIds("mods.toml", FORGE_MODS_TOML)).toEqual([
			"missingmodschecker",
			"missingmodschecker_core",
		]);
	});

	test("reads the id out of a fabric.mod.json", () => {
		expect(parseModIds("fabric.mod.json", FABRIC_MOD_JSON)).toEqual([
			"wakes",
		]);
	});

	test("reads the id quilt hides one level down", () => {
		expect(parseModIds("quilt.mod.json", QUILT_MOD_JSON)).toEqual([
			"wakes",
		]);
	});

	test("reads a file the extract handed back by its full path", () => {
		expect(parseModIds(".serverk-staging/modindex/neoforge.mods.toml", NEOFORGE_MODS_TOML)).toEqual([
			"wakes",
		]);
	});

	test("leaves the loader a mod depends on out of the index", () => {
		expect(parseModIds("neoforge.mods.toml", NEOFORGE_MODS_TOML)).not.toContain("neoforge");
	});

	test("stays quiet on metadata it cannot make sense of", () => {
		expect(parseModIds("fabric.mod.json", "not json at all")).toEqual([]);
		expect(parseModIds("neoforge.mods.toml", '[[mods]]\ndisplayName="Wakes"\n')).toEqual([]);
		expect(parseModIds("pack.mcmeta", NEOFORGE_MODS_TOML)).toEqual([]);
	});
});
