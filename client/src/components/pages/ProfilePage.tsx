import { useEffect, useState } from "react";
import { getMe } from "../../api/enpoints/user";
import { clearToken } from "../../auth/tokenStorage";
import { useTranslation } from "react-i18next";

type Me = {
  username: string;
  email: string; // login
};

function handleLogout() {
  clearToken();
  globalThis.location.href = "/login";
}

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const data = await getMe();
        if (!cancelled) setMe(data);
      } catch (e: any) {
        if (!cancelled)
          setError(e?.message ?? [t("NOTIFICATION.failed_load_profile")]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("USER.profile")}</h1>
        </div>
      </div>

      <div className="card">
        {loading && <p>Loading…</p>}

        {!loading && error && (
          <div className="alert alert-error">
            <div className="alert-title">{t("NOTIFICATION.error")}</div>
            <div>{error}</div>
          </div>
        )}

        {!loading && !error && me && (
          <div className="profile_info">
            <div className="field">
              <div className="label">{t("USER.username")}:</div>
              <div className="value">{me.username}</div>
            </div>

            <div className="field">
              <div className="label">{t("USER.email")}:</div>
              <div className="value">{me.email}</div>
            </div>

            <button className="btn btn-secondary" onClick={handleLogout}>
              {t("ACTION.log_out")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
