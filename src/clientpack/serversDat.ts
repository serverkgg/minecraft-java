enum NbtTag {
	End = 0x00,
	String = 0x08,
	List = 0x09,
	Compound = 0x0a,
}

export interface ServersDatEntry {
	name: string;
	ip: string;
}

const modifiedUtf8Of = (text: string) => {
	const bytes: number[] = [];

	for (let index = 0; index < text.length; index += 1) {
		const unit = text.charCodeAt(index);

		if (unit >= 0x01 && unit <= 0x7f) {
			bytes.push(unit);
		} else if (unit <= 0x7_ff) {
			bytes.push(0xc0 | (unit >> 6), 0x80 | (unit & 0x3f));
		} else {
			bytes.push(0xe0 | (unit >> 12), 0x80 | ((unit >> 6) & 0x3f), 0x80 | (unit & 0x3f));
		}
	}

	return bytes;
};

export const serversDatOf = (entries: ServersDatEntry[]) => {
	const bytes: number[] = [];
	const count = entries.length;

	const text = (value: string) => {
		const encoded = modifiedUtf8Of(value);

		bytes.push(encoded.length >> 8, encoded.length & 0xff, ...encoded);
	};

	const stringTag = (name: string, value: string) => {
		bytes.push(NbtTag.String);
		text(name);
		text(value);
	};

	bytes.push(NbtTag.Compound);
	text("");
	bytes.push(NbtTag.List);
	text("servers");
	bytes.push(NbtTag.Compound, count >>> 24, (count >>> 16) & 0xff, (count >>> 8) & 0xff, count & 0xff);

	for (const entry of entries) {
		stringTag("name", entry.name);
		stringTag("ip", entry.ip);
		bytes.push(NbtTag.End);
	}

	bytes.push(NbtTag.End);

	return new Uint8Array(bytes);
};
