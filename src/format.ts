export function quantity(value: number, forms: [string, string, string]) {
  const mod100 = Math.abs(value) % 100
  const mod10 = mod100 % 10
  const word = mod100 >= 11 && mod100 <= 14 ? forms[2] : mod10 === 1 ? forms[0] : mod10 >= 2 && mod10 <= 4 ? forms[1] : forms[2]
  return `${value} ${word}`
}
