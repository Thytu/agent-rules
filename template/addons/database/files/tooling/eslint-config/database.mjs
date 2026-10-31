const databaseConfig = [
	{
		files: ["app/**/*.{js,jsx,ts,tsx}", "src/**/*.{js,jsx,ts,tsx}"],
		rules: {
			"no-restricted-syntax": [
				"error",
				{
					selector:
						"CallExpression[callee.object.name='sql'][callee.property.name='raw']",
					message:
						"sql.raw() inserts text unescaped. Use Drizzle's query builder or the sql template, which binds values; see docs/rules/data-access.md.",
				},
			],
		},
	},
];

export default databaseConfig;
