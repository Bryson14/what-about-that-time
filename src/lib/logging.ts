interface LogAttributes {
  [key: string]: string | number | boolean | null | undefined;
}

interface LogEntry {
  timestamp: string;
  severityText: "DEBUG" | "INFO" | "WARN" | "ERROR";
  body: string;
  attributes?: LogAttributes;
}

const SERVICE_NAME = "what-about-that-time";

function entry(severityText: LogEntry["severityText"], body: string, attributes?: LogAttributes): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    severityText,
    body,
    ...(attributes ? { attributes } : {}),
  };
}

function emit(severityText: LogEntry["severityText"], body: string, attributes?: LogAttributes) {
  const log = entry(severityText, body, { service: SERVICE_NAME, ...attributes });
  const json = JSON.stringify(log);

  switch (severityText) {
    case "DEBUG":
      console.debug(json);
      break;
    case "INFO":
      console.log(json);
      break;
    case "WARN":
      console.warn(json);
      break;
    case "ERROR":
      console.error(json);
      break;
  }
}

export const logger = {
  debug(body: string, attributes?: LogAttributes) {
    emit("DEBUG", body, attributes);
  },
  info(body: string, attributes?: LogAttributes) {
    emit("INFO", body, attributes);
  },
  warn(body: string, attributes?: LogAttributes) {
    emit("WARN", body, attributes);
  },
  error(body: string, attributes?: LogAttributes) {
    emit("ERROR", body, attributes);
  },
};
