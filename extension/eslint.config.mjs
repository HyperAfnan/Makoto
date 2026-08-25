import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["build/**", "node_modules/**"] },
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			globals: {
				process: "readonly",
				console: "readonly",
				chrome: "readonly",
				document: "readonly",
				window: "readonly",
				fetch: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				AbortController: "readonly",
				TextDecoder: "readonly",
				Uint8Array: "readonly",
				DOMException: "readonly",
				HTMLAnchorElement: "readonly",
				Element: "readonly",
				location: "readonly",
			},
		},
		rules: {
			"no-useless-escape": "off",
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
		},
	},
);
