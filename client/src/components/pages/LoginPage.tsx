import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SGLogo from "../../assets/icons/smart-garden.svg?react";
import { loginUser } from "../../api/enpoints/user";
import { setToken } from "../../auth/tokenStorage";
import { hashPassword } from "../../utils/hash";
import { ApiError } from "../../api/client";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = t("VALIDATION.email_required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t("VALIDATION.email_invalid");
    }

    if (!password) {
      newErrors.password = t("VALIDATION.password_required");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      const hashedPassword = await hashPassword(password);
      const response = await loginUser({ email, password: hashedPassword });
      setToken(response.token);
      navigate("/pots", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setApiError(t("NOTIFICATION.invalid_credentials"));
      } else {
        setApiError(t("NOTIFICATION.error"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <SGLogo className="auth-logo" />
        <h1 className="auth-title">{t("AUTH.login_title")}</h1>

        {apiError && <div className="alert alert-error">{apiError}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="field-label" htmlFor="email">
              {t("USER.email")}
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("USER.email")}
              autoComplete="email"
            />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>

          <div className="auth-field">
            <label className="field-label" htmlFor="password">
              {t("USER.password")}
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("USER.password")}
              autoComplete="current-password"
            />
            {errors.password && (
              <p className="field-error">{errors.password}</p>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? t("NOTIFICATION.loading") : t("ACTION.login")}
          </button>
        </form>

        <p className="auth-link">
          {t("AUTH.no_account")} <Link to="/register">{t("ACTION.sign_up")}</Link>
        </p>
      </div>
    </div>
  );
}
