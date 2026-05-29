// ─── Badges ───
var BDEFS=[
  // Faciles — première partie
  {id:'first_quiz', icon:'🎉', name:'PREMIER PAS',     desc:'Termine ton premier quiz',           chk:function(s,e,c,tot){return tot>=1;}},
  {id:'5_correct',  icon:'⭐', name:'EN ROUTE',         desc:'5 bonnes réponses en un quiz',       chk:function(s,e,c,tot){return c>=5;}},
  {id:'no_err_5',   icon:'🎯', name:'PRÉCIS',           desc:'Quiz sans erreur (min 5 questions)', chk:function(s,e,c,tot){return e.length===0&&tot>=5;}},
  {id:'combo3',     icon:'🔥', name:'ON CHAUFFE',       desc:'Combo x3',                           chk:function(s,e,c,tot){return s.maxCombo>=3;}},
  // Moyens
  {id:'combo5',     icon:'⚡', name:'COMBO KING',       desc:'Combo x5',                           chk:function(s,e,c,tot){return s.maxCombo>=5;}},
  {id:'perfect',    icon:'💎', name:'PERFECTIONNISTE',  desc:'10/10 sans erreur',                  chk:function(s,e,c,tot){return c===tot&&e.length===0&&tot>=10;}},
  {id:'mix_win',    icon:'🎲', name:'TOUCHE-À-TOUT',    desc:'Quiz mix avec 7/10 minimum',         chk:function(s,e,c,tot){return s.cat==='mix'&&c>=7;}},
  {id:'srs_done',   icon:'🔁', name:'RÉVISEUR',         desc:'Termine une session de révision ciblée', chk:function(s,e,c,tot){return s.mode==='srs'&&tot>=5;}},
  {id:'mechs3',     icon:'🔧', name:'POLYVALENT',       desc:'3 types de questions différents',    chk:function(s,e,c,tot){return s.mechs&&s.mechs.size>=3;}},
  // Difficiles
  {id:'streak3',    icon:'📅', name:'RÉGULIER',         desc:'3 jours de streak',                  chk:function(s,e,c,tot){return s.streak>=3;}},
  {id:'streak7',    icon:'🏆', name:'EN FEU',           desc:'7 jours de streak',                  chk:function(s,e,c,tot){return s.streak>=7;}},
  {id:'mechs5',     icon:'🧠', name:'MULTI-TALENT',     desc:'5 types de questions différents',    chk:function(s,e,c,tot){return s.mechs&&s.mechs.size>=5;}},
  {id:'duel_win',   icon:'⚔️', name:'DUELLISTE',        desc:'Gagne un duel',                      chk:function(s,e,c,tot,m){return m==='duel'&&c>tot/2;}},
  {id:'cisco_ace',  icon:'🔵', name:'CISCO ACE',        desc:'10/10 en Cisco',                     chk:function(s,e,c,tot){return s.cat==='cisco'&&c===tot&&tot>=10;}},
];

// ─── data.js — Banques de questions TSSR (Vidé et migré vers Firestore) ───
var CATS={
  reseau:    {label:"Présentation Réseau",     icon:"🌐", desc:"OSI, TCP/IP, équipements, adressage", cat:"cat-reseau", qs:[]},
  cisco:     {label:"Cisco IOS — Commandes",   icon:"🔵", desc:"Commandes IOS, config, dépannage", cat:"cat-cisco", qs:[]},
  vlan:      {label:"VLANs & Trunks",          icon:"🔶", desc:"VLANs, trunks, DTP, VTP, inter-VLAN", cat:"cat-vlan", qs:[]},
  stp:       {label:"STP & EtherChannel",      icon:"🔁", desc:"Spanning Tree, RSTP, EtherChannel", cat:"cat-stp", qs:[]},
  routage:   {label:"Routage Statique",        icon:"🗺️", desc:"Routes statiques, next-hop, distance admin", cat:"cat-routage", qs:[]},
  secu:      {label:"Sécurité Switch & Réseau",icon:"🛡️", desc:"Port Security, DHCP snooping, attaques", cat:"cat-secu", qs:[]},
  windows:   {label:"Windows Server",          icon:"🖥️", desc:"Admin, WAC, PowerShell, WinRM, AD", cat:"cat-windows", qs:[]},
  dns:       {label:"DNS & Noms d'hôtes",      icon:"📡", desc:"Résolution, zones, enregistrements", cat:"cat-dns", qs:[]},
  ntfs:      {label:"NTFS & Permissions",      icon:"🔑", desc:"ACL, droits, groupes, héritage", cat:"cat-ntfs", qs:[]},
  hyperv:    {label:"Hyper-V & Virtualisation",icon:"📦", desc:"VMs, snapshots, réseau virtuel", cat:"cat-hyperv", qs:[]},
  raid:      {label:"Stockage & RAID",         icon:"💾", desc:"RAID, DAS, NAS, SAN, iSCSI", cat:"cat-raid", qs:[]},
  cmd:       {label:"Commandes Cisco & Windows",icon:"⌨️", desc:"Commandes clés à connaître pour l'exam", cat:"cat-cmd", qs:[]},
  ad:        {label:"Active Directory",        icon:"🗄️", desc:"AD DS, GPO, Kerberos, OU, utilisateurs", cat:"cat-windows", qs:[]},
  wlan:      {label:"WLAN & Sans Fil",         icon:"📶", desc:"Wi-Fi, sécurité sans fil, CAPWAP", cat:"cat-cisco", qs:[]},
  ps:        {label:"PowerShell",              icon:"🐚", desc:"Cmdlets, pipeline, scripts, gestion Windows", cat:"cat-cmd", qs:[]},
  sauvegarde:{label:"Sauvegarde & PRA",        icon:"💾", desc:"Méthodes, RTO/RPO, PRA/PCA, règle 3-2-1", cat:"cat-windows", qs:[]},
  mbr:       {label:"MBR, GPT & Partitions",   icon:"💽", desc:"Démarrage, partitionnement, systèmes de fichiers", cat:"cat-hyperv", qs:[]},
  abe:       {label:"ABE & Partages",          icon:"🔍", desc:"Access-Based Enumeration, SMB, DFS", cat:"cat-windows", qs:[]},
  fsrm:      {label:"FSRM & Quotas",           icon:"📦", desc:"Quotas, seuils, modèles, File Server Resource Manager", cat:"cat-windows", qs:[]},
  groupes_ad:{label:"Groupes Active Directory",icon:"👥", desc:"Types, étendues, AGDLP, built-in", cat:"cat-windows", qs:[]},
  mix:       {label:"Mix — Tout en vrac",      icon:"🎲", desc:"Toutes catégories et mécaniques mélangées", cat:"cat-mix", qs:[]}
};

// Build mix
(function(){
  var ids = Object.keys(CATS).filter(function(k){return k!=='mix';});
  ids.forEach(function(id){
    if (CATS[id] && CATS[id].qs) {
      CATS.mix.qs = CATS.mix.qs.concat(CATS[id].qs.map(function(q){
        return Object.assign({}, q, {_cat: CATS[id].label});
      }));
    }
  });
})();
