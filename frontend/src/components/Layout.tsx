import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, setToken, UserOut } from "../api/client";

export default function Layout() {
  const [user, setUser] = useState<UserOut | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api<UserOut>("/auth/me").then(setUser).catch(() => {});
  }, []);

  function logout() {
    setToken(null);
    navigate("/login");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="logo">
          <span>Буль-Хаб</span>
          <span className="bubbles" aria-hidden>°º°</span>
        </div>
        <nav className="nav">
          <NavLink to="/calendar">Календарь</NavLink>
          <NavLink to="/finance">Финансы</NavLink>
          <NavLink to="/todos">Запоминатор</NavLink>
        </nav>
        <span className="muted">{user?.username}</span>
        <button className="ghost" onClick={logout}>Выйти</button>
      </header>
      <Outlet />
    </div>
  );
}
