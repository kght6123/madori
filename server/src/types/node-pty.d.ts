declare module "node-pty" {
  interface IPty {
    onData(callback: (data: Buffer) => void): IDisposable;
    write(data: Buffer | string): void;
  }
}
