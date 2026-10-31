// Child processes get no credentials, and none of the GIT_* variables a Git
// hook exports, which would aim Git at this checkout instead of a test's own
// repository.
export const isolatedEnvironment = Object.fromEntries(
	Object.entries(process.env).filter(
		([name]) =>
			!name.startsWith("GIT_") &&
			!/(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|ACCESS_KEY|PRIVATE_KEY)/i.test(
				name,
			),
	),
);
