// Minimal flat config; per-workspace configs can extend this later.
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**"
    ]
  }
];
