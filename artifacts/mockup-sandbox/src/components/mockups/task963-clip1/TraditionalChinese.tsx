import React, { useState } from "react";
import "./_group.css";

const photo = "/__mockup/images/task963-clip1/next-photo.jpg";

function Icon({ type }: { type: "home" | "report" | "snap" | "trend" | "user" }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></>,
    report: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    snap: <><path d="M4 7h3l1.5-2h5L15 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="3.2" /></>,
    trend: <><path d="M4 16V8M9 16V5M14 16v-3M19 16V3" /><path d="m3 18 6-6 4 3 7-9" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M4 21c.7-4 3.2-6 8-6s7.3 2 8 6" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

export function TraditionalChinese() {
  const [run, setRun] = useState(0);
  return (
    <main className="glukkyClip1" key={run}>
      <button className="clip1Replay" aria-label="重新播放" onClick={() => setRun((value) => value + 1)}>↻</button>
      <div className="clip1Scroll">
        <header className="clip1Header">
          <p className="clip1Week">星期三</p>
          <h1 className="clip1Hello">你好！</h1>
        </header>
        <section className="clip1Card clip1PhotoCard" aria-label="香港舊照片獎勵">
          <div className="clip1PhotoFrame">
            <img className="clip1PhotoOld" src={photo} alt="" />
            <img className="clip1PhotoNew" src={photo} alt="香港舊照片" />
            <div className="clip1PhotoShade" />
            <div className="clip1Unlock"><strong>第一張照片即將解鎖</strong><span>累積 5 點，即可顯示這個系列的第一張照片。</span></div>
            <div className="clip1Sweep" />
          </div>
          <h2 className="clip1PhotoTitle">香港舊照片（1970年代）</h2>
          <p className="clip1PhotoDesc">每累積 5 點，便會顯示下一張歷史照片。</p>
          <div className="clip1Progress">
            <span className="clip1ProgressLabel"><span className="before">4 / 60 收藏點數</span><span className="after">5 / 60 收藏點數</span></span>
            <span className="clip1ProgressLabel right"><span className="before">4 / 5 點</span><span className="after">第 1 / 12 張照片</span></span>
          </div>
          <div className="clip1Bar"><i /></div>
        </section>
        <section className="clip1Card clip1Tasks" aria-label="今天你達成了什麼健康小習慣？">
          <h2>今天你達成了什麼健康小習慣？</h2>
          <div className="clip1TaskRow"><button className="clip1Check" type="button" aria-label="完成飯後散步10分鐘" /><span>飯後散步10分鐘</span></div>
          <p className="clip1Good">做得好！</p>
        </section>
      </div>
      <nav className="clip1Nav" aria-label="主要導覽">
        <div className="clip1NavItem active"><Icon type="home" /><span>主頁</span></div>
        <div className="clip1NavItem"><Icon type="report" /><span>報告</span></div>
        <div className="clip1NavItem"><Icon type="snap" /><span>食物快拍</span></div>
        <div className="clip1NavItem"><Icon type="trend" /><span>血糖規律</span></div>
        <div className="clip1NavItem"><Icon type="user" /><span>個人資料</span></div>
      </nav>
    </main>
  );
}