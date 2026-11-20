# Nintendo DS player component

This standalone page is a GPL-3.0 component served at `/nds/`. Arcade's home page links to it; the React app does not import or bundle its emulator code into the Arcade game bundle.

Connect a standard Bluetooth or USB gamepad for D-pad or left-stick movement, face buttons, shoulders, Start, and Select. iPhone and iPad users pair a controller in Bluetooth settings, then press a button after loading a game. The Fullscreen control enters native fullscreen where the browser supports it and expands to a safe-area-aware viewport in iOS Safari.

The player uses melonDS DS 1.4.0 through the melonDS Web browser port. See [`LICENSE`](LICENSE), [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), and [`UPSTREAM.txt`](UPSTREAM.txt) for the license, linked-component notices, and exact source revisions. The corresponding source and build instructions are available from the pinned upstream revision listed there. The page and Arcade-specific integration code are in this directory.

This component-specific license does not place Arcade's own code under GPL-3.0.
