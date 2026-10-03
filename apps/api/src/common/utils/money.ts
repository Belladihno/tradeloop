export function toMinorUnits(amount: string): number {
  const [units, fraction = ""] = amount.split(".");
  return Number(units) * 100 + Number(`${fraction}00`.slice(0, 2));
}

export function fromMinorUnits(minor: number): string {
  return (minor / 100).toFixed(2);
}
