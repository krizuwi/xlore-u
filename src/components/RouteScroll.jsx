import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export function RouteScroll() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousLocation = useRef(null);

  useLayoutEffect(() => {
    const previous = previousLocation.current;
    previousLocation.current = location;

    if (previous && navigationType === "POP") return;
    if (previous?.pathname === location.pathname && previous.search !== location.search
        && previous.hash === location.hash) return;

    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start", behavior: "instant" });
      return;
    }

    const authCard = document.querySelector(".auth-page .auth-card, .au-login-card");
    if (authCard) {
      const { top, height } = authCard.getBoundingClientRect();
      const headerHeight = document.querySelector(".topbar")?.getBoundingClientRect().height ?? 0;
      // Start tall forms below the header so their first fields stay visible.
      const offset = headerHeight + Math.max(16, (window.innerHeight - headerHeight - height) / 2);
      window.scrollTo({ top: Math.max(0, window.scrollY + top - offset), behavior: "instant" });
    } else if (navigationType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [location, navigationType]);

  return null;
}
