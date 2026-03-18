import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@renderer/layouts/AppLayout";
import { CalendarRoute } from "@renderer/routes/CalendarRoute";
import { NotesRoute } from "@renderer/routes/NotesRoute";
import { GraphRoute } from "@renderer/routes/GraphRoute";
import { FunctionsRoute } from "@renderer/routes/FunctionsRoute";
import { SettingsRoute } from "@renderer/routes/SettingsRoute";
import { GuideRoute } from "@renderer/routes/GuideRoute";

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/calendar" replace />} />
        <Route path="/calendar" element={<CalendarRoute />} />
        <Route path="/notes" element={<NotesRoute />} />
        <Route path="/graph" element={<GraphRoute />} />
        <Route path="/functions" element={<FunctionsRoute />} />
        <Route path="/guide" element={<GuideRoute />} />
        <Route path="/settings" element={<SettingsRoute />} />
      </Route>
    </Routes>
  );
}
