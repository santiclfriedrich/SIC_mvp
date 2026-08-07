// Formateadores es-AR (portados de bi-stock lib/format.ts).
const nfInt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nfDec = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

export const fmtQty = (v) => nfInt.format(Math.round(Number(v) || 0));
export const fmtDec = (v) => nfDec.format(Number(v) || 0);

function symbol(curr) {
  return curr === "USD" ? "US$" : curr === "ARS" || !curr ? "$" : curr + " ";
}
export const fmtMoney = (v, curr) => symbol(curr) + " " + nfInt.format(Math.round(Number(v) || 0));
export const fmtMoneyDec = (v, curr) => symbol(curr) + " " + nfDec.format(Number(v) || 0);

export const compact = (v) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return nfDec.format(n / 1e9) + " MM";
  if (abs >= 1e6) return nfDec.format(n / 1e6) + " M";
  if (abs >= 1e4) return nfInt.format(Math.round(n / 1e3)) + " mil";
  return nfInt.format(Math.round(n));
};
