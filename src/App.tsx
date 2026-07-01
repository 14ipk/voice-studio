import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from '@/pages/Layout';
import { ConvertPage } from '@/pages/ConvertPage';
import { ClonePage } from '@/pages/ClonePage';
import { LibraryPage } from '@/pages/LibraryPage';
import { TTSPage } from '@/pages/TTSPage';
import { ExportPage } from '@/pages/ExportPage';
import { useVoiceStore } from '@/store/useVoiceStore';

export default function App() {
  const fetchVoices = useVoiceStore((s) => s.fetchVoices);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/convert" replace />} />
          <Route path="/convert" element={<ConvertPage />} />
          <Route path="/clone" element={<ClonePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/tts" element={<TTSPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
