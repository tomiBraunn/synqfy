import { useState } from "react";
import axios from "axios";

interface ConfigFormProps {
  onSaved: () => void;
}

export default function ConfigForm({ onSaved }: ConfigFormProps) {
  const [form, setForm] = useState({
    spotifyClientId: "",
    spotifyClientSecret: "",
    spotifyRedirectUri: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "",
    haUrl: "",
    haToken: "",
    primaryEntityIds: "",
    secondaryEntityIds: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await axios.post("/api/config", form);
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="config-form-wrapper">
      <h1 className="app-title">synqfy</h1>
      <p className="config-intro">Enter your credentials to get started.</p>

      <form className="config-form" onSubmit={handleSubmit}>
        <fieldset>
          <legend>Spotify</legend>
          <label>
            Client ID
            <input value={form.spotifyClientId} onChange={handleChange("spotifyClientId")} placeholder="abc123..." required />
          </label>
          <label>
            Client Secret
            <input value={form.spotifyClientSecret} onChange={handleChange("spotifyClientSecret")} placeholder="xyz789..." required />
          </label>
          <label>
            Redirect URI
            <input value={form.spotifyRedirectUri} onChange={handleChange("spotifyRedirectUri")} required />
            <span className="field-hint">Must match what you registered in Spotify Dashboard</span>
          </label>
        </fieldset>

        <fieldset>
          <legend>Home Assistant (optional)</legend>
          <label>
            HA URL
            <input value={form.haUrl} onChange={handleChange("haUrl")} placeholder="http://homeassistant.local:8123" />
          </label>
          <label>
            Long-Lived Access Token
            <input value={form.haToken} onChange={handleChange("haToken")} placeholder="eyJ..." type="password" />
          </label>
          <label>
            Primary entity IDs
            <input value={form.primaryEntityIds} onChange={handleChange("primaryEntityIds")} placeholder="light.sala" />
            <span className="field-hint">Gets the Vibrant color (comma-separated)</span>
          </label>
          <label>
            Secondary entity IDs
            <input value={form.secondaryEntityIds} onChange={handleChange("secondaryEntityIds")} placeholder="light.cocina,light.jardin" />
            <span className="field-hint">Gets the secondary color (comma-separated)</span>
          </label>
        </fieldset>

        {error && <p className="config-error">{error}</p>}

        <button className="login-button" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </form>
    </div>
  );
}
