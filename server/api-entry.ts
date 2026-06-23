import app from "@/index";

const forwardedRequest = (request: Request) => {
  const url = new URL(request.url);
  const forwardedParam = url.searchParams.has("__api_path")
    ? "__api_path"
    : url.pathname === "/api/entry" && url.searchParams.has("path")
      ? "path"
      : null;
  const forwardedPath = forwardedParam ? url.searchParams.get(forwardedParam) : null;

  if (!forwardedParam || !forwardedPath) {
    return request;
  }

  url.pathname = `/api/${forwardedPath.replace(/^\/+/, "")}`;
  url.searchParams.delete(forwardedParam);

  return new Request(url.toString(), request);
};

export default {
  async fetch(request: Request) {
    const apiRequest = forwardedRequest(request);
    return await app.handle(apiRequest);
  },
};
