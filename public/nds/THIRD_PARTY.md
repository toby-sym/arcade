# Terceros, licencias y procedencia

Este repositorio es **GPL-3.0** (ver `LICENSE`). El motor es melonDS, que también es GPL-3.0, así que la
obligación de publicar el código fuente se mantiene: quien distribuya el `.wasm` debe poder obtener el código
correspondiente (este repositorio más el submódulo y los parches de `core/patches/`).

**Este repositorio no contiene ROM, BIOS, firmware ni ningún otro binario de Nintendo.** Lo que se enlaza en
`dist/melonds.wasm` es lo de la tabla.

## Código enlazado en `dist/melonds.wasm`

| Componente | Versión / referencia | Licencia | Origen | ¿Versionado aquí? |
|---|---|---|---|---|
| **melonDS DS** (núcleo libretro) | v1.4.0, `f394adba` | GPL-3.0 | submódulo `third_party/melonds-ds` | Sí (submódulo) |
| **melonDS** (motor, fork de JesseTG) | `16f127db…` | GPL-3.0 | descargado por CMake a `build/melonds/_deps/melonds-src` | No |
| **libretro-common** | pin de melonDS DS | MIT | descargado por CMake | No |
| **FreeBIOS** (reemplazo de la BIOS DS, Normmatt) | incluido en melonDS (`src/FreeBIOS*`) | libre, no es contenido de Nintendo | fuente de melonDS | No |
| **date** (Howard Hinnant) | pin de melonDS | MIT | descargado por CMake | No |
| **{fmt}** | pin de melonDS | MIT | descargado por CMake | No |
| **glm** | pin de melonDS | MIT | descargado por CMake | No |
| **span-lite** | pin de melonDS | Boost Software License 1.0 | descargado por CMake | No |
| **yamc** | pin de melonDS | MIT | descargado por CMake | No |
| **pntr** | pin de melonDS | Zlib | descargado por CMake | No |
| **zlib** | pin de melonDS | Zlib | descargado por CMake | No |
| **teakra** (DSP del DSi) | incluido en melonDS | MIT | fuente de melonDS | No |
| **blip-buf** | incluido en melonDS | LGPL-2.1 | fuente de melonDS | No |
| **libslirp** | pin de melonDS | BSD-3-Clause | descargado por CMake; la red está **desactivada** en `build-core.sh` | No |
| **embed-binaries** | pin de melonDS DS | MIT (andoalon) | descargado por CMake | No |
| **Emscripten** (runtime y sysroot: musl, libc++, compiler-rt) | imagen `emscripten/emsdk:6.0.13` | MIT / BSD / LLVM | genera `dist/melonds.js` | No (generado) |

## Otros archivos del repositorio

| Archivo | Licencia | Nota |
|---|---|---|
| `coi-sw.js` (opcional, para hostings sin cabeceras COOP/COEP) | MIT | Implementación propia de la técnica `coi-serviceworker` de Guido Zuidhof (`gzuidhof/coi-serviceworker`, MIT); no se enlaza en el `.wasm` |

Los `.wasm`/`.js` de `dist/` son artefactos de compilación y **no** se versionan (`.gitignore`).

## Material de pruebas

| Material | Licencia | Nota |
|---|---|---|
| `nmap.nds` (normalmappingds, `rmn20`) | CC0 | Homebrew; no se versiona (`tests/artifacts/` está ignorado) |
| ROM de tono y ROM de integración | CC0, generadas desde fuentes propias (`tests/homebrew/`) | Se compilan con `python3` + `gcc-arm-none-eabi` |
| ROM comerciales del usuario | — | Solo en local (la carpeta de ROMs del usuario); nunca se suben |

## La web app (fuera de este repositorio)

`<web-app>` no forma parte de este repositorio, pero por completitud:

| Componente | Licencia | Uso |
|---|---|---|
| `@thenick775/mgba-wasm` | MPL-2.0 | reproductor GBA |
| `socket.io` | MIT | señalización del multijugador |

## Cómo cumplir la GPL al publicar

1. Publica el código de **este** repositorio y deja los submódulos y parches accesibles (o inclúyelos en el paquete).
2. Incluye `LICENSE`, este `THIRD_PARTY.md` y el aviso de que el binario es GPL-3.0.
3. Si modificas el núcleo, publica los parches (`core/patches/`) o el árbol modificado.
4. No distribuyas ROM, BIOS ni firmware de Nintendo: no están aquí y no deben añadirse.
