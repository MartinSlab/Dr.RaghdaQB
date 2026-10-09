export function isAdmin(req) {
  const p = req.headers.get('x-admin-password');
  return !!p && !!process.env.ADMIN_PASSWORD && p === process.env.ADMIN_PASSWORD;
}
export function unauthorized() {
  return Response.json({ error: 'Wrong password' }, { status: 401 });
}
