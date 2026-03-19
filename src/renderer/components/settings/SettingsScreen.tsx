import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AppMeta } from "@shared/types/ipc";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";

const defaultMessage = "설정은 앱 안에 저장됩니다. API 키는 가능하면 운영체제의 암호화 저장소를 사용합니다.";

export function SettingsScreen(): JSX.Element {
  const loadSettings = useSettingsStore((state) => state.load);
  const aiAvailability = useSettingsStore((state) => state.aiAvailability);
  const openAiModel = useSettingsStore((state) => state.openAiModel);
  const defaultCalendarView = useSettingsStore((state) => state.defaultCalendarView);
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);
  const timezoneValue = useSettingsStore((state) => state.timezone);
  const apiKeyStorageMode = useSettingsStore((state) => state.apiKeyStorageMode);

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [defaultView, setDefaultView] = useState("month");
  const [weekStartsOnValue, setWeekStartsOnValue] = useState("0");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [rememberApiKey, setRememberApiKey] = useState(true);
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [message, setMessage] = useState(defaultMessage);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        setBusy(true);
        const [_, appMeta] = await Promise.all([loadSettings(), window.calendarApi.app.getMeta()]);
        if (!active) {
          return;
        }

        setMeta(appMeta);
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage(error instanceof Error ? `설정을 불러오지 못했습니다: ${error.message}` : "설정을 불러오지 못했습니다.");
      } finally {
        if (active) {
          setBusy(false);
        }
      }
    };

    void hydrate();

    return () => {
      active = false;
    };
  }, [loadSettings]);

  useEffect(() => {
    setModel(openAiModel);
    setDefaultView(defaultCalendarView);
    setWeekStartsOnValue(weekStartsOn);
    setTimezone(timezoneValue);
    setRememberApiKey(apiKeyStorageMode !== "session");
  }, [apiKeyStorageMode, defaultCalendarView, openAiModel, timezoneValue, weekStartsOn]);

  const handleSave = async () => {
    try {
      setBusy(true);
      await window.calendarApi.settings.update("openAiModel", model);
      await window.calendarApi.settings.update("defaultCalendarView", defaultView);
      await window.calendarApi.settings.update("weekStartsOn", weekStartsOnValue);
      await window.calendarApi.settings.update("timezone", timezone);
      await window.calendarApi.settings.update("rememberApiKey", String(rememberApiKey));
      if (apiKey.trim()) {
        await window.calendarApi.settings.update("openAiApiKeyEncrypted", apiKey.trim());
        setApiKey("");
      }
      await loadSettings();
      setMessage("설정이 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "설정 저장 실패");
    } finally {
      setBusy(false);
    }
  };

  const handleClearApiKey = async () => {
    try {
      setBusy(true);
      await window.calendarApi.settings.update("openAiApiKeyEncrypted", "");
      await loadSettings();
      setMessage("API 키가 삭제되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "API 키 삭제 실패");
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      setBusy(true);
      const response = await window.calendarApi.data.exportJson();
      setMessage(response.filePath ? `내보내기 완료: ${response.filePath}` : "내보내기가 취소되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "내보내기 실패");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    try {
      setBusy(true);
      const picked = await window.calendarApi.data.pickImportFile();
      if (!picked.filePath) {
        setMessage("가져오기가 취소되었습니다.");
        return;
      }

      await window.calendarApi.data.importJson(picked.filePath);
      await loadSettings();
      setMessage("가져오기가 완료되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "가져오기 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen grid-2">
      <div className="panel stack">
        <div className="section-title">
          <strong>AI 설정</strong>
          <span className="badge">{busy ? "불러오는 중" : aiAvailability}</span>
        </div>
        <p className="muted">AI를 쓸 때 필요한 키와 모델을 여기에서 관리합니다.</p>
        <input
          className="field"
          type="password"
          placeholder="새 GPT API 키"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <label className="badge">
          <input type="checkbox" checked={rememberApiKey} onChange={(event) => setRememberApiKey(event.target.checked)} />
          API 키 저장
        </label>
        <input className="field" placeholder="모델명" value={model} onChange={(event) => setModel(event.target.value)} />
        <div className="toolbar-group">
          <button className="button primary" disabled={busy} onClick={handleSave}>
            저장
          </button>
          <button className="button warn" disabled={busy} onClick={handleClearApiKey}>
            API 키 삭제
          </button>
        </div>
        <div className="muted">현재 저장 방식: {apiKeyStorageMode}</div>
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>캘린더 설정</strong>
        </div>
        <p className="muted">캘린더를 처음 열었을 때 보이는 화면과 주 시작 요일을 정합니다.</p>
        <label className="stack">
          <span className="muted">기본 보기</span>
          <select className="select" value={defaultView} onChange={(event) => setDefaultView(event.target.value)}>
            <option value="month">월 보기</option>
            <option value="week">주 보기</option>
            <option value="day">일 보기</option>
            <option value="agenda">목록 보기</option>
          </select>
        </label>
        <label className="stack">
          <span className="muted">한 주 시작</span>
          <select className="select" value={weekStartsOnValue} onChange={(event) => setWeekStartsOnValue(event.target.value)}>
            <option value="0">일요일 시작</option>
            <option value="1">월요일 시작</option>
          </select>
        </label>
        <label className="stack">
          <span className="muted">시간대</span>
          <input className="field" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        </label>
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>데이터 관리</strong>
        </div>
        <p className="muted">전체 데이터를 JSON으로 백업하거나 다시 가져올 수 있습니다.</p>
        <div className="toolbar-group">
          <button className="button" disabled={busy} onClick={handleExport}>
            JSON 내보내기
          </button>
          <button className="button" disabled={busy} onClick={handleImport}>
            JSON 가져오기
          </button>
          <button className="button" disabled={busy} onClick={() => void window.calendarApi.app.openDataDirectory()}>
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
