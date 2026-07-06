import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api/client";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const body =
        mode === "login" ? { email, password } : { email, username, password };
      const res = await api<{ access_token: string }>(`/auth/${mode}`, {
        method: "POST",
        body,
      });
      setToken(res.access_token);
      navigate("/calendar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card stack">
        <div className="logo" style={{ justifyContent: "center", fontSize: "1.3rem" }}>
          <span>Буль-Хаб</span>
          <span className="bubbles" aria-hidden>°º°</span>
        </div>
        <p className="muted" style={{ textAlign: "center", margin: 0 }}>
          Календарь, финансы и дела — в одном месте
        </p>

        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} style={{ width: "100%" }}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        {mode === "register" && (
          <div>
            <label htmlFor="username">Имя</label>
            <input id="username" value={username} style={{ width: "100%" }}
              onChange={(e) => setUsername(e.target.value)} />
          </div>
        )}
        <div>
          <label htmlFor="password">Пароль {mode === "register" && "(минимум 8 символов)"}</label>
          <input id="password" type="password" value={password} style={{ width: "100%" }}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>

        {error && <div className="error">{error}</div>}

        <button className="primary" onClick={submit} disabled={busy}>
          {mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
        <button className="ghost" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}
