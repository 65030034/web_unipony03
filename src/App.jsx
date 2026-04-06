import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE_URL = "https://backend03-vjm9.onrender.com";

export default function App() {
  const [loginEmail, setLoginEmail] = useState(localStorage.getItem("capu_user") || "");
  const [loginPassword, setLoginPassword] = useState(localStorage.getItem("capu_pass") || "");
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("capu_user"));
  
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [folders, setFolders] = useState([]);
  const [emails, setEmails] = useState([]);
  const [activeFolder, setActiveFolder] = useState("INBOX");
  const [selectedUid, setSelectedUid] = useState(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [bodyLoading, setBodyLoading] = useState(false);

  // 🪄 State ใหม่สำหรับจัดการ Sidebar บนมือถือ
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const getAuthHeaders = () => ({
    headers: { 
      'x-imap-user': localStorage.getItem("capu_user") || loginEmail, 
      'x-imap-pass': localStorage.getItem("capu_pass") || loginPassword 
    } 
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/login`, { email: loginEmail, password: loginPassword });
      
      if (res.data.success) {
        localStorage.setItem("capu_user", loginEmail);
        localStorage.setItem("capu_pass", loginPassword);
        
        try {
          const tempHeaders = { headers: { 'x-imap-user': loginEmail, 'x-imap-pass': loginPassword } };
          const [foldersRes, emailsRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/api/folders`, tempHeaders),
            axios.get(`${API_BASE_URL}/api/emails?folder=INBOX`, tempHeaders)
          ]);
          setFolders(foldersRes.data.data || foldersRes.data || []);
          setEmails(emailsRes.data.data || emailsRes.data || []);
        } catch (prefetchErr) {
          console.warn("โหลดข้อมูลล่วงหน้าสะดุดนิดหน่อย เดี๋ยวไปโหลดหน้าหลักต่อ", prefetchErr);
        }

        setIsLoggedIn(true);
      }
    } catch (err) {
      setLoginError(`Oops! ยูนิคอร์นเข้าบ้านไม่ได้: ${err.response?.data?.error || err.message}`);
    } finally { setIsLoggingIn(false); }
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    window.location.reload();
  };

  useEffect(() => {
    if (!isLoggedIn) {
      axios.get(API_BASE_URL).catch(() => {});
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && folders.length === 0) { 
      axios.get(`${API_BASE_URL}/api/folders`, getAuthHeaders())
        .then(res => setFolders(res.data.data || res.data))
        .catch(() => {});
    }
  }, [isLoggedIn, folders.length]);

  useEffect(() => {
    if (isLoggedIn && (activeFolder !== "INBOX" || emails.length === 0)) {
      setLoading(true);
      axios.get(`${API_BASE_URL}/api/emails?folder=${encodeURIComponent(activeFolder)}`, getAuthHeaders())
        .then(res => { setEmails(res.data.data || res.data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [isLoggedIn, activeFolder]);

  useEffect(() => {
    if (selectedUid) {
      setBodyLoading(true);
      setBody("");
      axios.get(`${API_BASE_URL}/api/email-content?folder=${encodeURIComponent(activeFolder)}&uid=${selectedUid}`, getAuthHeaders())
        .then(res => { setBody(res.data.content); setBodyLoading(false); })
        .catch(() => setBodyLoading(false));
    }
  }, [selectedUid, activeFolder]);

  // --- 🦄 UI หน้า Login ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#FCE4EC] p-4 font-sans">
        <div className="w-full max-w-sm bg-white border-4 border-[#F8BBD0] rounded-[3rem] shadow-[0_20px_50px_rgba(244,143,177,0.3)] p-8 relative overflow-hidden">
          <div className="absolute -top-5 -right-5 text-6xl opacity-20 rotate-12 pointer-events-none">🦄</div>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-[#AD1457] mb-2">UniPony Mail ✨</h1>
            <p className="text-xs text-[#F06292] font-bold tracking-widest uppercase">Magic Inbox Experience</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} 
                   className="w-full px-6 py-4 bg-[#FFF1F6] border-2 border-[#F8BBD0] rounded-full focus:ring-4 focus:ring-[#FCE4EC] outline-none text-[#880E4F]" required />
            <input type="password" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} 
                   className="w-full px-6 py-4 bg-[#FFF1F6] border-2 border-[#F8BBD0] rounded-full focus:ring-4 focus:ring-[#FCE4EC] outline-none text-[#880E4F]" required />
            {loginError && <div className="text-[#D81B60] text-xs text-center font-bold">❌ {loginError}</div>}
            <button className="w-full bg-gradient-to-r from-[#F06292] to-[#BA68C8] text-white py-4 rounded-full font-black text-lg shadow-lg hover:scale-105 transition-transform active:scale-95">
              {isLoggingIn ? "กำลังเตรียมของขวัญรอสักครู่..." : "เข้าสู่ระบบ 🦄"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- 🦄 UI หน้า Mailbox ---
  return (
    <div className="h-[100dvh] flex flex-col md:flex-row bg-[#FFF9FB] text-[#4A148C] font-sans overflow-hidden relative">
      
      {/* 🔮 Overlay มือถือสำหรับปิด Sidebar */}
      {showMobileSidebar && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar - Magic Purple (Responsive Drawer) */}
      <div className={`fixed inset-y-0 left-0 z-50 transform md:relative md:translate-x-0 w-64 bg-gradient-to-b from-[#BA68C8] to-[#9575CD] text-white flex flex-col shrink-0 shadow-2xl transition-transform duration-300 ease-in-out ${showMobileSidebar ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-8 text-2xl font-black italic border-b border-white/20 flex items-center justify-between gap-2">
          <span>🦄 UniPony</span>
          {/* ปุ่มปิด Sidebar สำหรับมือถือ */}
          <button className="md:hidden text-xl" onClick={() => setShowMobileSidebar(false)}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {folders.map(f => (
            <button key={f.path} onClick={() => {
                setActiveFolder(f.path); 
                setSelectedUid(null); 
                setShowMobileSidebar(false); // ปิด Sidebar ตอนเลือกโฟลเดอร์บนมือถือ
              }} 
              className={`w-full text-left px-5 py-3 rounded-2xl text-sm transition-all flex items-center gap-3 ${activeFolder === f.path ? 'bg-white text-[#9575CD] font-bold shadow-lg' : 'hover:bg-white/10'}`}>
              🌈 {f.name}
            </button>
          ))}
        </div>
        <button onClick={handleLogout} className="m-4 py-3 bg-white/20 hover:bg-red-400 rounded-xl text-xs font-bold transition-all uppercase">ออกจากระบบ</button>
      </div>

      {/* Email List - Pastel Pink (ซ่อนบนมือถือถ้ากำลังอ่านอีเมล) */}
      <div className={`w-full md:w-[380px] bg-white md:border-r border-[#F8BBD0] flex-col shadow-inner ${selectedUid ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 font-black border-b border-[#F8BBD0] bg-[#FFF1F6] text-[#C2185B] uppercase tracking-widest flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-2xl p-1 -ml-2" onClick={() => setShowMobileSidebar(true)}>
              ☰
            </button>
            <span>{activeFolder}</span>
          </div>
          <span>✨</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-10 text-center text-[#F06292] animate-bounce">🦄 Gathering sparkles...</div>
          ) : (
            emails.map(m => (
              <div key={m.uid} onClick={() => setSelectedUid(m.uid)} 
                   className={`p-5 border-b border-[#FFF1F6] cursor-pointer transition-all ${selectedUid === m.uid ? 'bg-[#FCE4EC] border-l-8 border-l-[#F06292]' : 'hover:bg-[#FFF8FA]'}`}>
                <div className="text-sm font-black text-[#880E4F] truncate">{m.from}</div>
                <div className="text-xs text-[#AD1457] truncate mt-1 italic font-medium">{m.subject}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Email Content - Airy & Cute (ซ่อนบนมือถือถ้ายังไม่ได้เลือกอีเมล) */}
      <div className={`flex-1 bg-white overflow-y-auto p-6 md:p-12 relative flex-col ${!selectedUid ? 'hidden md:flex' : 'flex'}`}>
        <div className="absolute bottom-10 right-10 text-8xl opacity-5 pointer-events-none hidden md:block">🦄</div>
        {selectedUid ? (
          <div className="max-w-4xl mx-auto w-full">
            {/* Header ของเนื้อหาอีเมล + ปุ่ม Back บนมือถือ */}
            <div className="flex items-start md:items-center gap-4 mb-8">
              <button 
                onClick={() => setSelectedUid(null)}
                className="md:hidden mt-1 p-2 bg-[#FCE4EC] text-[#D81B60] rounded-full shadow-sm hover:scale-105 active:scale-95 transition-transform"
              >
                ⬅️
              </button>
              <h1 className="text-2xl md:text-3xl font-black text-[#4A148C] drop-shadow-sm flex-1 leading-snug">
                <span className="text-3xl md:text-4xl inline-block mr-2">💌</span> 
                {emails.find(e => e.uid === selectedUid)?.subject}
              </h1>
            </div>

            <div className="bg-[#FAF5FF] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-4 border-[#E1BEE7] text-[#4A148C] shadow-xl overflow-x-auto min-h-[400px]">
              {bodyLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-4">
                  <div className="animate-spin text-4xl">🪄</div>
                  <p className="font-bold text-[#BA68C8]">Casting a spell to read mail...</p>
                </div>
              ) : (
                <div className="prose prose-pink max-w-none prose-sm md:prose-base break-words" dangerouslySetInnerHTML={{ __html: body }} />
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[#CE93D8]">
            <span className="text-7xl md:text-9xl mb-6 animate-pulse">🌈</span>
            <p className="font-black text-lg md:text-xl italic uppercase tracking-widest text-center px-4">Select a rainbow message</p>
          </div>
        )}
      </div>
      
    </div>
  );
}
