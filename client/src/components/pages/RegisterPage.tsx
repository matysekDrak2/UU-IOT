import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SGLogo from "../../assets/icons/smart-garden.svg?react";
import { registerUser, loginUser } from "../../api/enpoints/user";
import { setToken } from "../../auth/tokenStorage";
import { hashPassword } from "../../utils/hash";
import { ApiError } from "../../api/client";

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!username.trim()) {
      newErrors.username = t("VALIDATION.username_required");
    } else if (username.length < 3 || username.length > 30) {
      newErrors.username = t("VALIDATION.username_length");
    }

    if (!email.trim()) {
      newErrors.email = t("VALIDATION.email_required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t("VALIDATION.email_invalid");
    }

    if (!password) {
      newErrors.password = t("VALIDATION.password_required");
    } else if (password.length < 8) {
      newErrors.password = t("VALIDATION.password_min_length");
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = t("VALIDATION.password_mismatch");
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

      await registerUser({
        username,
        email,
        password: hashedPassword,
      });

      const loginResponse = await loginUser({
        email,
        password: hashedPassword,
      });
      setToken(loginResponse.token);
      navigate("/pots", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setApiError(t("NOTIFICATION.email_already_used"));
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
        <h1 className="auth-title">{t("AUTH.register_title")}</h1>

        {apiError && <div className="alert alert-error">{apiError}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="field-label" htmlFor="username">
              {t("USER.username")}
            </label>
            <input
              id="username"
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("USER.username")}
              autoComplete="username"
            />
            {errors.username && (
              <p className="field-error">{errors.username}</p>
            )}
          </div>

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
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="field-error">{errors.password}</p>
            )}
          </div>

          <div className="auth-field">
            <label className="field-label" htmlFor="confirmPassword">
              {t("AUTH.confirm_password")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("AUTH.confirm_password")}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="field-error">{errors.confirmPassword}</p>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? t("NOTIFICATION.loading") : t("ACTION.sign_up")}
          </button>
        </form>

        <p className="auth-link">
          {t("AUTH.has_account")} <Link to="/login">{t("ACTION.login")}</Link>
        </p>
      </div>
    </div>
  );
}
