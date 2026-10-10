// Wraps a route handler so a failure (for example the database) returns {error: "..."} instead of a blank 500.
export function safe(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || 'Server error').replace(/mongodb(\+srv)?:\/\/[^\s"']+/g, 'mongodb://…');
      return Response.json({ error: msg }, { status: 500 });
    }
  };
}
