import { DefaultNamingStrategy } from "typeorm";

const snake = (value: string): string =>
  value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

export class SnakeNamingStrategy extends DefaultNamingStrategy {
  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    if (customName) return customName;
    return snake([...embeddedPrefixes, propertyName].join("_"));
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snake(`${relationName}_${referencedColumnName}`);
  }
}
