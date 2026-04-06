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

      // 1. ลอง Login เช็คว่าผ่านไหม

      const res = await axios.post(`${API_BASE_URL}/api/login`, { email: loginEmail, password: loginPassword });

      

      if (res.data.success) {

        localStorage.setItem("capu_user", loginEmail);

        localStorage.setItem("capu_pass", loginPassword);

        

        // 🚀 2. PRE-FETCHING MAGIC: ดึงข้อมูลรอเลย ไม่ต้องรอเข้าหน้าหลัก

        try {

          // เตรียม Header ชั่วคราวเพราะ State อาจจะยังไม่อัปเดต

          const tempHeaders = { headers: { 'x-imap-user': loginEmail, 'x-imap-pass': loginPassword } };

          

          const [foldersRes, emailsRes] = await Promise.all([

            axios.get(`${API_BASE_URL}/api/folders`, tempHeaders),

            axios.get(`${API_BASE_URL}/api/emails?folder=INBOX`, tempHeaders)

          ]);



          // ยัดข้อมูลใส่ State รอไว้

          setFolders(foldersRes.data.data || foldersRes.data || []);

          setEmails(emailsRes.data.data || emailsRes.data || []);

        } catch (prefetchErr) {

          console.warn("โหลดข้อมูลล่วงหน้าสะดุดนิดหน่อย เดี๋ยวไปโหลดหน้าหลักต่อ", prefetchErr);

        }



        // 3. โหลดเสร็จแล้ว ค่อยสลับหน้า!

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



  // ปลุกเซิร์ฟเวอร์ Render ตอนเปิดหน้าเว็บ

  useEffect(() => {

    if (!isLoggedIn) {

      axios.get(API_BASE_URL).catch(() => {});

    }

  }, [isLoggedIn]);



  // useEffect สำหรับดึงข้อมูลเวลาโหลดหน้าซ้ำ (กรณีไม่ได้กด Login เข้ามาใหม่)

  useEffect(() => {

    if (isLoggedIn && folders.length === 0) { 

      axios.get(`${API_BASE_URL}/api/folders`, getAuthHeaders())

        .then(res => setFolders(res.data.data || res.data))

        .catch(() => {});

    }

  }, [isLoggedIn, folders.length]);



  // useEffect สำหรับดึงอีเมลเวลา "เปลี่ยนโฟลเดอร์"

  useEffect(() => {

    // โหลดเฉพาะตอนที่เปลี่ยนจาก INBOX เป็นอันอื่น หรือโหลดครั้งแรกแต่ pre-fetch ไม่ทำงาน

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

      <div className="min-h-screen flex items-center justify-center bg-[#FCE4EC] p-6 font-sans">

        <div className="w-full max-w-sm bg-white border-4 border-[#F8BBD0] rounded-[3rem] shadow-[0_20px_50px_rgba(244,143,177,0.3)] p-10 relative overflow-hidden">

          <div className="absolute -top-5 -right-5 text-6xl opacity-20 rotate-12">🦄</div>

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

    <div className="h-screen flex bg-[#FFF9FB] text-[#4A148C] font-sans overflow-hidden">

      {/* Sidebar - Magic Purple */}

      <div className="w-64 bg-gradient-to-b from-[#BA68C8] to-[#9575CD] text-white flex flex-col shrink-0 shadow-2xl">

        <div className="p-8 text-2xl font-black italic border-b border-white/20 flex items-center gap-2">

          <span>🦄</span> UniPony

        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">

          {folders.map(f => (

            <button key={f.path} onClick={() => {setActiveFolder(f.path); setSelectedUid(null);}} 

                 className={`w-full text-left px-5 py-3 rounded-2xl text-sm transition-all flex items-center gap-3 ${activeFolder === f.path ? 'bg-white text-[#9575CD] font-bold shadow-lg' : 'hover:bg-white/10'}`}>

              🌈 {f.name}

            </button>

          ))}

        </div>

        <button onClick={handleLogout} className="m-4 py-2 bg-white/20 hover:bg-red-400 rounded-xl text-[10px] font-bold transition-all uppercase">ออกจากระบบ</button>

      </div>



      {/* Email List - Pastel Pink */}

      <div className="w-[380px] bg-white border-r border-[#F8BBD0] flex flex-col shadow-inner">

        <div className="p-6 font-black border-b border-[#F8BBD0] bg-[#FFF1F6] text-[#C2185B] uppercase tracking-widest flex justify-between">

          <span>{activeFolder}</span>

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



      {/* Email Content - Airy & Cute */}

      <div className="flex-1 bg-white overflow-y-auto p-12 relative">

        <div className="absolute bottom-10 right-10 text-8xl opacity-5 pointer-events-none">🦄</div>

        {selectedUid ? (

          <div className="max-w-4xl mx-auto">

            <h1 className="text-3xl font-black mb-8 text-[#4A148C] drop-shadow-sm flex items-center gap-4">

              <span className="text-4xl">💌</span> {emails.find(e => e.uid === selectedUid)?.subject}

            </h1>

            <div className="bg-[#FAF5FF] p-10 rounded-[3rem] border-4 border-[#E1BEE7] text-[#4A148C] shadow-xl overflow-x-auto min-h-[400px]">

              {bodyLoading ? (

                <div className="flex flex-col items-center justify-center h-48 gap-4">

                  <div className="animate-spin text-4xl">🪄</div>

                  <p className="font-bold text-[#BA68C8]">Casting a spell to read mail...</p>

                </div>

              ) : (

                <div className="prose prose-pink max-w-none" dangerouslySetInnerHTML={{ __html: body }} />

              )}

            </div>

          </div>

        ) : (

          <div className="h-full flex flex-col items-center justify-center text-[#CE93D8]">

            <span className="text-9xl mb-6 animate-pulse">🌈</span>

            <p className="font-black text-xl italic uppercase tracking-widest">Select a rainbow message</p>

          </div>

        )}

      </div>

    </div>

  );

}

