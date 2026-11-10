import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router-dom";
import { appRoutes } from "./AppRoutes.jsx";

export async function renderPublicPage(url, snapshot) {
  const handler = createStaticHandler(appRoutes(snapshot));
  const context = await handler.query(new Request(url));
  if (context instanceof Response) throw new Error(`Unexpected redirect while rendering ${url}`);
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToString(<StaticRouterProvider router={router} context={context} hydrate={false} />);
}
