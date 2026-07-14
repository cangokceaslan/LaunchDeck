const SECRET_PATTERNS = [
  /(?:authorization|token|password|private[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
  /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g,
] as const;

export const createRedactor = (sensitiveValues: readonly string[]) => {
  const normalizedSecrets = sensitiveValues
    .map((sensitiveValue) => sensitiveValue.trim())
    .filter((sensitiveValue) => sensitiveValue.length >= 4)
    .sort((first, second) => second.length - first.length);

  return (message: string): string => {
    let redactedMessage = message;
    for (const sensitiveValue of normalizedSecrets) {
      redactedMessage = redactedMessage.split(sensitiveValue).join('[GİZLENDİ]');
    }
    for (const secretPattern of SECRET_PATTERNS) {
      redactedMessage = redactedMessage.replace(secretPattern, '[GİZLENDİ]');
    }
    return redactedMessage.slice(0, 8_000);
  };
};
