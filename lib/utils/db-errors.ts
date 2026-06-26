function collectErrorText(error: unknown): string {
  if (!error || typeof error !== "object") {
    return String(error ?? "");
  }

  const record = error as Record<string, unknown>;
  const parts = [
    record.code,
    record.constraint,
    record.constraintName,
    record.message,
    record.name,
  ];

  if (record.cause) {
    parts.push(collectErrorText(record.cause));
  }

  return parts
    .filter((part): part is string => typeof part === "string")
    .join("\n");
}

export function isUniqueConstraintError(
  error: unknown,
  constraintName: string,
  options: { columns?: string[] } = {},
): boolean {
  const text = collectErrorText(error);
  const identifiers = [constraintName, ...(options.columns ?? [])];
  if (!identifiers.some((identifier) => text.includes(identifier))) {
    return false;
  }

  return (
    text.includes("23505") ||
    text.includes("SQLITE_CONSTRAINT") ||
    text.toLowerCase().includes("unique")
  );
}
