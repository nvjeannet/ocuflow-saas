'use strict';

const {sin,cos,floor,abs,min,PI,sqrt}=Math;
const M=0.08; // margin ratio

// ── Poursuite douce ───────────────────────────────────────────────────────────
const posH    =(p,W,H)=>({x:(M+(sin(p)+1)/2*(1-2*M))*W,y:H*.5});
const posV    =(p,W,H)=>({x:W*.5,y:(M+(sin(p)+1)/2*(1-2*M))*H});
const posD1   =(p,W,H)=>{const q=(sin(p)+1)/2;return{x:(M+q*(1-2*M))*W,y:(M+q*(1-2*M))*H};};
const posD2   =(p,W,H)=>{const q=(sin(p)+1)/2;return{x:((1-M)-q*(1-2*M))*W,y:(M+q*(1-2*M))*H};};
const posCW   =(p,W,H)=>({x:W*.5+(W*.5-M*W)*cos(p),y:H*.5+(H*.5-M*H)*sin(p)});
const posCCW  =(p,W,H)=>({x:W*.5+(W*.5-M*W)*cos(-p),y:H*.5+(H*.5-M*H)*sin(-p)});
const posLH   =(p,W,H)=>({x:W*.5+(W*.5-M*W)*sin(p),y:H*.5+(H*.5-M*H)*.58*sin(2*p)});
const posLV   =(p,W,H)=>({x:W*.5+(W*.5-M*W)*.58*sin(2*p),y:H*.5+(H*.5-M*H)*sin(p)});
const posSprl =(p,W,H)=>{const r=min(W*(0.5-M),H*(0.5-M))*abs(sin(p*.28));return{x:W*.5+r*cos(p),y:H*.5+r*sin(p)};};
const posZZ   =(p,W,H)=>{const row=[M,.5,1-M][floor(p/PI)%3];return{x:(M+(sin(p)+1)/2*(1-2*M))*W,y:row*H};};

// ── Saccades ──────────────────────────────────────────────────────────────────
const ST=PI; // step interval in phase units
const hash=n=>{const x=sin(n*127.1+311.7)*43758.5453;return x-floor(x);};
const posSH  =(p,W,H)=>({x:(floor(p/ST)%2===0?M:1-M)*W,y:H*.5});
const posSV  =(p,W,H)=>({x:W*.5,y:(floor(p/ST)%2===0?M:1-M)*H});
const posSR  =(p,W,H)=>{const s=floor(p/ST);return{x:(M+hash(s*2)*(1-2*M))*W,y:(M+hash(s*2+1)*(1-2*M))*H};};
const GRID_SEQ=[4,0,8,6,2,3,7,1,5];
const posSG  =(p,W,H)=>{const s=GRID_SEQ[floor(p/ST)%9];return{x:(M+(s%3)/2*(1-2*M))*W,y:(M+floor(s/3)/2*(1-2*M))*H};};

// ── Accommodation ─────────────────────────────────────────────────────────────
const posZm  =(p,W,H)=>({x:W*.5,y:H*.5,sz:.28+(sin(p)+1)/2*2.6});
const posNas =(p,W,H)=>{
  const t=(sin(p)+1)/2; // t=0 loin, t=1 près
  const r=(1-t)*min(W*(0.5-M),H*(0.5-M));
  return{x:W*.5+r*cos(p*.5),y:H*.5+r*sin(p*.5)*.28,sz:.38+t*2.3};
};
const posDpt =(p,W,H)=>{
  const near=floor(p/ST)%2===0;
  const c=floor(p/ST)%4;
  const xs=[M,1-M,1-M,M],ys=[M,M,1-M,1-M];
  return near?{x:W*.5,y:H*.5,sz:2.4}:{x:xs[c]*W,y:ys[c]*H,sz:.35};
};

const pos2020 =(p,W,H)=>({x:W*.5,y:H*.5,special:'2020'});
const posPalm =(p,W,H)=>({x:W*.5,y:H*.5,special:'palming'});

const MOVEMENTS_DATA = [
  // Poursuite douce
  {id:0, cat:'pursuit',name:'Horizontal', icon:'↔', fn:posH, lp:.14, desc:'Améliore la coordination horizontale et la stabilité du suivi.', benefit:'Détend les muscles rectus horizontaux.'},
  {id:1, cat:'pursuit',name:'Vertical', icon:'↕', fn:posV, lp:.14, desc:'Renforce les muscles supérieurs et inférieurs pour un balayage fluide.', benefit:'Renforce les muscles rectus verticaux.'},
  {id:2, cat:'pursuit',name:'Diag. ↗', icon:'↗', fn:posD1, lp:.14, desc:'Travaille la coordination complexe des muscles obliques.', benefit:'Améliore la coordination oblique.'},
  {id:3, cat:'pursuit',name:'Diag. ↖', icon:'↖', fn:posD2, lp:.14, desc:'Équilibre la force musculaire entre les deux yeux.', benefit:'Assouplit les muscles obliques.'},
  {id:4, cat:'pursuit',name:'Rotation ↻', icon:'↻', fn:posCW, lp:.14, desc:'Exercice complet sollicitant tous les muscles oculomoteurs.', benefit:'Améliore l\'amplitude globale.'},
  {id:5, cat:'pursuit',name:'Rotation ↺', icon:'↺', fn:posCCW, lp:.14, desc:'Améliore la souplesse et l\'amplitude du mouvement oculaire.', benefit:'Équilibre la vision binoculaire.'},
  {id:6, cat:'pursuit',name:'Lemni. ↔', icon:'∞', fn:posLH, lp:.14, desc:'Le "8" couché favorise l\'intégration des deux hémisphères cérébraux.', benefit:'Synchronise les deux hémisphères.'},
  {id:7, cat:'pursuit',name:'Lemni. ↕', icon:'∞', fn:posLV, lp:.14, desc:'Stimule la vision périphérique et la fluidité verticale.', benefit:'Relaxe le focus central.'},
  {id:8, cat:'pursuit',name:'Spirale', icon:'⊛', fn:posSprl, lp:.14, desc:'Excellente pour la concentration et le contrôle précis du regard.', benefit:'Stimule la vision périphérique.'},
  {id:9, cat:'pursuit',name:'Zigzag', icon:'≋', fn:posZZ, lp:.28, desc:'Entraîne le passage rapide d\'une ligne à l\'autre (lecture).', benefit:'Booste la réactivité visuelle.'},
  // Saccades
  {id:10,cat:'saccade',name:'Saccades H', icon:'⇔', fn:posSH, lp:.9, desc:'Améliore la rapidité de capture d\'information visuelle.', benefit:'Tonifie les muscles de lecture.'},
  {id:11,cat:'saccade',name:'Saccades V', icon:'⇕', fn:posSV, lp:.9, desc:'Réduit le temps de réaction entre deux points d\'intérêt.', benefit:'Améliore le balayage visuel.'},
  {id:12,cat:'saccade',name:'Aléatoire', icon:'⁂', fn:posSR, lp:.9, desc:'Entraîne les yeux à réagir à l\'imprévu dans le champ visuel.', benefit:'Réduit la rigidité oculaire.'},
  {id:13,cat:'saccade',name:'Grille 3×3', icon:'⊞', fn:posSG, lp:.9, desc:'Travaille la précision du saut oculaire sur des points fixes.', benefit:'Précision de fixation.'},
  // Accommodation
  {id:14,cat:'accom', name:'Zoom', icon:'⊙', fn:posZm, lp:.14, desc:'Assouplit le cristallin pour une mise au point plus rapide.', benefit:'Muscle le corps ciliaire (focus).'},
  {id:15,cat:'accom', name:'Convergence', icon:'⊕', fn:posNas, lp:.14, desc:'Lutte contre l\'insuffisance de convergence liée aux écrans.', benefit:'Corrige l\'insuffisance de convergence.'},
  {id:16,cat:'accom', name:'Profondeur', icon:'◎', fn:posDpt, lp:.45, desc:'Alterne vision de près et de loin pour détendre le muscle ciliaire.', benefit:'Améliore la flexibilité focale.'},
  // Relaxation
  {id:17,cat:'relax', name:'20-20-20', icon:'👁', fn:pos2020, lp:.14, desc:'Méthode standard pour prévenir la fatigue numérique.', benefit:'Relâche la tension de l\'écran.'},
  {id:18,cat:'relax', name:'Palmage', icon:'🤲', fn:posPalm, lp:.14, desc:'Repose la rétine et détend l\'ensemble du système visuel.', benefit:'Repos total de la rétine.'},
];
