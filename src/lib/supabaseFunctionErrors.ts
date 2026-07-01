type FunctionErrorDetails = {
  functionName: string;
  fallbackMessage: string;
  clientMessage?: string;
  responseStatus?: number;
  responseBody?: unknown;
  data?: unknown;
};

function extractBodyMessage(body: unknown): string | undefined {
  if (!body) return undefined;
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const message = record.error || record.message || record.details;
    if (typeof message === 'string') return message;
    if (message) return JSON.stringify(message);
  }
  return undefined;
}

async function readErrorResponse(error: any): Promise<{ status?: number; body?: unknown }> {
  const response = error?.context;
  if (!response || typeof response.clone !== 'function') {
    return {};
  }

  try {
    const cloned = response.clone();
    const text = await cloned.text();
    if (!text) return { status: response.status };

    try {
      return { status: response.status, body: JSON.parse(text) };
    } catch {
      return { status: response.status, body: text };
    }
  } catch {
    return { status: response.status };
  }
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(Boolean).map((value) => value!.trim()).filter(Boolean)));
}

export async function buildSupabaseFunctionError(
  functionName: string,
  error: any,
  data: unknown,
  fallbackMessage: string,
) {
  const { status, body } = await readErrorResponse(error);
  const clientMessage = typeof error?.message === 'string' ? error.message : undefined;
  const dataMessage = extractBodyMessage(data);
  const bodyMessage = extractBodyMessage(body);
  const messages = unique([clientMessage, bodyMessage, dataMessage, fallbackMessage]);
  const message = `${functionName}: ${messages.join(' | ')}`;
  const detailedError = new Error(message) as Error & { details: FunctionErrorDetails };

  detailedError.details = {
    functionName,
    fallbackMessage,
    clientMessage,
    responseStatus: status,
    responseBody: body,
    data,
  };

  return detailedError;
}

export function logSupabaseFunctionError(label: string, error: any) {
  console.error(label, {
    message: error?.message,
    details: error?.details,
  });
}