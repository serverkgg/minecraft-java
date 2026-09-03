export const INSTALL_REQUEST_BUDGET = 100;

export const INSTALL_REQUEST_WINDOW_MS = 60_000;

export interface RequestPacer {
	acquire(): Promise<void>;
}

const wait = (ms: number) => {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

export const createRequestPacer = (
	budget = INSTALL_REQUEST_BUDGET,
	windowMs = INSTALL_REQUEST_WINDOW_MS,
): RequestPacer => {
	const taken: number[] = [];

	return {
		async acquire() {
			for (;;) {
				const at = Date.now();
				const cutoff = at - windowMs;

				while ((taken.at(0) ?? at) <= cutoff) {
					taken.shift();
				}

				if (taken.length < budget) {
					taken.push(at);

					return;
				}

				await wait((taken.at(0) ?? at) + windowMs - at);
			}
		},
	};
};
