import React, { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { listMyAuctions } from "./modules/auctions/auctionService.js";
import { resolveRoute, navigate } from "./routing.js";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import AuthDialog from "./components/AuthDialog.jsx";
import HomeView from "./views/HomeView.jsx";
import AuctionsView from "./views/AuctionsView.jsx";
import CreateView from "./views/CreateView.jsx";
import ProfileView from "./views/ProfileView.jsx";
function App() {
  const [hash, setHash] = useState(() => typeof window === "undefined" ? "" : window.location.hash), [authMode, setAuthMode] = useState(null), [notifications, setNotifications] = useState([]), [notificationError, setNotificationError] = useState(false);
  const { user } = useAuth();
  const [notificationUser,setNotificationUser] = useState(null);
  const { path, query } = resolveRoute(hash);
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    const section = path.slice(1), target = document.getElementById(section);
    if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
    else window.scrollTo({ top: 0, behavior: "auto" });
    document.getElementById("portal-main")?.focus({ preventScroll: true });
  }, [path]);
  useEffect(() => {
    let alive = true;
    setNotifications([]);
    setNotificationUser(user?.id);
    setNotificationError(false);
    async function load() {
      if (!user) return;
      try {
        const items = await listMyAuctions();
        if (alive) {
          setNotifications(items.filter((item) => item.awarded_bid_id || new Date(item.ends_at) <= /* @__PURE__ */ new Date()).slice(0, 4));
          setNotificationError(false);
        }
      } catch {
        if (alive) {
          setNotifications([]);
          setNotificationError(true);
        }
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 3e4);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user?.id]);
  let content;
  if (path === "/subastas") content = <AuctionsView key={user?.id||'guest'} openAuth={setAuthMode} navigate={navigate} query={query} />;
  else if (path === "/publicar") content = <CreateView key={user?.id||'guest'} openAuth={setAuthMode} navigate={navigate} />;
  else if (path === "/perfil") content = <ProfileView key={user?.id||'guest'} openAuth={setAuthMode} />;
  else if (path === "/no-encontrado") content = <section className="container section access-gate"><h1>No encontramos esta sección</h1><a href="#/inicio" className="button button-dark">Volver al inicio</a></section>;
  else content = <HomeView navigate={navigate} />;
  return <><a href="#portal-main" className="skip-link" onClick={(event) => {
    event.preventDefault();
    document.getElementById("portal-main").focus();
  }}>Saltar al contenido</a><Navbar route={path} openAuth={setAuthMode} notifications={notificationUser===user?.id?notifications:[]} notificationError={notificationUser===user?.id&&notificationError} /><main id="portal-main" tabIndex={-1} className="portal-main">{content}</main><Footer />{authMode && <AuthDialog key={authMode} initialMode={authMode} onClose={() => setAuthMode(null)} />}</>;
}
export {
  App as default
};
