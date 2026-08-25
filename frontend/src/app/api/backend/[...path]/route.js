import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function getBackendUrl() {
  const raw = process.env.BACKEND_URL || "http://localhost:3001";
  return raw.replace(/\/$/, "");
}

async function proxy(request, context) {
  try {
    const { path = [] } = await context.params;
    const incomingUrl = new URL(request.url);
    const targetPath = `/${path.join("/")}`;
    const targetUrl = `${getBackendUrl()}${targetPath}${incomingUrl.search}`;

    const headers = new Headers();
    request.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    const hasBody = !["GET", "HEAD"].includes(request.method);
    const body = hasBody ? await request.arrayBuffer() : undefined;

    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("API proxy error:", error);
    return NextResponse.json(
      { message: "Backend service is unavailable" },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
