import {
	type Bridge,
	BridgeNetError,
	BridgeSecretError,
	BridgeUserError,
	describeDownloadFailure,
} from "@serverkgg/bridge";

export enum LookupFailure {
	Missing = "missing",
	Refused = "refused",
	Unreachable = "unreachable",
}

const MISSING_STATUSES: readonly number[] = [
	404,
	410,
];

const REFUSED_STATUSES: readonly number[] = [
	401,
	403,
];

const SERVER_ERROR_STATUS = 500;

export const lookupFailureOf = (error: unknown): LookupFailure | null => {
	if (error instanceof BridgeSecretError) {
		return LookupFailure.Refused;
	}

	if (!(error instanceof BridgeNetError)) {
		return null;
	}

	if (error.status === null || error.status >= SERVER_ERROR_STATUS) {
		return LookupFailure.Unreachable;
	}

	if (MISSING_STATUSES.includes(error.status)) {
		return LookupFailure.Missing;
	}

	if (REFUSED_STATUSES.includes(error.status)) {
		return LookupFailure.Refused;
	}

	return null;
};

export const describeLookupFailure = (error: unknown, subject: Bridge.Text): Bridge.Text => {
	return {
		ar: describeDownloadFailure(error, subject.ar).ar,
		en: describeDownloadFailure(error, subject.en).en,
	};
};

export const explainLookup = async <Result>(
	run: () => Promise<Result>,
	missing: Bridge.Text,
	subject: Bridge.Text,
): Promise<Result> => {
	try {
		return await run();
	} catch (error) {
		const failure = lookupFailureOf(error);

		if (failure === null || error instanceof BridgeSecretError) {
			throw error;
		}

		throw new BridgeUserError(failure === LookupFailure.Missing ? missing : describeLookupFailure(error, subject), {
			cause: error,
		});
	}
};
