import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { apiRoutes } from "@/routes";

const port = Number(process.env.PORT ?? 3001);
const defaultFrontendOrigins: (string | RegExp)[] = [
  "http://localhost:5173",
  "https://court-management-livid.vercel.app",
  /.*-livid\.vercel\.app$/
];

function normalizeOrigin(origin: string) {
  const cleaned = origin.replace(/^['"]|['"]$/g, "").trim();
  try {
    return new URL(cleaned).origin;
  } catch {
    return cleaned.replace(/\/+$/, "");
  }
}

function getFrontendOrigins(): (string | RegExp)[] {
  let origins: (string | RegExp)[] = [...defaultFrontendOrigins];
  if (process.env.FRONTEND_ORIGIN) {
    const envOrigins = process.env.FRONTEND_ORIGIN.split(",")
      .map(o => {
        const cleaned = o.trim();
        if (cleaned.startsWith('/') && cleaned.endsWith('/')) {
          return new RegExp(cleaned.slice(1, -1));
        }
        return normalizeOrigin(cleaned);
      })
      .filter(Boolean);
    origins = [...origins, ...envOrigins];
  }
  return origins;
}

type AppLogger = Pick<Console, "error" | "log">;

type CreateAppOptions = {
  logger?: AppLogger | false;
};

export function createApp(options: CreateAppOptions = {}) {
  const logger = options.logger === undefined ? console : options.logger;
  const frontendOrigins = getFrontendOrigins();

  return new Elysia()
    .use(
      cors({
        origin: frontendOrigins,
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization", "x-mac-address"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      }),
    )
    .use(
      openapi({
        documentation: {
          info: {
            title: "Court Management API",
            version: "0.1.0",
            description:
              "API documentation for the court records management system.",
          },
        },
      }),
    )
    .onRequest(({ request }) => {
      logger &&
        logger.log(`${request.method} ${new URL(request.url).pathname}`);
    })
    .get("/health", () => ({ ok: true }), {
      response: t.Object({ ok: t.Boolean() }),
      detail: {
        tags: ["System"],
        summary: "Health check",
      },
    })
    .use(apiRoutes)
    .onError(({ code, error, set }) => {
      logger && logger.error(code, error);
      set.status = code === "NOT_FOUND" ? 404 : 500;
      return {
        error: code === "NOT_FOUND" ? "Not Found" : "Internal Server Error",
      };
    });
}

const app = createApp();

if (import.meta.main) {
  app.listen({ port, hostname: '0.0.0.0' });
  console.log(
    `Court Management API running at ${app.server?.hostname}:${app.server?.port}`,
  );
}

export default app;
