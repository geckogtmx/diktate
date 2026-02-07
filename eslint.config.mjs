import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'python/**',
            'docs/**',
            'assets/**',
            '*.json',
            '*.html',
            '*.css',
        ],
    },
    eslint.configs.recommended,
    prettier,
    // Apply recommended TS rules ONLY to .ts files
    ...tseslint.configs.recommended.map((config) => ({
        ...config,
        files: ['src/**/*.ts'],
    })),
    // TypeScript overrides (Only for .ts files)
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-require-imports': 'error',
            'no-undef': 'off',
        },
    },
    // JavaScript rules (Only for .js files)
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setImmediate: 'readonly',
                require: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                Buffer: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-undef': 'warn',
        },
    }
);
