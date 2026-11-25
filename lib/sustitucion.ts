export const normalizarMatricula = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Vehículo cuya matrícula (`descripcion`) coincide con lo tecleado, ignorando mayúsculas, espacios y guiones. */
export function buscarPorMatricula<T extends { descripcion: string }>(
  items: T[],
  query: string,
): T | undefined {
  const q = normalizarMatricula(query);
  return q ? items.find((v) => normalizarMatricula(v.descripcion) === q) : undefined;
}
