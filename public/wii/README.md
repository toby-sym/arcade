# Wii & GameCube cabinet component

Arcade bundles [wasm-dolphin](https://github.com/dougchansan/wasm-dolphin), a browser build of Dolphin for GameCube and Wii, as a separate GPL-2.0-or-later component. Dolphin itself is GPL-2.0-or-later. The license text is in [`LICENSE`](LICENSE). This notice applies to the emulator component; it does not relicense Arcade's own source code.

The browser host was taken from wasm-dolphin commit [`08570dc95cc793688fae58d59678f5c2882bffaf`](https://github.com/dougchansan/wasm-dolphin/tree/08570dc95cc793688fae58d59678f5c2882bffaf). Its bundled Dolphin core is built from Dolphin commit [`e22551eae1c84a7e4d0b6a5c519ef4ed4ef69df1`](https://github.com/dolphin-emu/dolphin/commit/e22551eae1c84a7e4d0b6a5c519ef4ed4ef69df1), with the exact patches, shim, and provenance pinned by [`dolphin-source.lock.json`](dolphin-source.lock.json). The matching complete corresponding source archive is attached to each Arcade GitHub release as `wasm-dolphin-corresponding-source.tar.gz`.

The emulator runs locally in the browser and accepts game files selected by the player. Arcade does not distribute game images, BIOS files, or copyrighted game data. Wii Remote input is not implemented; Wii compatibility is partial and depends on the title and device.
