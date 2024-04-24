module.exports = exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		tsconfigRootDir: __dirname,
		project: ['./tsconfig-eslint.json'],
	},
	plugins: ['@typescript-eslint', 'import', "promise",],
	extends: [
		"plugin:import/errors",
		"plugin:import/warnings",
		"airbnb-base",
		"plugin:@typescript-eslint/recommended"
	],
	env: {
		node: true,
	},
	ignorePatterns: ['package-lock.json', 'package.json', 'node_modules/**', 'dist/**', 'examples/**', '**/*.js'],
	settings: {
		"import/resolver": {
			"node": {
			  "extensions": [".js", ".ts"]
			}
		 }
	},
	rules: {
		eqeqeq: 'error',
		indent: ["error", "tab", { "SwitchCase": 1 }],
		"@typescript-eslint/indent": ["off"],
		'@typescript-eslint/lines-between-class-members': 'off',
		"@typescript-eslint/comma-dangle": ["error", "never"],
		"arrow-parens": ["error", "always"],
		"brace-style": ["error", "allman"],
		"class-methods-use-this": ["off"],
		"comma-dangle": ["error", "never"],
		"global-require": ["off"],
		"import/extensions": ["off"],
		"import/newline-after-import": ["off"],
		"import/no-dynamic-require": ["off"],
		"import/no-extraneous-dependencies": ["off", { "devDependencies": true }],
		"linebreak-style": ["off"],
		"no-multiple-empty-lines": ["error", { "max": 1 }],
		"no-tabs": 0,
		"object-curly-newline": ["error", { "consistent": true }],
		"consistent-return": ["off"],
		"object-curly-spacing": ["error", "always"],
		"comma-dangle": "off",
		"react/jsx-filename-extension": [0],
		"import/extensions": "off",
		"import/no-unresolved": ["error", { "ignore": ["^meteor/", "^/"] }],
		"lines-between-class-members": [
			"error",
			"always",
			{ "exceptAfterSingleLine": true }
		],
		"operator-linebreak": ["error", "after"],
		"max-len": [
			"error",
			300,
			4,
			{
				"ignoreComments": true,
				"ignoreUrls": true
			}
		],
		"semi": "off",
		"@typescript-eslint/semi": ["error", "always"],
		"no-underscore-dangle": ["off"],
		"keyword-spacing": [
			"error",
			{
				"after": false,
				"before": true,
				"overrides": {
					"case": { "after": true },
					"const": { "after": true },
					"export": { "after": true },
					"from": { "after": true, "before": true },
					"import": { "after": true },
					"let": { "after": true },
					"return": { "after": true },
					"default": { "after": true }
				}
			}
		],
		"@typescript-eslint/no-explicit-any": ["off", {}],
		"no-shadow": "off",
		"@typescript-eslint/no-shadow": ["error", , { "ignoreTypeValueShadow": true }]
	},
};
