import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Kodda ataylab ishlatilmaydigan nom `_` bilan boshlanadi: `GET(_req)`,
      // `const { qarzlari: _qarzlari, ...qolgan } = t`. Bu kelishuv butun
      // loyihada amal qiladi — lint uni ogohlantirish deb hisoblamasin.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
    },
  },
  {
    // Node.js uchun CommonJS yordamchi skriptlar (`node scripts/x.js`)
    files: ["scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // .gitignore dagi vaqtinchalik fayllar — repoda yo'q, lint ham qilinmaydi
    "add_tovarlar_temp.js",
    "**/__*.ts",
    "**/__*.mjs",
  ]),
]);

export default eslintConfig;
