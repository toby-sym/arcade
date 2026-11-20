# Third-party notices

## GBA Kit

Arcade uses version 0.9.0 of these MIT-licensed packages from Bruno Macabeus:

- `@gba-kit/gba-browser`
- `@gba-kit/gba-emulator`
- `@gba-kit/arm-emulator`
- `@gba-kit/debug-info`

Copyright (c) 2026 Bruno Macabeus

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Nintendo DS cabinet

The standalone player at `/nds/` uses melonDS DS 1.4.0 compiled to WebAssembly by the melonDS Web project. This component is distributed under GPL-3.0; its full license is available at [`public/nds/LICENSE`](public/nds/LICENSE), and its linked-component licenses and build provenance are in [`public/nds/THIRD_PARTY.md`](public/nds/THIRD_PARTY.md).

The corresponding melonDS Web source is pinned to commit `37949881cd6fb6240d69818d4fa899dd812b9cf5`, with melonDS DS submodule commit `f394adbacb5722ee97c1b37c8064da9a25818310`. Source and build instructions are available at [that upstream revision](https://github.com/soyangelromero/melonds-wasm/tree/37949881cd6fb6240d69818d4fa899dd812b9cf5). The Arcade player UI and integration source are in [`public/nds`](public/nds/).

This component-specific notice does not change the license status of Arcade's own source code. No root GPL-3.0 license has been added to Arcade.
