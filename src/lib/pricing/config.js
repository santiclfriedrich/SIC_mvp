// Carga/guarda la config editable del módulo (PricingConfig, fila única id=1).
// Si no hay fila en DB, devuelve los defaults del código. Server-only.

import { prisma } from "@/lib/prisma";
import { DEFAULT_CONFIG, DEFAULT_STORES, DEFAULT_FEE_TABLES } from "./stores.js";

/** Mezcla la config guardada sobre los defaults (defensivo ante campos faltantes). */
function mergeConfig(saved) {
  if (!saved || typeof saved !== "object") return DEFAULT_CONFIG;
  return {
    stores: saved.stores && Object.keys(saved.stores).length ? saved.stores : DEFAULT_STORES,
    feeTables:
      saved.feeTables && Object.keys(saved.feeTables).length
        ? saved.feeTables
        : DEFAULT_FEE_TABLES,
  };
}

export async function getPricingConfig() {
  try {
    const row = await prisma.pricingConfig.findUnique({ where: { id: 1 } });
    return mergeConfig(row?.configJson);
  } catch {
    // Tabla aún no migrada o DB caída → defaults.
    return DEFAULT_CONFIG;
  }
}

export async function savePricingConfig(configJson) {
  return prisma.pricingConfig.upsert({
    where: { id: 1 },
    update: { configJson },
    create: { id: 1, configJson },
  });
}
