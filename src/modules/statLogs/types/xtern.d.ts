declare module 'xterm' {
    export interface ITerminalOptions {
      fontSize?: number;
      fontFamily?: string;
      cursorBlink?: boolean;
      theme?: any;
      cols?: number;
      rows?: number;
      scrollback?: number;
      convertEol?: boolean;
      padding?: number;
    }
  
    export class Terminal {
      constructor(options?: ITerminalOptions);
      open(container: HTMLElement): void;
      write(data: string | Uint8Array): void;
      writeln(data: string): void;
      onData(callback: (data: string) => void): void;
      onKey(callback: (key: { key: string; domEvent: KeyboardEvent }) => void): void;
      loadAddon(addon: any): void;
      dispose(): void;
      clear(): void;
      reset(): void;
      focus(): void;
      blur(): void;
      resize(columns: number, rows: number): void;
      refresh(start: number, end: number): void;
      options: ITerminalOptions;
    }
  }
  
  declare module 'xterm-addon-fit' {
    import { Terminal } from 'xterm';
    
    export class FitAddon {
      constructor();
      activate(terminal: Terminal): void;
      fit(): void;
      dispose(): void;
    }
  }
  
  declare module '*.css' {
    const classes: { [key: string]: string };
    export default classes;
  }