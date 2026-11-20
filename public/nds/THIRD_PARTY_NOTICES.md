# Nintendo DS player notices

The standalone player at `/nds/` uses the melonDS Web browser port, built from source revision [`37949881cd6fb6240d69818d4fa899dd812b9cf5`](https://github.com/soyangelromero/melonds-wasm/tree/37949881cd6fb6240d69818d4fa899dd812b9cf5). Its melonDS DS core is pinned to submodule revision [`f394adbacb5722ee97c1b37c8064da9a25818310`](https://github.com/JesseTG/melonds-ds/tree/f394adbacb5722ee97c1b37c8064da9a25818310).

The DS core, melonDS, and this standalone player component are distributed under GPL-3.0. The full license is in [`LICENSE`](LICENSE). The upstream repository provides the corresponding source and build instructions; Arcade's player page and integration source are included in this directory.

The build also uses libretro-common (MIT), date (MIT), fmt (MIT), glm (MIT), span-lite (Boost Software License 1.0), yamc (MIT), pntr (zlib), zlib (zlib), teakra (MIT), blip-buf (LGPL-2.1), libslirp (BSD-3-Clause), embed-binaries (MIT), and Emscripten (MIT, BSD, and LLVM licenses). melonDS generates its own FreeBIOS; this app does not include Nintendo BIOS files.

See [`THIRD_PARTY.md`](THIRD_PARTY.md) for the upstream dependency table, patch list, and additional provenance details.
