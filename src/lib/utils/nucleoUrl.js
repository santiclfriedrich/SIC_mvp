// src/utils/nucleoUrl.js

export function buildNucleoProductUrl(productName = "") {
  if (!productName) return "";

  const slug = productName
    .toLowerCase()
    .normalize("NFD")                 // quita acentos
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*/g, "-")              // * → -
    .replace(/['"]/g, "")
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")      // todo lo no alfanumérico → -
    .replace(/-+/g, "-")              // colapsar --
    .replace(/^-|-$/g, "");           // trim -

  return `https://www.gruponucleo.com.ar/luna_ar/${slug}.html`;
}
