// Single-producer / single-consumer triple buffer over one SharedArrayBuffer.
//
// Producer = emulation worker (RingWriter), consumer = main thread (RingReader). Wait-free on both sides, no locks,
// no tearing, and the consumer always sees the NEWEST complete frame (older unread frames are dropped, counted in `drops`).
//
// Layout of the SAB (all offsets multiples of 16):
//   [0, 64)            Int32 ctrl[16]
//                        ctrl[0] = "middle" word = slotIndex | (DIRTY ? 4 : 0)   (the only word both sides contend on)
//                        ctrl[1] = frames published   ctrl[2] = frames dropped (overwritten before being read)
//                        ctrl[3] = frames consumed
//   slot i at 64 + i * SLOT_BYTES:
//     Int32 hdr[8] = width, height, stride (bytes), rotation (0..3), frameNo, byteLength, geometrySerial, reserved
//     then MAX_FRAME_BYTES of pixels (XRGB8888 as the core delivers them, rows `stride` bytes apart)
//
// Ownership: of 3 slots, the writer owns one (`w`), the reader owns one (`r`), and `mid` is parked in ctrl[0].
//   writer publish:  fill slot w; hdr written; old = Atomics.exchange(ctrl[0], w | DIRTY); w = old & 3
//   reader poll:     if ctrl[0] has DIRTY: old = Atomics.exchange(ctrl[0], r); r = old & 3  (new frame is in slot r)
// Atomics.exchange is sequentially consistent, so every plain store the writer did to slot w and its header
// happens-before the reader's exchange that returns w. The writer never touches slot r and the reader never touches
// slot w, hence the frame the consumer is reading cannot change under it (no tearing), and nobody ever waits.
export const RING_SLOTS = 3;
// Largest frame the core can produce at resolution scale 1: MaxBufferWidth = 256*(3+1) = 1024,
// MaxBufferHeight = max(192*2+126, 192*3) = 576 (screenlayout.hpp). XRGB8888.
export const MAX_FRAME_WIDTH = 1024;
export const MAX_FRAME_HEIGHT = 576;
export const MAX_FRAME_BYTES = MAX_FRAME_WIDTH * MAX_FRAME_HEIGHT * 4;

const CTRL_BYTES = 64;
const SLOT_HDR_BYTES = 32;
const SLOT_BYTES = SLOT_HDR_BYTES + MAX_FRAME_BYTES;
const DIRTY = 4;
export const RING_BYTES = CTRL_BYTES + RING_SLOTS * SLOT_BYTES;

export function createRingBuffer() {
  const sab = new SharedArrayBuffer(RING_BYTES);
  new Int32Array(sab, 0, 16)[0] = 2; // slot 0 = writer, slot 1 = reader, slot 2 = middle (clean)
  return sab;
}

function slotViews(sab, i) {
  const base = CTRL_BYTES + i * SLOT_BYTES;
  return { hdr: new Int32Array(sab, base, 8), data: new Uint8Array(sab, base + SLOT_HDR_BYTES, MAX_FRAME_BYTES) };
}

export class RingWriter {
  constructor(sab) {
    this.ctrl = new Int32Array(sab, 0, 16);
    this.slots = Array.from({ length: RING_SLOTS }, (_, i) => slotViews(sab, i));
    this.w = 0;
    this.frameNo = 0;
  }

  /** Returns the bytes of the slot being written so the caller can copy straight into it (one copy, no staging). */
  get target() { return this.slots[this.w].data; }

  publish({ width, height, stride, rotation, geometrySerial = 0 }) {
    const byteLength = stride * height;
    if (byteLength > MAX_FRAME_BYTES) throw new RangeError(`frame ${width}x${height} stride ${stride} exceeds ring slot`);
    const { hdr } = this.slots[this.w];
    hdr[0] = width; hdr[1] = height; hdr[2] = stride; hdr[3] = rotation; hdr[4] = ++this.frameNo; hdr[5] = byteLength; hdr[6] = geometrySerial;
    const old = Atomics.exchange(this.ctrl, 0, this.w | DIRTY);
    if (old & DIRTY) Atomics.add(this.ctrl, 2, 1); // previous frame was never read
    this.w = old & 3;
    Atomics.add(this.ctrl, 1, 1);
  }
}

export class RingReader {
  constructor(sab) {
    this.ctrl = new Int32Array(sab, 0, 16);
    this.slots = Array.from({ length: RING_SLOTS }, (_, i) => slotViews(sab, i));
    this.r = 1;
  }

  /** Newest unread frame, or null. The returned `data` view stays valid (and untouched by the writer) until the next poll(). */
  poll() {
    if (!(Atomics.load(this.ctrl, 0) & DIRTY)) return null;
    const old = Atomics.exchange(this.ctrl, 0, this.r);
    this.r = old & 3;
    Atomics.add(this.ctrl, 3, 1);
    const { hdr, data } = this.slots[this.r];
    return {
      width: hdr[0], height: hdr[1], stride: hdr[2], rotation: hdr[3], frameNo: hdr[4], geometrySerial: hdr[6],
      data: data.subarray(0, hdr[5]),
    };
  }

  get stats() {
    return { published: Atomics.load(this.ctrl, 1), dropped: Atomics.load(this.ctrl, 2), consumed: Atomics.load(this.ctrl, 3) };
  }
}
