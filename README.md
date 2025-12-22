# Kneez Backend

Backend assessment engine for the Kneez app. The service exposes lightweight HTTP endpoints for serving assessment questions and progressing a user session.

## Development

- Install Node.js 18+ (the project currently targets ES modules).
- Install dependencies (includes the local TypeScript compiler used by the test scripts):

```
npm install
```

- Build the project with:

```
npm run build
```

- Run the development server with:

```
npm run dev
```

## Testing

The test suite uses the built-in Node.js test runner. It compiles the TypeScript sources and test files to `dist-tests` before execution.

Run all tests:

```
npm test
```

This command performs a type check (`npm run lint`), compiles the test sources (`tsc -p tsconfig.test.json`), and then executes the compiled tests with `node --test`.
