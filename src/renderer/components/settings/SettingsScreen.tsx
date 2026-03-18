import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AppMeta } from "@shared/types/ipc";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";

export function SettingsScreen(): JSX.Element {
  const settingsStore = useSettingsStore();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [defaultView, setDefaultView] = useState("month");
  const [weekStartsOn, setWeekStartsOn] = useState("0");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [rememberApiKey, setRememberApiKey] = useState(true);
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [message, setMessage] = useState("설정은 DB에 영구 저장됩니다. API 키는 가능하면 OS 암호화 저장소를 사용합니다.");

  useEffect(() => {
    void settingsStore.load();
    void window.calendarApi.app.getMeta().then(setMeta);
  }, [settingsStore]);

  useEffect(() => {
    setModel(settingsStore.openAiModel);
    setDefaultView(settingsStore.defaultCalendarView);
    setWeekStartsOn(settingsStore.weekStartsOn);
    setTimezone(settingsStore.timezone);
    setRememberApiKey(settingsStore.apiKeyStorageMode !== "session");
  }, [settingsStore.defaultCalendarView, settingsStore.openAiModel, settingsStore.timezone, settingsStore.weekStartsOn, settingsStore.apiKeyStorageMode]);

  const handleSave = async () => {
    await window.calendarApi.settings.update("openAiModel", model);
    await window.calendarApi.settings.update("defaultCalendarView", defaultView);
    await window.calendarApi.settings.update("weekStartsOn", weekStartsOn);
    await window.calendarApi.settings.update("timezone", timezone);
    await window.calendarApi.settings.update("rememberApiKey", String(rememberApiKey));
    if (apiKey.trim()) {
      await window.calendarApi.settings.update("openAiApiKeyEncrypted", apiKey.trim());
      setApiKey("");
    }
    await settingsStore.load();
    setMessage("설정이 저장되었습니다.");
  };

  const handleClearApiKey = async () => {
    await window.calendarApi.settings.update("openAiApiKeyEncrypted", "");
    await settingsStore.load();
    setMessage("API 키가 삭제되었습니다.");
  };

  const handleExport = async () => {
    const response = await window.calendarApi.data.exportJson();
    setMessage(response.filePath ? `내보내기 완료: ${response.filePath}` : "내보내기가 취소되었습니다.");
  };

  const handleImport = async () => {
    const picked = await window.calendarApi.data.pickImportFile();
    if (!picked.filePath) {
      setMessage("가져오기가 취소되었습니다.");
      return;
    }

    await window.calendarApi.data.importJson(picked.filePath);
    await settingsStore.load();
    setMessage("가져오기가 완료되었습니다.");
  };

  return (
    <section className="screen grid-2">
      <div className="panel stack">
        <div className="section-title">
          <strong>AI 설정</strong>
          <span className="badge">{settingsStore.aiAvailability}</span>
        </div>
        <input className="field" type="password" placeholder="새 GPT API 키" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
        <label className="badge">
          <input type="checkbox" checked={rememberApiKey} onChange={(event) => setRememberApiKey(event.target.checked)} />
          API 키 저장
        </label>
        <input className="field" placeholder="모델명" value={model} onChange={(event) => setModel(event.target.value)} />
        <div className="toolbar-group">
          <button className="button primary" onClick={handleSave}>
            저장
          </button>
          <button className="button warn" onClick={handleClearApiKey}>
            API 키 삭제
          </button>
        </div>
        <div className="muted">저장 방식: {settingsStore.apiKeyStorageMode}</div>
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>캘린더 설정</strong>
        </div>
        <select className="select" value={defaultView} onChange={(event) => setDefaultView(event.target.value)}>
          <option value="month">month</option>
          <option value="week">week</option>
          <option value="day">day</option>
          <option value="agenda">agenda</option>
        </select>
        <select className="select" value={weekStartsOn} onChange={(event) => setWeekStartsOn(event.target.value)}>
          <option value="0">일요일 시작</option>
          <option value="1">월요일 시작</option>
        </select>
        <input className="field" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>데이터 관리</strong>
        </div>
        <div className="toolbar-group">
          <button className="button" onClick={handleExport}>
            JSON 내보내기
          </button>
          <button className="button" onClick={handleImport}>
            JSON 가져오기
          </button>
          <button className="button" onClick={() => void window.calendarApi.app.openDataDirectory()}>
            데이터 폴더 열기
          </button>
        </div>
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>앱 정보</strong>
        </div>
        <div>버전: {meta?.version ?? "-"}</div>
        <div className="muted">userData: {meta?.userDataPath ?? "-"}</div>
        <Link className="button" to="/guide">
          앱 설명서 열기
        </Link>
        <div className="muted">{message}</div>
      </div>
    </section>
  );
}
