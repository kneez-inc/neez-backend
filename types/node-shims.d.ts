type Buffer = any;

declare module 'node:fs' {
  export function readFileSync(path: string, options?: any): string;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
}

declare module 'node:crypto' {
  export function randomUUID(): string;
}

declare module 'node:url' {
  export class URL {
    constructor(input: string, base?: string | URL);
    pathname: string;
    searchParams: { get(name: string): string | null };
  }
}

declare module 'node:assert/strict' {
  const assert: {
    equal: (actual: any, expected: any, message?: string) => void;
    match: (actual: string, expected: RegExp | string, message?: string) => void;
    ok: (value: any, message?: string) => asserts value;
  };

  export = assert;
}

declare module 'node:test' {
  export type TestFunction = () => any | Promise<any>;

  export function test(name: string, fn: TestFunction): void;
  export function it(name: string, fn: TestFunction): void;
  export function describe(name: string, fn: TestFunction): void;
  export function beforeEach(fn: TestFunction): void;
  export function afterEach(fn: TestFunction): void;
}

declare module 'node:http' {
  export type IncomingMessage = any;
  export type ServerResponse = {
    writeHead: (statusCode: number, headers?: Record<string, string>) => ServerResponse;
    end: (data?: any) => void;
  } & Record<string, any>;

  export type Server = {
    listen: (port?: number, callback?: () => void) => Server;
    close: (callback?: (err?: Error) => void) => void;
    address: () => { port: number } | string | null;
  } & Record<string, any>;

  export function createServer(
    handler?: (req: IncomingMessage, res: ServerResponse) => void
  ): Server;
}

declare var Buffer: {
  from(input: string | ArrayBuffer | ArrayBufferView): Buffer;
  concat(list: Buffer[]): Buffer;
};

declare var process: {
  env: Record<string, string | undefined>;
};
