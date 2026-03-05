export function success(res, options = {}) {
  const { statusCode = 200, data, message, meta, incomplete } = options;
  const payload = { success: true };
  if (message != null) payload.message = message;
  if (data != null) payload.data = data;
  if (meta != null) payload.meta = meta;
  if (incomplete === true) payload.incomplete = true;
  res.status(statusCode).json(payload);
}

export function sendError(res, statusCode, err, extra = {}) {
  const message = typeof err === 'string' ? err : (err?.message ?? 'Internal server error');
  const payload = {
    success: false,
    message,
    code: statusCode,
    ...extra,
  };
  res.set('Content-Type', 'application/json');
  res.status(statusCode).json(payload);
}
