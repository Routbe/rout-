/**
 * Rasterlaag voor de OpenGraph-kaart.
 *
 * Discord, WhatsApp, Slack, iMessage en LinkedIn renderen geen SVG in een
 * deelkaart: ze verwachten PNG of JPEG. Daarom rasteriseren we dezelfde
 * vectorkaart met resvg (WebAssembly), wat overal werkt waar `fetch` bestaat —
 * dus ook in de edge-runtime. Zowel de wasm-binary als het font worden één
 * keer per isolate opgehaald en daarna hergebruikt.
 */

const WASM_URL = "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
/** Eigen fonts uit `public/fonts` — geen externe fontdienst, geen tracking. */
const FONT_PATHS = ["/fonts/Inter-Regular.ttf", "/fonts/Inter-SemiBold.ttf"];

let wasmReady: Promise<void> | null = null;
let fontsReady: Promise<Uint8Array[]> | null = null;

async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const { initWasm } = await import("@resvg/resvg-wasm");
      const response = await fetch(WASM_URL);
      if (!response.ok) throw new Error(`resvg wasm ${response.status}`);
      await initWasm(await response.arrayBuffer());
    })().catch((error) => {
      wasmReady = null;
      throw error;
    });
  }
  return wasmReady;
}

async function ensureFonts(origin: string) {
  if (!fontsReady) {
    fontsReady = Promise.all(
      FONT_PATHS.map(async (path) => {
        const response = await fetch(new URL(path, origin).toString());
        if (!response.ok) throw new Error(`font ${path} ${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      }),
    ).catch((error) => {
      fontsReady = null;
      throw error;
    });
  }
  return fontsReady;
}

/**
 * Zet een SVG-string om in PNG-bytes. Gooit wanneer de wasm-runtime of de
 * fonts onbereikbaar zijn; de aanroeper valt dan terug op de SVG-variant.
 */
export async function svgToPng(
  svg: string,
  origin: string,
  width = 1200,
): Promise<Uint8Array> {
  await ensureWasm();
  const fonts = await ensureFonts(origin);
  const { Resvg } = await import("@resvg/resvg-wasm");
  const renderer = new Resvg(svg, {
    background: "#131211",
    fitTo: { mode: "width", value: width },
    font: {
      fontBuffers: fonts,
      defaultFontFamily: "Inter",
      loadSystemFonts: false,
    },
  });
  return renderer.render().asPng();
}
