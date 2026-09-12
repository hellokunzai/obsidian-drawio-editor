/**
 * Draw.io Stencil Loader
 *
 * Loads draw.io's stencil shape definitions so all draw.io icons
 * are available in the editor. Stencils are loaded via mxGraph's
 * mxStencilRegistry at runtime.
 *
 * Stencil XML files are custom-defined shapes covering the most common
 * draw.io shape categories. The stencil format is identical to draw.io's,
 * so external draw.io stencil XML can also be loaded via loadStencilSet().
 */

import { mxStencilRegistry, mxStencil, mxUtils } from "./mxgraph-setup";

import basicStencil from "./stencils/basic-extended.xml";
import flowchartStencil from "./stencils/flowchart-extended.xml";
import umlStencil from "./stencils/uml-extended.xml";
import networkStencil from "./stencils/network-extended.xml";
import miscStencil from "./stencils/misc-extended.xml";

const BUNDLED_STENCILS: { name: string; xml: string }[] = [
  { name: "basic", xml: basicStencil },
  { name: "flowchart", xml: flowchartStencil },
  { name: "uml", xml: umlStencil },
  { name: "network", xml: networkStencil },
  { name: "misc", xml: miscStencil },
];

let stencilsLoaded = false;

/**
 * Load all bundled draw.io stencils into mxGraph's stencil registry.
 * Safe to call multiple times — only loads once.
 */
export function loadAllStencils(): void {
  if (stencilsLoaded) return;

  let ok = 0;
  for (const stencil of BUNDLED_STENCILS) {
    if (loadStencilSet(stencil.xml)) {
      ok++;
    } else {
      console.warn(`Failed to load stencil: ${stencil.name}`);
    }
  }

  stencilsLoaded = true;
  console.log(`Draw.io stencil sets loaded: ${ok}/${BUNDLED_STENCILS.length}`);
}

/**
 * Register every <shape> in a stencil-set XML string.
 *
 * The bundled mxClient only exposes `mxStencilRegistry.addStencil(name, stencil)`
 * (draw.io's `addStencilSet` is not included), so we walk the <shape> nodes
 * and register each one manually.
 */
export function loadStencilSet(xml: string): boolean {
  const MxStencilRegistry = mxStencilRegistry();
  const MxStencil = mxStencil();
  const MxUtils = mxUtils();

  try {
    const doc = MxUtils.parseXml(xml);
    const shapes = doc.getElementsByTagName("shape");
    for (let i = 0; i < shapes.length; i++) {
      const name = shapes[i].getAttribute("name");
      if (!name) continue;
      MxStencilRegistry.addStencil(name, new MxStencil(shapes[i]));
    }
    return true;
  } catch (err) {
    console.error("Failed to load stencil set:", err);
    return false;
  }
}

/**
 * Check if stencils have been loaded.
 */
export function areStencilsLoaded(): boolean {
  return stencilsLoaded;
}

/**
 * Get list of bundled stencil names.
 */
export function getBundledStencilNames(): string[] {
  return BUNDLED_STENCILS.map((s) => s.name);
}
