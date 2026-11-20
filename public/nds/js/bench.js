// Phase 9 measurement core + wiring for tests/bench.html.
//
// The demo's own "Medir rendimiento" button (demo/demo.js, "benchmark" block) already implements the agreed protocol:
// sample the worker/audio stats every 250 ms for N seconds, keep one sample per new worker window (~500 ms), then
// summarise. That code is COPIED here instead of extracted so demo/demo.js (which carries the user's uncommitted
// changes) is not refactored; bench.html uses this module and bench-browser.mjs drives the demo button with the same
// protocol. Both are documented in tests/DEVIATIONS.md.
//
// This file also owns the small pieces of DOM wiring of tests/bench.html (attachBenchPage) so the page itself has a
// one-line module script and everything is syntax-checked with `node --check js/bench.js`.
import { VideoPlayer } from "./player.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** min / avg / p5 / max of a numeric list (same shape as the demo's stat()). */
export function stat(xs) {
  const a = [...xs].sort((x, y) => x - y);
  const n = a.length;
  return n ? { min: a[0], avg: a.reduce((s, v) => s + v, 0) / n, p5: a[Math.floor(n * 0.05)], max: a[n - 1] } : { min: 0, avg: 0, p5: 0, max: 0 };
}

/** Compares the emulator's measured fps with what the chosen speed needs (59.83 fps x speed); same text as the demo. */
export function verdict(speed, avg) {
  if (!speed) return `Veredicto: «Sin límite» es el máximo que da el equipo: ${avg.toFixed(0)} fps = ${(avg / 59.83).toFixed(1)}x tiempo real (el audio va en silencio).`;
  const need = 59.83 * speed;
  const r = avg / need;
  const label = speed === 1 ? "tiempo real" : `${String(speed).replace(".", ",")}x`;
  if (r >= 0.96) return `Veredicto: llega a ${label} (media ${avg.toFixed(1)} fps, objetivo ${need.toFixed(1)}).`;
  if (r >= 0.84) return `Veredicto: justo para ${label} (media ${avg.toFixed(1)} fps de ${need.toFixed(1)}): irá algo lento y el audio puede cortarse de vez en cuando.`;
  return `Veredicto: NO llega a ${label} en esta escena (media ${avg.toFixed(1)} fps de ${need.toFixed(1)}): irá más lento de lo pedido y el audio se cortará. Prueba una velocidad menor.`;
}

/** GPU name through WEBGL_debug_renderer_info (browser only). */
export function gpuInfo() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return "sin WebGL2";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch {
    return "n/d";
  }
}

/** Test-only synthetic CPU shortage: posts the worker's debugStall hook on a timer (nothing in the emulator changes). */
export function startSyntheticLoad(player, { dutyMs = 50, stallMs = 7 } = {}) {
  stopSyntheticLoad(player);
  player.__benchSynthetic = setInterval(() => player.worker?.postMessage({ type: "debugStall", ms: stallMs }), dutyMs);
}
export function stopSyntheticLoad(player) {
  if (player?.__benchSynthetic) {
    clearInterval(player.__benchSynthetic);
    player.__benchSynthetic = null;
  }
}

/**
 * Measures one configuration and returns a structured result plus the text report (formatReport).
 * @param {import("./player.js").VideoPlayer} player
 * @param {{label?:string, speed?:number, secs?:number, drcMode?:string, settleMs?:number, synthetic?:{dutyMs?:number, stallMs?:number}|null, onProgress?:(leftSeconds:number)=>void, opt?:{publishDecimation?:boolean, savesCadence?:boolean, yieldEvery2?:boolean}|null, profile?:boolean}} opts
 */
export async function measureConfig(player, { label = "", speed = 1, secs = 20, drcMode = "always", settleMs = 1500, synthetic = null, onProgress = () => {}, opt = null, profile = false } = {}) {
  player.setAudioDynamicRate(drcMode);
  player.setSpeed(speed);
  if (opt) player.worker?.postMessage({ type: "debugOpt", set: opt }); // test-only A/B switch (Phase 9b)
  await sleep(settleMs); // the worker applies the speed and re-targets the audio cushion; not part of the measurement
  if (synthetic) startSyntheticLoad(player, synthetic);
  if (profile) player.worker?.postMessage({ type: "debugProfile", on: true }); // test-only loop profiler
  const emuFps = [], emuMs = [], drawFps = [], abuf = [], drcs = [];
  const profSamples = [];
  const first = player.getStats();
  const a0 = first.audio;
  const t0 = performance.now();
  let last = -1;
  await new Promise((resolve) => {
    const id = setInterval(() => {
      const s = player.getStats();
      const left = Math.max(0, secs - (performance.now() - t0) / 1000);
      // the worker publishes one window average every ~500 ms: keep one sample per new window
      if (s.frameCount !== last) {
        last = s.frameCount;
        emuFps.push(s.emuFps);
        emuMs.push(s.emuMs);
        drawFps.push(s.drawFps);
        if (s.audio) {
          abuf.push(s.audio.bufferMs);
          drcs.push(s.audio.drc);
        }
        if (profile) {
          const pr = player.workerStats?.prof; // set by the worker only while debugProfile is on
          if (pr) profSamples.push(pr);
        }
      }
      onProgress(left);
      if (left <= 0) {
        clearInterval(id);
        resolve();
      }
    }, 250);
  });
  if (profile) player.worker?.postMessage({ type: "debugProfile", on: false });
  if (synthetic) stopSyntheticLoad(player);
  const s = player.getStats();
  const a1 = s.audio;
  const f = stat(emuFps), m = stat(emuMs), d = stat(drawFps), b = stat(abuf), k = stat(drcs);
  const calls = s.rafCalls - first.rafCalls;
  const drawn = s.drawnFrames - first.drawnFrames;
  const gaps = calls ? s.rafGaps.slice(-calls) : [];
  const costs = drawn ? s.drawCosts.slice(-drawn) : [];
  const g = stat(gaps);
  const c = stat(costs);
  const gp95 = gaps.length ? [...gaps].sort((x, y) => x - y)[Math.floor(gaps.length * 0.95)] : 0;
  const late = gaps.filter((v) => v > 20).length;
  // Phase 9b: aggregate the worker loop profiler windows (ms per emulated frame) when it was on.
  let prof = null;
  if (profile && profSamples.length) {
    const sum = (key) => profSamples.reduce((a, s) => a + (s[key] ?? 0), 0);
    const frames = sum("frames");
    const windowMs = sum("windowMs");
    const per = (key) => (frames ? sum(key) / frames : 0);
    const msPerFrame = { core: per("core"), publish: per("publish"), audio: per("audio"), saves: per("saves"), yield: per("yield"), wait: per("wait") };
    const measured = Object.values(msPerFrame).reduce((a, b) => a + b, 0);
    const cadence = frames ? windowMs / frames : 0;
    prof = { samples: profSamples.length, frames, iterations: sum("iterations"), windowMs, msPerFrame, msPerFrameMeasured: measured, msPerFrameCadence: cadence, msPerFrameUnaccounted: cadence - measured, opt: profSamples.at(-1)?.opt ?? null };
  }
  const result = {
    label,
    speed,
    drcMode,
    secs,
    synthetic,
    opt,
    profile,
    prof,
    date: new Date().toISOString(),
    emuFps: f,
    emuMs: m,
    drawFps: d,
    audioBuffer: b,
    drc: k,
    slowWindows: emuMs.filter((v) => v > 16.7).length,
    samples: emuMs.length,
    audio: a1 && a0
      ? {
          underruns: a1.underrunEvents - a0.underrunEvents,
          underrunFrames: a1.underrunFrames - a0.underrunFrames,
          overruns: a1.overrunFrames - a0.overrunFrames,
          trimmed: a1.trimmedFrames - a0.trimmedFrames,
          catchup: a1.catchupFrames - a0.catchupFrames,
          drcEnd: a1.drc,
          drcMin: k.min,
          drcAvg: k.avg,
          bufferMin: b.min,
          bufferAvg: b.avg,
          bufferMax: b.max,
          contextState: a1.contextState,
        }
      : null,
    raf: { calls, avg: g.avg, hz: g.avg ? 1000 / g.avg : 0, p95: gp95, max: g.max, latePct: gaps.length ? (late * 100) / gaps.length : 0, empty: s.rafEmpty - first.rafEmpty, queueDrops: s.queueDrops - first.queueDrops },
    draw: { avgMs: c.avg, maxMs: c.max, drawn },
    ringDropped: s.ring.dropped - first.ring.dropped,
    workers: s.workers,
    backend: s.backend,
    cpuThreads: navigator.hardwareConcurrency,
    gpu: gpuInfo(),
    verdict: verdict(+speed, f.avg),
  };
  return result;
}

/** Text report in the same style as the demo's "Medir rendimiento" output. */
export function formatReport(r) {
  return [
    `Medición de ${r.secs} s · ${r.date}`,
    `Velocidad ${+r.speed ? String(r.speed).replace(".", ",") + "x" : "sin límite"} · hilos 3D: ${r.workers} · dibujo: ${r.backend} · audioDynamicRate: ${r.drcMode}${r.synthetic ? " · CPU justa sintética (debugStall)" : ""}`,
    `CPU: ${r.cpuThreads} hilos lógicos · GPU: ${r.gpu}`,
    `Emulador (fps):        mín ${r.emuFps.min.toFixed(1)} · p5 ${r.emuFps.p5.toFixed(1)} · media ${r.emuFps.avg.toFixed(1)} · máx ${r.emuFps.max.toFixed(1)}`,
    `ms por fotograma:      media ${r.emuMs.avg.toFixed(2)} · peor ventana ${r.emuMs.max.toFixed(2)} (límite 16,70 para 1x) · ventanas lentas ${r.slowWindows}/${r.samples}`,
    `Dibujado (fps):        mín ${r.drawFps.min.toFixed(1)} · media ${r.drawFps.avg.toFixed(1)}`,
    r.audio
      ? `Audio: búfer mín ${r.audio.bufferMin.toFixed(0)} · media ${r.audio.bufferAvg.toFixed(0)} · máx ${r.audio.bufferMax.toFixed(0)} ms · underruns +${r.audio.underruns} (silencio ${r.audio.underrunFrames} muestras) · overruns +${r.audio.overruns} · acelerado +${r.audio.catchup} · DRC media ${r.audio.drcAvg.toFixed(3)}`
      : "Audio: sin datos (toca la página para activarlo)",
    `requestAnimationFrame: ${r.raf.calls} llamadas · intervalo medio ${r.raf.avg.toFixed(1)} ms (≈${r.raf.hz.toFixed(0)} Hz) · p95 ${r.raf.p95.toFixed(1)} · máx ${r.raf.max.toFixed(1)} · >20 ms: ${r.raf.latePct.toFixed(0)} % · sin fotograma nuevo: ${r.raf.empty} · descartes en cola: ${r.raf.queueDrops}`,
    `draw() en CPU: media ${r.draw.avgMs.toFixed(2)} ms · máx ${r.draw.maxMs.toFixed(2)} ms (${r.draw.drawn} dibujados)`,
    r.prof
      ? `Perfil del bucle (${r.prof.frames} fotogramas, ${r.prof.samples} ventanas): core ${r.prof.msPerFrame.core.toFixed(2)} · publish ${r.prof.msPerFrame.publish.toFixed(2)} · audio ${r.prof.msPerFrame.audio.toFixed(2)} · saves ${r.prof.msPerFrame.saves.toFixed(3)} · yield ${r.prof.msPerFrame.yield.toFixed(2)} · wait ${r.prof.msPerFrame.wait.toFixed(2)} · sin medir ${r.prof.msPerFrameUnaccounted.toFixed(2)} ms/fotograma (cadencia real ${r.prof.msPerFrameCadence.toFixed(2)} ms)`
      : "",
    `Fotogramas del buffer de vídeo descartados: +${r.ringDropped}`,
    r.verdict,
    r.drawFps.avg < 10 ? "Aviso: el dibujado fue muy bajo; la pestaña probablemente estaba en segundo plano. Mídelo con la pestaña visible." : "",
  ].filter(Boolean);
}

/** DOM wiring of tests/bench.html. */
export function attachBenchPage(doc = document) {
  const $ = (id) => doc.getElementById(id);
  const canvas = $("screen");
  const msg = $("msg");
  const say = (text, error = false) => {
    msg.textContent = text;
    msg.classList.toggle("err", error);
  };
  let player = null;
  let busy = false;
  const results = [];

  async function loadRom(file) {
    if (busy) return;
    say("Cargando…");
    if (player) {
      await player.dispose().catch(() => {});
      player = null;
    }
    try {
      player = await VideoPlayer.create({
        canvas,
        container: $("stage"),
        moduleUrl: new URL("../dist/melonds.js", import.meta.url),
        backend: $("canvas2d").checked ? "canvas2d" : "auto",
        threadedRenderer: $("threaded").checked,
        audioLatencyMs: +$("latency").value,
        audioIgnoreActivation: new URLSearchParams(location.search).get("autoplay") === "1",
      });
      player.on("error", (e) => say(`${e.code ?? "error"}: ${e.message}`, true));
      player.attachKeyboard();
      await player.loadRom(new Uint8Array(await file.arrayBuffer()));
      player.start();
      $("measure").disabled = $("drcCompare").disabled = false;
      $("s-info").textContent = `backend ${player.backend} · ${player.getStats().workers} hilos pthread · ROM ${file.name}`;
      say("");
    } catch (error) {
      say(`${error.code ?? "error"}: ${error.message}`, true);
      console.error(error);
    }
  }

  function addResult(r) {
    results.push(r);
    const cells = [
      r.label,
      r.emuFps.avg.toFixed(1),
      r.emuMs.avg.toFixed(2),
      r.drawFps.avg.toFixed(1),
      r.audio ? r.audio.bufferAvg.toFixed(0) : "—",
      r.audio ? String(r.audio.underruns) : "—",
      r.audio ? r.audio.drcAvg.toFixed(3) : "—",
    ];
    const tr = doc.createElement("tr");
    for (const c of cells) {
      const td = doc.createElement("td");
      td.textContent = c;
      tr.append(td);
    }
    $("rows").append(tr);
    $("out").textContent = formatReport(r);
    $("download").disabled = false;
  }

  async function measure(speed, drcMode, synthetic) {
    if (!player || busy) return null;
    busy = true;
    try {
      const oldBehavior = !!doc.getElementById("oldBehavior")?.checked;
      const profile = !!doc.getElementById("profileLoop")?.checked;
      const r = await measureConfig(player, {
        speed,
        drcMode,
        synthetic,
        profile,
        // Test-only A/B switch: forcing "old" uses the same worker code with the three loop optimizations off.
        opt: oldBehavior ? { publishDecimation: false, savesCadence: false, yieldEvery2: false } : null,
        secs: +$("secs").value || 20,
        label: `${speed === 0 ? "sin límite" : String(speed).replace(".", ",") + "x"} · DRC ${drcMode}${synthetic ? " · CPU justa" : ""}${oldBehavior ? " · optimizaciones OFF" : ""}${profile ? " · perfil" : ""} · ${$("secs").value} s`,
        onProgress: (left) => ($("measure").textContent = `Midiendo… ${left.toFixed(0)} s`),
      });
      addResult(r);
      say("");
      return r;
    } catch (error) {
      say(`${error.code ?? "error"}: ${error.message}`, true);
      return null;
    } finally {
      busy = false;
      $("measure").textContent = "Medir";
    }
  }

  $("rom").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) loadRom(f);
  });
  $("measure").addEventListener("click", async () => {
    const sel = $("speed").value;
    const speeds = sel === "all" ? [1, 1.5, 2, 0] : [+sel];
    const synthetic = $("synthetic").checked ? { dutyMs: 50, stallMs: 7 } : null;
    for (const speed of speeds) await measure(speed, $("drc").value, synthetic);
  });
  $("drcCompare").addEventListener("click", async () => {
    // The user decision 0.0 #4 is validated here: with a CPU that is just short, "always" must not cut the audio.
    const synthetic = { dutyMs: 50, stallMs: 7 };
    await measure(1, "always", synthetic);
    await measure(1, "off", synthetic);
    await measure(1, "always", null); // and with the CPU on time the control must not change anything
  });
  $("clear").addEventListener("click", () => {
    results.length = 0;
    $("rows").replaceChildren();
    $("out").textContent = "";
    $("download").disabled = true;
  });
  $("download").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ date: new Date().toISOString(), results }, null, 2)], { type: "application/json" });
    const a = Object.assign(doc.createElement("a"), { href: URL.createObjectURL(blob), download: "bench-phase9.json" });
    a.click();
    URL.revokeObjectURL(a.href);
  });
  say(self.crossOriginIsolated ? "" : "Esta página no está aislada (COOP/COEP): sírvela con `npm run serve`.");
}
