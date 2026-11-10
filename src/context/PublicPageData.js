import { createContext, useContext } from "react";
import { useLocation } from "react-router-dom";

export const PublicPageData = createContext(null);

export function usePublicPageData() {
  const snapshot = useContext(PublicPageData);
  const { pathname } = useLocation();
  return snapshot?.pathname === pathname ? snapshot.data : undefined;
}
