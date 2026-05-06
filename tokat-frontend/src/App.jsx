import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [nickname, setNickname] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  
  // Hasar seviyelerini ondalıklı tutacağız (0.0 ile 1.0 arası opacity için)
  const [damage, setDamage] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [shake, setShake] = useState(false);
  const [totalHits, setTotalHits] = useState(0);
  const [clickEffect, setClickEffect] = useState(null);

  const clickCountRef = useRef(0);
  const slapToggleRef = useRef(false);
  const audioRefs = useRef(null);

  // Ses yükleme ve leaderboard intervali
  useEffect(() => {
    audioRefs.current = {
      slap1: new Audio('/sounds/slap1.mp3'),
      slap2: new Audio('/sounds/slap2.mp3'),
      punch: new Audio('/sounds/punch.mp3'),
      smack: new Audio('/sounds/smack.mp3')
    };

    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get(`${API_URL}/leaderboard`);
        setLeaderboard(res.data);
      } catch (err) {
        console.error("Liderlik tablosu çekilemedi", err);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  // Hasarların zamanla iyileşmesi (peş peşe vurma hissiyatı)
  useEffect(() => {
    if (!isStarted) return;
    const healInterval = setInterval(() => {
      setDamage(prev => ({
        left: Math.max(0, prev.left - 0.05),
        right: Math.max(0, prev.right - 0.05),
        top: Math.max(0, prev.top - 0.05),
        bottom: Math.max(0, prev.bottom - 0.05),
      }));
    }, 150);

    return () => clearInterval(healInterval);
  }, [isStarted]);

  const sendSlapsToBackend = async (clicksToSend) => {
    if (!nickname) return;
    try {
      await axios.post(`${API_URL}/slap`, { nickname, clicks: clicksToSend });
    } catch (err) {
      console.error("Backend'e gönderilemedi", err);
    }
  };

  const playSound = (zone) => {
    if (!audioRefs.current) return;
    let soundToPlay;
    if (zone === "bottom") soundToPlay = audioRefs.current.punch;
    else if (zone === "top") soundToPlay = audioRefs.current.smack;
    else {
      soundToPlay = slapToggleRef.current ? audioRefs.current.slap2 : audioRefs.current.slap1;
      slapToggleRef.current = !slapToggleRef.current; 
    }
    soundToPlay.currentTime = 0; 
    soundToPlay.play().catch(e => console.log("Ses çalınamadı:", e));
  };

  const handleHit = (e) => {
    if (!isStarted) return;
    
    // Mobil cihazlarda basılı kalmayı ve takılmayı önler
    if(e.pointerId) e.currentTarget.releasePointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { width, height } = rect;

    // Tıklama efekti gösterimi için koordinat
    setClickEffect({ x: e.clientX, y: e.clientY, id: Date.now() });

    let zone = "";
    if (y > height * 0.65) zone = "bottom"; 
    else if (y < height * 0.25) zone = "top"; 
    else {
      if (x < width / 2) zone = "left"; 
      else zone = "right"; 
    }

    playSound(zone);

    // Vurulan bölgenin hasarını arttır (maksimum 1.0)
    setDamage(prev => ({ ...prev, [zone]: Math.min(1.0, prev[zone] + 0.3) }));
    setTotalHits(prev => prev + 1);

    clickCountRef.current += 1;
    if (clickCountRef.current >= 5) {
      sendSlapsToBackend(clickCountRef.current);
      clickCountRef.current = 0;
    }

    setShake(true);
    setTimeout(() => setShake(false), 100);
  };

  if (!isStarted) {
    return (
      <div className="app-wrapper">
        <div className="glass-panel login-screen">
          <h1 className="title-glow">TOKATLA!</h1>
          <p className="subtitle">Hedefini belirle ve stres at</p>
          <div className="input-group">
            <input 
              type="text" 
              placeholder="Nickini gir savaşçı..." 
              value={nickname} 
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nickname && setIsStarted(true)}
            />
            <button className="btn-primary" onClick={() => nickname && setIsStarted(true)}>
              RİNGE ÇIK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {/* Tıklama Efekti */}
      {clickEffect && (
        <div 
          className="hit-particle"
          style={{ left: clickEffect.x, top: clickEffect.y }}
          key={clickEffect.id}
          onAnimationEnd={() => setClickEffect(null)}
        >
          💥
        </div>
      )}

      <div className="game-layout">
        <div className="glass-panel leaderboard-panel">
          <h3>🏆 Şampiyonlar</h3>
          <div className="leaderboard-list">
            {leaderboard.map((user, i) => (
              <div className="leaderboard-item" key={i}>
                <span className="rank">#{i+1}</span>
                <span className="nick">{user.nickname}</span>
                <span className="score">{user.score} 🤜</span>
              </div>
            ))}
          </div>
        </div>

        <div className="main-arena">
          <div className="stats-badge glass-panel">
            Toplam Hasarın: <span>{totalHits}</span>
          </div>

          <div className={`body-container ${shake ? 'shake-hard' : ''}`} onPointerDown={handleHit}>
            <img src="/images/yuz_normal.png" className="base-character" alt="Hedef" />
            
            {/* Opaklıklar hasara göre dinamik artıp azalır */}
            <img src="/images/sol_sis.png" className="damage-layer" style={{ opacity: damage.left }} alt="Sol Hasar" />
            <img src="/images/sag_sis.png" className="damage-layer" style={{ opacity: damage.right }} alt="Sağ Hasar" />
            <img src="/images/alin_kizariyor.png" className="damage-layer" style={{ opacity: damage.top }} alt="Tepe Hasar" />
            <img src="/images/cene_bandi.png" className="damage-layer" style={{ opacity: damage.bottom }} alt="Gövde/Çene Hasar" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;