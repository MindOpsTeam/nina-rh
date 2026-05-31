// Formatadores compartilhados (consolidação FIX-C do deep review).

export function formatCurrencyBRL(value: number, decimals: 0 | 2 = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDateBR(d: Date | string, fmt: 'short' | 'long' = 'short'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(
    'pt-BR',
    fmt === 'long'
      ? { day: '2-digit', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' },
  );
}
