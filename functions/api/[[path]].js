const WORKER = 'https://bricklio-auth.richieconnor.workers.dev';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const target = `${WORKER}${url.pathname}${url.search}`;

  // Forward the request to the Worker, preserving method, headers, and body
  const res = await fetch(target, {
    method:  context.request.method,
    headers: context.request.headers,
    body:    ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
    redirect: 'manual', // let redirects pass through unchanged
  });

  return res;
}
