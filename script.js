const zoomOutButton = document.getElementById('zoomOut');
const zoomInButton = document.getElementById('zoomIn');
const zoomResetButton = document.getElementById('zoomReset');
const zoomValueLabel = document.getElementById('zoomValue');
const viewer = document.getElementById('viewer');
const mapWrapper = document.getElementById('mapWrapper');
const mapObject = document.getElementById('mapObject');
const mapLoaderOverlay = document.getElementById('mapLoaderOverlay');
const mapErrorCenterMessage = document.getElementById('mapErrorCenterMessage');
const modalOverlay = document.getElementById('modalOverlay');
const modalCloseButton = document.getElementById('modalClose');
const roomValidationStatus = document.getElementById('roomValidationStatus');
const roomCodeValue = document.getElementById('roomCodeValue');
const roomCodeNameValue = document.getElementById('roomCodeNameValue');
const roomOccupazioneValue = document.getElementById('roomOccupazioneValue');
const roomDepartmentValue = document.getElementById('roomDepartmentValue');
const roomSurfaceValue = document.getElementById('roomSurfaceValue');
const roomHemifloorValue = document.getElementById('roomHemifloorValue');
const roomAccreditationValue = document.getElementById('roomAccreditationValue');
const roomBedCountValue = document.getElementById('roomBedCountValue');
const roomFurnitureNotesValue = document.getElementById('roomFurnitureNotesValue');
const roomCodeNameInput = document.getElementById('roomCodeNameInput');
const roomOccupazioneInput = document.getElementById('roomOccupazioneInput');
const roomDepartmentInput = document.getElementById('roomDepartmentInput');
const roomSurfaceInput = document.getElementById('roomSurfaceInput');
const roomHemifloorInput = document.getElementById('roomHemifloorInput');
const roomAccreditationInput = document.getElementById('roomAccreditationInput');
const roomBedCountInput = document.getElementById('roomBedCountInput');
const roomFurnitureNotesInput = document.getElementById('roomFurnitureNotesInput');
const editRoomCodeNameButton = document.getElementById('editRoomCodeNameButton');
const editRoomOccupazioneButton = document.getElementById('editRoomOccupazioneButton');
const editRoomDepartmentButton = document.getElementById('editRoomDepartmentButton');
const editRoomSurfaceButton = document.getElementById('editRoomSurfaceButton');
const editRoomHemifloorButton = document.getElementById('editRoomHemifloorButton');
const editRoomAccreditationButton = document.getElementById('editRoomAccreditationButton');
const editRoomBedCountButton = document.getElementById('editRoomBedCountButton');
const editRoomFurnitureNotesButton = document.getElementById('editRoomFurnitureNotesButton');
const sectionApparecchiaturaButton = document.getElementById('sectionApparecchiatura');
const sectionImpiantisticaButton = document.getElementById('sectionImpiantistica');
const sectionAltreDotazioniButton = document.getElementById('sectionAltreDotazioni');
const contentApparecchiatura = document.getElementById('contentApparecchiatura');
const contentImpiantistica = document.getElementById('contentImpiantistica');
const contentAltreDotazioni = document.getElementById('contentAltreDotazioni');
const apparecchiaturaTableBody = document.getElementById('apparecchiaturaTableBody');
const impiantisticaTableBody = document.getElementById('impiantisticaTableBody');
const altreDotazioniTableBody = document.getElementById('altreDotazioniTableBody');
const appTipologiaInput = document.getElementById('appTipologiaInput');
const appInstallazioneTipologiaInput = document.getElementById('appInstallazioneTipologiaInput');
const appProduttoreInput = document.getElementById('appProduttoreInput');
const appModelloInput = document.getElementById('appModelloInput');
const appQtaInput = document.getElementById('appQtaInput');
const appNuovoInput = document.getElementById('appNuovoInput');
const appTrasferimentoInput = document.getElementById('appTrasferimentoInput');
const appInvInput = document.getElementById('appInvInput');
const appNoteInput = document.getElementById('appNoteInput');
const appAddButton = document.getElementById('appAddButton');
const appSaveButton = document.getElementById('appSaveButton');
const appCancelButton = document.getElementById('appCancelButton');
let appTipologiaTomSelect = null;

const minZoom = 0.1;
const maxZoom = 50;
const zoomStep = 0.2;
let currentZoom = 2;
let baseImageWidth = 0;
let baseImageHeight = 0;
let activeFieldBeingEdited = null;
let editingApparecchiaturaIndex = null;
let editingImpiantisticaIndex = null;
let editingAltreDotazioniIndex = null;
let requestedFloorName = '';
let activeRoomContext = null;
let lastModalRequestToken = 0;
const floorNamePattern = /^[a-z0-9-]+$/i;
const mapLoadMinMs = 2000;
let mapLoadMinMet = false;
let mapLoadResourceMet = false;
let mapLoadMinTimeoutId = null;
const apparecchiaturaTipologiaOptions = ['', 'Carrellato', 'Parete', 'Pensile', 'Soffitto'];
const apparecchiaturaCatalogText = `
ABLATORE PER ARTERIECTOMIA
ABLAZIONE CARDIACA A RADIOFREQUENZA, APPARECCHIO PER
AEROSOL, APPARECCHIO PER
AGITATORE DA LABORATORIO
ANALISI FUNZIONALITA ESOFAGEA, SISTEMA PER
ANALISI SFORZO, SISTEMA PER
ANALIZZATORE DI GAS
ANALIZZATORE DI PARTICELLE
ANALIZZATORE DI SEQUENZE NUCLEOTIDICHE
ANALIZZATORE FIBRINOGENO
ANALIZZATORE GRUPPO SANGUIGNO
ANALIZZATORE VISIONE PERIFERICA
ANALIZZATORE/PROGRAMMATORE PER CARDIOSTIMOLATORI
ANESTESIA, APPARECCHIO PER
ANESTESIA, APPARECCHIO PER (AMAGNETICO)
ANGIOGRAFIA DIGITALE, SISTEMA PER
APPARECCHIO MOTORIZZATO, GENERATORE PER
APPARECCHIO PER SEDAZIONE COSCIENTE
APPLICAZIONE FILI CHIRURGICI, APPARECCHIO PER
ARMADIO STERILE PER ENDOSCOPI
ARTROSCOPIO
ASPIRATORE FUMI CHIRURGICI
ASPIRATORE MEDICO CHIRURGICO (ELETTRICO)
ASPIRATORE PER BIOPSIA
ASPIRATORE POLVERI DERIVANTI DAL TAGLIO GESSO
ASSISTENZA VENTRICOLARE, SISTEMA PER
AUDIOMETRO
AUTOCAMPIONATORE
AUTOCLAVE
AUTOCLAVE PER PICCOLI CARICHI
AUTOREFRATTOMETRO
AUTOTRASFUSIONE, APPARECCHIO PER
BAGNO TERMOSTATICO
BARELLA PER RISONANZA MAGNETICA
BASE PER TESTIERA
BETA/GAMMA DETECTOR
BILANCIA ANALITICA
BILANCIA PESA NEONATI
BILANCIA PESA PERSONE
BILANCIA PESA PERSONE CON ALTIMETRO
BILANCIA TECNICA
BILIRUBINOMETRO
BILIRUBINOMETRO CUTANEO
BIO-FEEDBACK, APPARECCHIATURA PER
BIOMETRO OTTICO COMPUTERIZZATO
BIOREATTORE
BISTURI AD ULTRASUONI
BOBINA PER TRM
BRACCIO ROBOTIZZATO PER CHIRURGIA
BRACCIO ROBOTIZZATO PER VIDEOENDOSCOPIO
BRONCOASPIRATORE
BRONCOSCOPIO
CALIBRATORE PER FONOMETRO
CALIBRO OSSEO
CAMERA FREDDA
CABINA AUDIOMETRICA
CAMPIONATORE ARIA, APPARECCHIO PER
CAMPIONATORE AUTOMATICO
CAPILLARISCOPIO
CAPNOMETRO/CAPNOGRAFO
CAPPA ASPIRANTE
CAPPA BIOLOGICA
CAPPA STERILE
CAPPA STERILE A RAGGI ULTRAVIOLETTI
CARDIOSTIMOLATORE ESTERNO
CARRELLO PORTAPIANO
CASCO STEREOTASSICO
CATENA TV
CENTRALE MONITORAGGIO
CENTRIFUGA
CENTRIFUGA REFRIGERATA
CICLO PER USI FISIOTERAPICI E/O DIAGNOSTICI
CICLOERGOMETRO
CIRCOLAZIONE EXTRACORPOREA, SISTEMA PER
CISTOSCOPIO
CISTOURETROSCOPIO
CITOCENTRIFUGA
CITOFLUORIMETRO
CITOMETRO A FLUSSO
CLORURIMETRO
COAGULOMETRO
COLEDOCOSCOPIO
COLONNA ENDOSCOPIA FLESSIBILE
COLONNA PER LAPAROSCOPIA
COLORATORE AUTOMATICO
COLORATORE AUTOMATICO DI TESSUTI
COLPOSCOPIO
COMPRESSORE
COMPRESSORE CARDIACO
CONFEZIONATRICE SOTTOVUOTO
CONGELATORE DA LABORATORIO
CONGELAZIONE CONTROLLATA, APPARECCHIATURA PER
CONSOLE DI COMANDO INIETTORE PER ANGIOGRAFIA
CONSOLE DI COMANDO INIETTORE PER MEZZI DI CONTRASTO
CONSOLE DI COMANDO INIETTORE PER RISONANZA MAGNETICA
CONSOLLE PER GRUPPO RADIOLOGICO
CONTRANGOLO
CONTROLLO PER POMPE DI INFUSIONE, SISTEMA DI
CONTROPULSATORE AORTICO
CRIOCHIRURGIA, APPARECCHIO PER
CRIOSTATO
CROMATOGRAFO IN FASE LIQUIDA AD ELEVATE PRESTAZIONI
CROMATOGRAFO SU STRATO SOTTILE
DATALOGGER, SISTEMA PER
DEFIBRILLATORE
DENTALE A LUCE FREDDA, APPARECCHIO
DERMATOSCOPIO
DERMOGRAFO
DERMOTOMIA, APPARECCHIATURA PER
DIAFANOSCOPIO
DIAGNOSI DELL APPARATO DIGERENTE A CAPSULA DEGLUTTIBILE
DIALISI PERITONEALE, APPARECCHIO PER
DIFFRATTOMETRO
DISPENSATORE DOSE FDG
DISPLAY
DISPOSITIVO STIMOLAZIONE TRANSCUTANEA
DISTACCO SPIRALI PER ANEURISMI CEREBRALI, APPARECCHIO PER
DOSATORE
DOSIMETRO
ECOGASTROSCOPIO
ECOOFTALMOGRAFO
ECOTOMOGRAFO
ECOTOMOGRAFO PORTATILE
ECOVIDEOBRONCOSCOPIO
ECTOCITOMETRO
ELASTOMETRO
ELETTROBISTURI
ELETTROBISTURI PER ENDOSCOPIA
ELETTROCARDIOGRAFO
ELETTROENCEFALOGRAFO
ELETTROFISIOLOGIA OCULARE, SISTEMA PER
ELETTROFORESI, APPARECCHIO PER
ELETTROMETRO
ELETTROMIOGRAFO
ELETTROPORAZIONE, APPARECCHIO PER
ELETTRORETINOGRAFO
ELETTROTERAPIA, APPARECCHIO PER
EMETTITORE RAGGI UVA
EMISSIONI OTOACUSTICHE, APPARECCHIO PER
EMODIALISI, APPARECCHIO PER
EMOFILTRAZIONE, APPARECCHIO PER
EMOFLUSSIMETRO
EMOGASANALIZZATORE
EMOGLOBINA GLICOSILATA, APPARECCHIO PER
EMOGLOBINOMETRO
EMOSSIMETRO
EMOVELOCIMETRO
ENCEFALOSCOPIO
ENDOSCOPIO
ENDOSCOPIO PER INDAGINI AVANZATE
EROGATORE DI OSSIGENO
ESOFTALMOMETRO
ESOSCOPIO
EVACUATORE DI GAS ANESTETICI
EVAPORATORE
FANTOCCIO CONTROLLI QUALITA RX
FANTOCCIO PER ANGIOGRAFIA
FANTOCCIO PER PROVE DI RIANIMAZIONE
FANTOCCIO PER ULTRASUONI
FANTOCCIO X IMMAGINE MAMMOGRAFICA
FETOSCOPIO
FIBROSCOPIO PER INTUBAZIONE
FILTRAZIONE, SISTEMA PER
FISIOTERAPIA APPARECCHIO PER
FLUORANGIOGRAFO
FLUORIMETRO
FLUSSIMETRO ARIA 15 l/min
FLUSSIMETRO ARIA 30 l/min
FLUSSIMETRO OSSIGENO 15 l/min
FLUSSIMETRO OSSIGENO 30 l/min
FOTOTERAPIA PEDIATRICA, APPARECCHIO PER
FRIGOEMOTECA
FRIGOEMOTECA INTELLIGENTE
FRIGORIFERO BIOLOGICO
FRONTIFOCOMETRO
GASCROMATOGRAFO
GENERATORE DI ENERGIA A RADIOFREQUENZA/MICROONDE
GENERATORE DI IDROGENO
GENERATORE RADIOFREQUENZE
GENERATORE ULTRASUONI
GRUPPO DI CONTINUITA
IMPEDENZA CORPOREA, ANALIZZATORE DI
IMPEDENZOMETRO
INCLUSORE AUTOMATICO DI PARAFFINA
INCUBATORE
INCUBATORE AD ANIDRIDE CARBONICA
INCUBATRICE NEONATALE
INCUBATRICE NEONATALE DA TRASPORTO
INFANTOMETRO
INFUSIONE INTRAOSSEA. APPARECCHIO PER
INIETTORE ANGIOGRAFICO
INIETTORE MULTIPLO DI MEZZI DI CONTRASTO
INIETTORE PER RISONANZA MAGNETICA
INSUFFLATORE DI GAS
INTOLLERANZA AL LATTOSIO, APPARECCHIO PER
IONOFORESI, APPARECCHIO PER
IPO-IPERTERMIA, APPARECCHIO PER
IRRAGGIATORE DI ULTRAVIOLETTI
IRRIGATORE
ISTEROSCOPIO
ISTEROSUTTORE
KIT PER PROCEDURE CHIRURGICHE
LACCIO EMOSTATICO PNEUMATICO
LAMA VIDEOLARINGOSCOPIO
LAMPADA A FESSURA
LAMPADA A FLUORESCENZA
LAMPADA CROMOTERAPIA
LAMPADA DA FOTOTERAPIA CON MATERASSINO
LAMPADA FRONTALE
LAMPADA RAGGI INFRAROSSI
LAMPADA RAGGI ULTRAVIOLETTI
LAMPADA RAGGI ULTRAVIOLETTI-INFRAROSSI
LAMPADA SCIALITICA
LAMPADA SCIALITICA PORTATILE/MOBILE
LAPAROSCOPIO
LARINGOSCOPIO
LARINGOSTROBOSCOPIO
LASER A DIODI
LASER CHIRURGICO
LAVAGGIO AD ULTRASUONI, APPARECCHIATURA PER
LAVAGGIO E DISINFEZIONE, APPARECCHIO PER
LAVATRICE PER ENDOSCOPI
LETTINO ELETTRICO PER VISITE, ESAMI E TRATTAMENTI
LETTO ELETTROCOMANDATO PER TERAPIA INTENSIVA O RIANIMAZIONE
LETTO GINECOLOGICO
LETTO O POLTRONA A BILANCIA PER DIALISI
LETTO PER DEGENZA ELETTRIFICATO
LETTO PER RIANIMAZIONE NEONATALE
LETTO/POLTRONA ELETTRIFICATO DA PARTO
LETTORE HOLTER EEG
LITOTRITORE ENDOSCOPICO
LOCALIZZATORE DI FORAME APICALE
LUMINOMETRO
MAGNETOMETRO
MANOMETRIA GASTROENTEROLOGICA, APPARECCHIO PER
MAPPATURA CARDIACA, APPARECCHIO PER
MASTOSUTTORE
MEDIASTINOSCOPIO
MICROINFUSORE PORTATILE
MICROINIETTORE
MICROMANIPOLATORE
MICROSCOPIO DIGITALE DA LABORATORIO
MICROSCOPIO OPERATORIO
MICROSCOPIO OTTICO DA LABORATORIO
MICROTOMO
MICROTOMO AD ULTRASUONI
SPOT CHECK
MISURATORE DI PRESSIONE INTRACRANICA
MISURATORE DOPPLER DELLA GITTATA CARDIACA
MISURATORE GITTATA CARDIACA
MODULO PER LA COAGULAZIONE AD ARGON
MONITOR
MONITOR CENTRALIZZATO
MONITOR FETALE
MONITOR TELEVISIVO PER BIOIMMAGINI
MONITOR TRANSCUTANEO PCO2/SPO2
MONITOR TRANSCUTANEO PO2/PCO2
MONITORAGGIO DEL SISTEMA NERVOSO, SISTEMA PER IL
MONITORAGGIO DELLA TRASMISSIONE NEUROMUSCOLARE, APPARECCHIO PER
MONTA VETRINI AUTOMATICO
MORCELLATORE
NASO FARINGO/LARINGOSCOPIO
NEFROSCOPIO
OFTALMOMETRO
OFTALMOSCOPIO
OSSIDO NITRICO, EROGATORE DI
OSSIMETRO CEREBRALE
OTOSCOPIO
OTTICA PER ENDOSCOPIA
OTTICA RIGIDA
PASTORIZZATORE
PENSILE
PENSILE DOPPIO
PIATTAFORMA PER INCUBATRICE NEONATALE DA TRASPORTO
PLETISMOGRAFO
POLIGRAFO
POLISONNIGRAFO
POMPA A SIRINGA
POMPA A SIRINGA (TIVA)
POMPA DI INFUSIONE
POMPA PER IRRIGAZIONE LAPAROSCOPIA
PORTATILE PER RADIOGRAFIA, APPARECCHIO
PORTATILE PER RADIOSCOPIA, APPARECCHIO
POSIZIONAMENTO ELETTRODI DI STIMOLAZIONE CEREBRALE, SISTEMA
POTENZIALI EVOCATI, APPARECCHIO PER L ANALISI DEI
PREPARATORE LIQUIDO DI DIALISI
PRESSIONE POSITIVA CONTINUA, APPARECCHIO PER (CPAP)
PRESSOTERAPIA, APPARECCHIO PER
PRODUZIONE ACQUA PURA, APPARECCHIO PER
PROGRAMMATORE PER VALVOLA IDROCEFALICA
PROGRAMMATORE PORTATILE PER NEUROSTIMOLATORE
PULSOSSIMETRO
PUPILLOMETRIA, APPARECCHIO PER
RADIOBISTURI
RECUPERO LIQUIDI ORGANICI, APPARECCHIO PER
HOLTER DELLA PRESSIONE SANGUIGNA
HOLTER ECG
HOLTER PER PARAMETRI FISIOLOGICI
REGOLATORE PER VUOTO
RESECTOSCOPIO
RETINOGRAFO
RETINOSCOPIO
RINOSCOPIO
RIPRODUTTORE VIDEO O DIGITALE DI BIOIMMAGINI
RISCALDATORE LIQUIDI PER IRRIGAZIONE
RISCALDATORE PER INFUSIONE
RISCALDATORE RADIANTE PER NEONATI
RISCALDATORE SANGUIGNO
RIUNITO DENTISTICO
RIUNITO OFTALMOLOGICO
RIUNITO OTORINOLARINGOIATRICO
RIVELATORE BATTITO CARDIACO FETALE
SALDATORE DI SACCHE
SCALDASACCHE A BAGNO TERMOSTATICO
SCALDASACCHE A SECCO
CIRCOLAZIONE EXTRACORPOREA (CEC)
SEGA PER GESSI
SEGA PER ORTOPEDIA
SFIGMOMANOMETRO
SISTEMA ANTIDECUBITO
SISTEMA DI DI LAVAGGIO DEGLI ENDOSCOPI FLESSIBILI
SISTEMA DI NAVIGAZIONE
NEURONAVIGATORE
SISTEMA DI PERFUSIONE DEL FEGATO
SISTEMA DI PERFUSIONE POLMONARE
SISTEMA LITOTRISSIA INTRAOPERATORIA
SISTEMA MOTORIZZATO PER CHIRURGIA ORTOPEDICA
SISTEMA MOTORIZZATO PER CHIRURGIA OTORINOLARINGOIATRICA
SISTEMA PASSAMALATI
SISTEMA PER LA RIABILITAZIONE DEL PAVIMENTO PELVICO
SISTEMA PER RADIOLOGIA DIGITALE
SISTEMA DI VIDEO-INTEGRAZIONE
SISTEMA POLIFUNZIONALE PER RADIOLOGIA DIGITALE
SISTEMA ROBOTIZZATO PER CHIRURGIA ENDOSCOPICA
SISTEMA ROBOTIZZATO PREPARAZIONE FARMACI
SOLLEVAMENTO MALATI, APPARECCHIO PER
SONDA ECOGRAFICA
SPIROMETRO AD USO CLINICO DIAGNOSTICO
SPREMISACCA
STAMPANTE PER ETICHETTE
STERILIZZATRICE PER ENDOSCOPI
STERILIZZAZIONE CHIMICA, APPARECCHIO PER
STERNOTOMO
TAVOLO OPERATORIO
TELECAMERA PER TECNICHE ENDOSCOPICHE
TELEMETRIA
TERMOREGOLAZIONE CORPOREA NEONATALE
TERMOREGOLAZIONE CORPOREA, APPARECCHIO PER
TERMOSALDATRICE
TELECAMERA AMBIENTALE
TELECAMERA CHIRURGICA
RISONANZA MAGNETICA
TOMOGRAFO AD IMPEDENZA ELETTRICA PER VENTILAZIONE POLMONARE
TOMOGRAFO ASSIALE COMPUTERIZZATO
TOUCH PANEL
TRANSILLUMINATORE
TRAPANO DA DENTISTA
TRAPANO ORTOPEDICO
TRAPANO OTOLOGICO
TRASPORTO MATERIALE ORGANICO, APPARECCHIO PER IL
TRATTAMENTO TESSUTI BIOLOGICI, APPARECCHIO PER
TROMBOELASTOGRAFO
UMIDIFICATORE
UMIDICATORE (AIRVO)
URETERONEFROSCOPIO
URODINAMICA, SISTEMA PER
UROFLUSSOMETRO
VAPORIZZATORE
VASCA DA PARTO
VELOCITA\` DI ERITRO-SEDIMENTAZIONE, APPARECCHIO PER
VENTILATORE POLMONARE AMAGNETICO
VENTILATORE POLMONARE PER USO EXTRAOSPEDALIERO
VENTILATORE POLMONARE PER USO OSPEDALIERO
VENTILATORE POLMONARE TRASPORTABILE D EMERGENZA
VIDEOLARINGOSCOPIO
`;
let occurrencesMap = null;

function resetMapLoadSequence() {
  console.log('[MapLoader] resetMapLoadSequence');
  mapLoadMinMet = false;
  mapLoadResourceMet = false;
  if (mapLoadMinTimeoutId !== null) {
    window.clearTimeout(mapLoadMinTimeoutId);
    mapLoadMinTimeoutId = null;
  }
}

function showMapLoader() {
  console.log('[MapLoader] showMapLoader');
  if (mapLoaderOverlay) {
    mapLoaderOverlay.hidden = false;
  }
  if (viewer) {
    viewer.setAttribute('aria-busy', 'true');
  }
}

function hideMapLoader() {
  console.log('[MapLoader] hideMapLoader');
  if (mapLoaderOverlay) {
    mapLoaderOverlay.hidden = true;
  }
  if (viewer) {
    viewer.removeAttribute('aria-busy');
  }
}

function tryReleaseMapLoader() {
  console.log('[MapLoader] tryReleaseMapLoader', {
    mapLoadMinMet,
    mapLoadResourceMet
  });
  if (mapLoadMinMet && mapLoadResourceMet) {
    hideMapLoader();
  }
}

function startMapLoadSequence() {
  console.log('[MapLoader] startMapLoadSequence', { mapLoadMinMs });
  resetMapLoadSequence();
  showMapLoader();
  mapLoadMinTimeoutId = window.setTimeout(() => {
    console.log('[MapLoader] minimum timeout met');
    mapLoadMinMet = true;
    tryReleaseMapLoader();
  }, mapLoadMinMs);
}

function markMapResourceReady() {
  console.log('[MapLoader] markMapResourceReady');
  mapLoadResourceMet = true;
  tryReleaseMapLoader();
}

function setCenteredMapErrorMessage(text) {
  if (!mapErrorCenterMessage) {
    return;
  }

  mapErrorCenterMessage.textContent = text;
  mapErrorCenterMessage.hidden = text === '';
}

function setMapControlsEnabled(isEnabled) {
  zoomOutButton.disabled = !isEnabled;
  zoomInButton.disabled = !isEnabled;
  zoomResetButton.disabled = !isEnabled;
}

function getFloorNameFromQuery() {
  const searchParams = new URLSearchParams(window.location.search);
  return (searchParams.get('piano') || '').trim();
}

function validateFloorFromQueryString() {
  const floorName = getFloorNameFromQuery();
  requestedFloorName = floorName;
  console.log('[MapLoader] validateFloorFromQueryString', { floorName });
  if (!floorName) {
    setCenteredMapErrorMessage('Parametro "piano" mancante nella URL.');
    setMapControlsEnabled(false);
    return false;
  }

  if (!floorNamePattern.test(floorName)) {
    setCenteredMapErrorMessage('Parametro "piano" non valido.');
    setMapControlsEnabled(false);
    return false;
  }

  setCenteredMapErrorMessage('');
  setMapControlsEnabled(true);
  return true;
}

function parseFloorContext(floorName) {
  const floorMatch = String(floorName || '').trim().match(/^(nord|sud|piastra|sotterraneo)-(\d+)$/i);
  if (!floorMatch) {
    return null;
  }

  const blocco = floorMatch[1].toLowerCase();
  const rawLevel = Number(floorMatch[2]);
  if (!Number.isInteger(rawLevel)) {
    return null;
  }

  const piano = blocco === 'sotterraneo' ? String(-Math.abs(rawLevel)) : String(rawLevel);
  return { blocco, piano };
}

function normalizeDisplayValue(value, fallback = '-') {
  const trimmedValue = String(value ?? '').trim();
  if (trimmedValue === '' || trimmedValue.toLowerCase() === 'null' || trimmedValue.toLowerCase() === 'undefined') {
    return fallback;
  }
  return trimmedValue;
}

function normalizeInputValue(value) {
  return normalizeDisplayValue(value, '');
}

function getCurrentRoomRef() {
  return {
    blocco: activeRoomContext?.blocco || '',
    piano: activeRoomContext?.piano || '',
    roomCode: roomCodeValue.textContent.trim()
  };
}

function buildAutoAttributesPayload() {
  return {
    roomCodeName: normalizeInputValue(roomCodeNameValue.textContent),
    occupazione: normalizeInputValue(roomOccupazioneValue.textContent),
    superficie: normalizeInputValue(roomSurfaceValue.textContent),
    emipiano: normalizeInputValue(roomHemifloorValue.textContent),
    accreditamentoLocale: normalizeInputValue(roomAccreditationValue.textContent),
    postiLetto: normalizeInputValue(roomBedCountValue.textContent),
    noteArrediSegnaletica: normalizeInputValue(roomFurnitureNotesValue.textContent)
  };
}

async function saveRoomFragment(action, extraPayload) {
  const roomRef = getCurrentRoomRef();
  if (!roomRef.blocco || !roomRef.piano || !roomRef.roomCode) {
    throw new Error('Contesto stanza non valido');
  }

  const response = await fetch('../api/save-modal.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action,
      roomRef,
      autoAttributes: buildAutoAttributesPayload(),
      ...extraPayload
    })
  });

  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload;
}

function showSaveError(message) {
  window.alert(message);
}

function resetRoomTables() {
  apparecchiaturaRows.length = 0;
  impiantisticaRows.forEach((row) => {
    row.qtaPresenti = '';
    row.qtaDaImplementare = '';
    row.note = '';
  });
  altreDotazioniRows.forEach((row) => {
    row.presente = '';
    row.daImplementare = '';
    row.note = '';
  });
  editingImpiantisticaIndex = null;
  editingAltreDotazioniIndex = null;
  editingApparecchiaturaIndex = null;
  resetApparecchiaturaForm();
  renderApparecchiaturaTable();
  renderImpiantisticaTable();
  renderAltreDotazioniTable();
}

async function loadOccurrencesData(floorName) {
  try {
    const response = await fetch(`../planimetrie/occorenze-${floorName}.json`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const records = await response.json();
    if (!Array.isArray(records)) {
      throw new Error('Formato JSON non valido: array atteso');
    }

    occurrencesMap = new Map();
    records.forEach((record) => {
      if (!record || typeof record !== 'object') {
        return;
      }

      const roomCode = String(record['Codice semplificato'] || '').trim();
      if (roomCode === '') {
        return;
      }

      occurrencesMap.set(roomCode, record);
    });
    console.log('[Occorrenze] Caricate occorrenze', { count: occurrencesMap.size, floorName });
  } catch (error) {
    console.error('[Occorrenze] Errore caricamento JSON:', error);
    occurrencesMap = null;
  }
}

const apparecchiaturaRows = [];

const impiantisticaRows = [
  {
    tipologia: 'Presa elettrica',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Presa 16A',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Presa 32A',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Presa dati RJ45',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Remorizzazione allarme frigo',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Presa Ossigeno',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Presa Aria med 3-4 bar',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Presa Aria tec 7-8 bar',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Presa Vuoto',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Presa CO2',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Presa EVAC',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Presa Protossido',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Punto acqua fredda',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Punto acqua calda',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Scarico acqua',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Aspirazione esterna',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Vapore',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  },
  {
    tipologia: 'Placche prese video',
    qtaPresenti: '',
    qtaDaImplementare: '',
    note: ''
  }
];

const altreDotazioniRows = [
  {
    altraDotazione: 'Climatizzazione dedicata',
    presente: '',
    daImplementare: '',
    note: ''
  },
  {
    altraDotazione: 'Badge',
    presente: '',
    daImplementare: '',
    note: ''
  },
  {
    altraDotazione: 'Telecamera IT',
    presente: '',
    daImplementare: '',
    note: ''
  },
  {
    altraDotazione: 'Armadio farmaci intelligente',
    presente: '',
    daImplementare: '',
    note: ''
  },
  {
    altraDotazione: 'Testa-letto',
    presente: '',
    daImplementare: '',
    note: ''
  },
  {
    altraDotazione: 'Barra normalizzata verticale',
    presente: '',
    daImplementare: '',
    note: ''
  },
  {
    altraDotazione: 'Barra normalizzata orizzontale',
    presente: '',
    daImplementare: '',
    note: ''
  }
];

function updateZoomDisplay() {
  mapObject.style.width = 'auto';
  mapObject.style.height = 'auto';
  mapObject.style.transformOrigin = 'top left';
  mapObject.style.transform = `scale(${currentZoom})`;
  mapWrapper.style.width = `${baseImageWidth * currentZoom}px`;
  mapWrapper.style.height = `${baseImageHeight * currentZoom}px`;
  zoomValueLabel.textContent = `${Math.round(currentZoom * 100)}%`;
}

function centerMapInViewport() {
  const targetScrollLeft = Math.max(0, (viewer.scrollWidth - viewer.clientWidth) / 2);
  const targetScrollTop = Math.max(0, (viewer.scrollHeight - viewer.clientHeight) / 2);

  viewer.scrollLeft = targetScrollLeft;
  viewer.scrollTop = targetScrollTop;
}

function updateZoomKeepingViewportCenter() {
  const centerRatioX = viewer.scrollWidth > 0
    ? (viewer.scrollLeft + (viewer.clientWidth / 2)) / viewer.scrollWidth
    : 0.5;
  const centerRatioY = viewer.scrollHeight > 0
    ? (viewer.scrollTop + (viewer.clientHeight / 2)) / viewer.scrollHeight
    : 0.5;

  updateZoomDisplay();

  viewer.scrollLeft = Math.max(0, (viewer.scrollWidth * centerRatioX) - (viewer.clientWidth / 2));
  viewer.scrollTop = Math.max(0, (viewer.scrollHeight * centerRatioY) - (viewer.clientHeight / 2));
}

function handleZoomIn() {
  currentZoom = Math.min(maxZoom, Number((currentZoom + zoomStep).toFixed(2)));
  updateZoomKeepingViewportCenter();
}

function handleZoomOut() {
  currentZoom = Math.max(minZoom, Number((currentZoom - zoomStep).toFixed(2)));
  updateZoomKeepingViewportCenter();
}

function handleZoomReset() {
  currentZoom = 1;
  updateZoomDisplay();
  centerMapInViewport();
}

function getRoomCodeWithoutAsterisks(textValue) {
  return textValue.replace(/^\*/, '').replace(/\*$/, '');
}

const editableFieldConfigs = {
  roomCodeName: {
    valueElement: roomCodeNameValue,
    inputElement: roomCodeNameInput,
    buttonElement: editRoomCodeNameButton
  },
  roomOccupazione: {
    valueElement: roomOccupazioneValue,
    inputElement: roomOccupazioneInput,
    buttonElement: editRoomOccupazioneButton
  },
  roomDepartment: {
    valueElement: roomDepartmentValue,
    inputElement: roomDepartmentInput,
    buttonElement: editRoomDepartmentButton
  },
  roomSurface: {
    valueElement: roomSurfaceValue,
    inputElement: roomSurfaceInput,
    buttonElement: editRoomSurfaceButton
  },
  roomHemifloor: {
    valueElement: roomHemifloorValue,
    inputElement: roomHemifloorInput,
    buttonElement: editRoomHemifloorButton
  },
  roomAccreditation: {
    valueElement: roomAccreditationValue,
    inputElement: roomAccreditationInput,
    buttonElement: editRoomAccreditationButton
  },
  roomBedCount: {
    valueElement: roomBedCountValue,
    inputElement: roomBedCountInput,
    buttonElement: editRoomBedCountButton
  },
  roomFurnitureNotes: {
    valueElement: roomFurnitureNotesValue,
    inputElement: roomFurnitureNotesInput,
    buttonElement: editRoomFurnitureNotesButton
  }
};

const editableFieldPayloadKeyMap = {
  roomCodeName: 'roomCodeName',
  roomOccupazione: 'occupazione',
  roomDepartment: 'reparto',
  roomSurface: 'superficie',
  roomHemifloor: 'emipiano',
  roomAccreditation: 'accreditamentoLocale',
  roomBedCount: 'postiLetto',
  roomFurnitureNotes: 'noteArrediSegnaletica'
};

function getSafeRecordValue(record, key) {
  return String((record && record[key]) || '-').trim() || '-';
}

function getSafeRecordValueFromKeys(record, keys) {
  for (const key of keys) {
    const candidateValue = String((record && record[key]) || '').trim();
    if (candidateValue !== '') {
      return candidateValue;
    }
  }
  return '-';
}

function stopEditingField(fieldName, saveChanges) {
  const fieldConfig = editableFieldConfigs[fieldName];
  if (!fieldConfig) {
    return;
  }

  if (saveChanges) {
    fieldConfig.valueElement.textContent = fieldConfig.inputElement.value.trim() || fieldConfig.valueElement.textContent;
  }

  fieldConfig.valueElement.hidden = false;
  fieldConfig.inputElement.hidden = true;
  fieldConfig.buttonElement.textContent = 'Modifica';
  activeFieldBeingEdited = null;
}

function startEditingField(fieldName) {
  const fieldConfig = editableFieldConfigs[fieldName];
  if (!fieldConfig) {
    return;
  }

  if (activeFieldBeingEdited && activeFieldBeingEdited !== fieldName) {
    stopEditingField(activeFieldBeingEdited, false);
  }

  fieldConfig.inputElement.value = fieldConfig.valueElement.textContent.trim();
  fieldConfig.valueElement.hidden = true;
  fieldConfig.inputElement.hidden = false;
  fieldConfig.buttonElement.textContent = 'Salva';
  fieldConfig.inputElement.focus();
  activeFieldBeingEdited = fieldName;

  if (typeof fieldConfig.inputElement.select === 'function') {
    fieldConfig.inputElement.select();
  }
}

async function saveSingleRoomField(fieldName) {
  const fieldConfig = editableFieldConfigs[fieldName];
  const payloadFieldName = editableFieldPayloadKeyMap[fieldName];
  if (!fieldConfig || !payloadFieldName) {
    return;
  }

  const rawValue = fieldConfig.inputElement.value;
  const normalizedValue = normalizeInputValue(rawValue);
  await saveRoomFragment('saveField', {
    fieldName: payloadFieldName,
    value: normalizedValue
  });
}

async function handleEditFieldClick(fieldName) {
  if (activeFieldBeingEdited === fieldName) {
    const fieldConfig = editableFieldConfigs[fieldName];
    if (!fieldConfig) {
      return;
    }

    fieldConfig.buttonElement.disabled = true;
    try {
      await saveSingleRoomField(fieldName);
    } catch (error) {
      console.error('[RoomFieldSave] Errore salvataggio campo', { fieldName, error });
      showSaveError(`Errore salvataggio campo: ${error.message || 'errore sconosciuto'}`);
      fieldConfig.buttonElement.disabled = false;
      return;
    }
    stopEditingField(fieldName, true);
    fieldConfig.buttonElement.disabled = false;
    return;
  }

  startEditingField(fieldName);
}

function setupEditableFieldEvents(fieldName) {
  const fieldConfig = editableFieldConfigs[fieldName];
  fieldConfig.buttonElement.addEventListener('click', async () => {
    await handleEditFieldClick(fieldName);
  });
  fieldConfig.inputElement.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await handleEditFieldClick(fieldName);
    }

    if (event.key === 'Escape') {
      stopEditingField(fieldName, false);
    }
  });
}

function resetEditableFieldsState() {
  Object.keys(editableFieldConfigs).forEach((fieldName) => {
    const fieldConfig = editableFieldConfigs[fieldName];
    fieldConfig.valueElement.hidden = false;
    fieldConfig.inputElement.hidden = true;
    fieldConfig.buttonElement.textContent = 'Modifica';
  });
  activeFieldBeingEdited = null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeApparecchiaturaTipologiaValue(value) {
  const trimmedValue = String(value || '').trim();
  if (trimmedValue === '') {
    return '';
  }

  if (apparecchiaturaTipologiaOptions.includes(trimmedValue)) {
    return trimmedValue;
  }

  const normalizedValue = trimmedValue.toLowerCase();
  const legacyToCurrentTipologiaMap = {
    carrellato: 'Carrellato',
    'a parete': 'Parete',
    parete: 'Parete',
    'su pensile': 'Pensile',
    pensile: 'Pensile',
    'a soffitto': 'Soffitto',
    soffitto: 'Soffitto'
  };

  return legacyToCurrentTipologiaMap[normalizedValue] || '';
}

function normalizeInventarioCode(value) {
  return String(value || '').trim().toUpperCase();
}

function parseInventarioRawValue(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.map((value) => String(value || ''));
  }

  const stringValue = String(rawValue || '').trim();
  if (stringValue === '' || stringValue === '-' || stringValue.toLowerCase() === 'null') {
    return [];
  }

  if (stringValue.startsWith('[') && stringValue.endsWith(']')) {
    try {
      const parsed = JSON.parse(stringValue);
      if (Array.isArray(parsed)) {
        return parsed.map((value) => String(value || ''));
      }
    } catch (error) {
      console.warn('[InventarioParser] JSON non valido, fallback CSV', { error });
    }
  }

  return stringValue.split(',').map((value) => String(value || ''));
}

function normalizeInventarioList(rawValue) {
  const normalizedCodes = parseInventarioRawValue(rawValue)
    .map((value) => normalizeInventarioCode(value))
    .filter((value) => value !== '');

  return Array.from(new Set(normalizedCodes));
}

function serializeInventarioList(rawValue) {
  return normalizeInventarioList(rawValue).join(', ');
}

function initializeApparecchiaturaTomSelect() {
  if (!appTipologiaInput || typeof window.TomSelect !== 'function') {
    return;
  }

  appTipologiaTomSelect = new window.TomSelect(appTipologiaInput, {
    create: false,
    allowEmptyOption: true,
    maxOptions: 500,
    searchField: ['text', 'value'],
    sortField: [
      {
        field: 'text',
        direction: 'asc'
      }
    ],
    placeholder: 'Cerca apparecchiatura...'
  });
}

function setApparecchiaturaValue(value) {
  const normalizedValue = String(value || '').trim();
  if (appTipologiaTomSelect) {
    appTipologiaTomSelect.setValue(normalizedValue, true);
    return;
  }

  appTipologiaInput.value = normalizedValue;
}

function clearApparecchiaturaValue() {
  setApparecchiaturaValue('');
}

function populateApparecchiaturaSelectOptions() {
  if (!appTipologiaInput) {
    return;
  }

  const optionValues = Array.from(
    new Set(
      apparecchiaturaCatalogText
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item !== '')
    )
  );

  const currentValue = String(appTipologiaInput.value || '').trim();
  appTipologiaInput.innerHTML = '<option value="" selected></option>';

  if (appTipologiaTomSelect) {
    appTipologiaTomSelect.clear(true);
    appTipologiaTomSelect.clearOptions();
    appTipologiaTomSelect.addOption({ value: '', text: '' });
    optionValues.forEach((optionValue) => {
      appTipologiaTomSelect.addOption({ value: optionValue, text: optionValue });
    });
    appTipologiaTomSelect.refreshOptions(false);
    setApparecchiaturaValue(currentValue);
    return;
  }

  optionValues.forEach((optionValue) => {
    const optionElement = document.createElement('option');
    optionElement.value = optionValue;
    optionElement.textContent = optionValue;
    appTipologiaInput.appendChild(optionElement);
  });

  setApparecchiaturaValue(currentValue);
}

function normalizeApparecchiaturaRow(row) {
  const safeRow = row && typeof row === 'object' ? row : {};
  const apparecchiaturaValue = String(safeRow.apparecchiatura || safeRow.tipologia || '-').trim() || '-';
  const serializedInventory = serializeInventarioList(safeRow.inv);

  return {
    apparecchiatura: apparecchiaturaValue,
    tipologia: normalizeApparecchiaturaTipologiaValue(safeRow.tipologia),
    produttore: String(safeRow.produttore || '-').trim() || '-',
    modello: String(safeRow.modello || '-').trim() || '-',
    qta: String(safeRow.qta || '0').trim() || '0',
    nuovo: String(safeRow.nuovo || '-').trim() || '-',
    trasferimento: String(safeRow.trasferimento || '-').trim() || '-',
    inv: serializedInventory || '-',
    note: String(safeRow.note || '-').trim() || '-'
  };
}

function setApparecchiaturaEditMode(isEditing) {
  appAddButton.hidden = isEditing;
  appSaveButton.hidden = !isEditing;
  appCancelButton.hidden = !isEditing;
}

function getApparecchiaturaFormData() {
  const normalizedInventory = serializeInventarioList(appInvInput.value);
  return {
    apparecchiatura: appTipologiaInput.value.trim(),
    tipologia: normalizeApparecchiaturaTipologiaValue(appInstallazioneTipologiaInput.value),
    produttore: appProduttoreInput.value.trim(),
    modello: appModelloInput.value.trim(),
    qta: appQtaInput.value.trim(),
    nuovo: appNuovoInput.value.trim(),
    trasferimento: appTrasferimentoInput.value.trim(),
    inv: normalizedInventory,
    note: appNoteInput.value.trim()
  };
}

function resetApparecchiaturaForm() {
  clearApparecchiaturaValue();
  appInstallazioneTipologiaInput.value = '';
  appProduttoreInput.value = '';
  appModelloInput.value = '';
  appQtaInput.value = '';
  appNuovoInput.value = '';
  appTrasferimentoInput.value = '';
  appInvInput.value = '';
  appNoteInput.value = '';
  editingApparecchiaturaIndex = null;
  setApparecchiaturaEditMode(false);
}

function renderApparecchiaturaTable() {
  const rowsHtml = apparecchiaturaRows.map((row, index) => {
    const normalizedRow = normalizeApparecchiaturaRow(row);
    apparecchiaturaRows[index] = normalizedRow;
    return `
    <tr>
      <td>${escapeHtml(normalizedRow.apparecchiatura)}</td>
      <td>${escapeHtml(normalizedRow.tipologia || '-')}</td>
      <td>${escapeHtml(normalizedRow.produttore)}</td>
      <td>${escapeHtml(normalizedRow.modello)}</td>
      <td>${escapeHtml(normalizedRow.qta)}</td>
      <td>${escapeHtml(normalizedRow.nuovo)}</td>
      <td>${escapeHtml(normalizedRow.trasferimento)}</td>
      <td>${escapeHtml(normalizedRow.inv)}</td>
      <td>${escapeHtml(normalizedRow.note)}</td>
      <td><button type="button" class="row-edit-button" data-app-edit="${index}">Modifica</button></td>
    </tr>
  `;
  }).join('');

  apparecchiaturaTableBody.innerHTML = rowsHtml || `
    <tr><td colspan="10">Nessun dato inserito.</td></tr>
  `;

  apparecchiaturaTableBody.querySelectorAll('[data-app-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const rowIndex = Number(button.dataset.appEdit);
      const selectedRow = apparecchiaturaRows[rowIndex];
      if (!selectedRow) {
        return;
      }

      const normalizedSelectedRow = normalizeApparecchiaturaRow(selectedRow);
      apparecchiaturaRows[rowIndex] = normalizedSelectedRow;

      setApparecchiaturaValue(normalizedSelectedRow.apparecchiatura);
      appInstallazioneTipologiaInput.value = normalizedSelectedRow.tipologia;
      appProduttoreInput.value = normalizedSelectedRow.produttore === '-' ? '' : normalizedSelectedRow.produttore;
      appModelloInput.value = normalizedSelectedRow.modello === '-' ? '' : normalizedSelectedRow.modello;
      appQtaInput.value = normalizedSelectedRow.qta;
      appNuovoInput.value = normalizedSelectedRow.nuovo;
      appTrasferimentoInput.value = normalizedSelectedRow.trasferimento;
      appInvInput.value = normalizedSelectedRow.inv === '-' ? '' : normalizedSelectedRow.inv;
      appNoteInput.value = normalizedSelectedRow.note;
      editingApparecchiaturaIndex = rowIndex;
      setApparecchiaturaEditMode(true);
    });
  });
}

async function saveImpiantisticaRow(rowIndex) {
  const row = impiantisticaRows[rowIndex];
  if (!row) {
    return;
  }

  await saveRoomFragment('saveImpiantisticaRow', {
    rowIndex,
    row: {
      tipologia: row.tipologia,
      qtaPresenti: normalizeInputValue(row.qtaPresenti),
      qtaDaImplementare: normalizeInputValue(row.qtaDaImplementare),
      note: normalizeInputValue(row.note)
    }
  });
}

async function saveAltreDotazioniRow(rowIndex) {
  const row = altreDotazioniRows[rowIndex];
  if (!row) {
    return;
  }

  await saveRoomFragment('saveAltreDotazioniRow', {
    rowIndex,
    row: {
      altraDotazione: row.altraDotazione,
      presente: normalizeInputValue(row.presente),
      daImplementare: normalizeInputValue(row.daImplementare),
      note: normalizeInputValue(row.note)
    }
  });
}

async function saveApparecchiaturaRow(rowIndex) {
  const row = apparecchiaturaRows[rowIndex];
  if (!row) {
    return;
  }

  await saveRoomFragment('saveApparecchiaturaRow', {
    rowIndex,
    row: {
      apparecchiatura: normalizeInputValue(row.apparecchiatura),
      tipologia: normalizeInputValue(row.tipologia),
      produttore: normalizeInputValue(row.produttore),
      modello: normalizeInputValue(row.modello),
      qta: normalizeInputValue(row.qta),
      nuovo: normalizeInputValue(row.nuovo),
      trasferimento: normalizeInputValue(row.trasferimento),
      inv: normalizeInventarioList(row.inv),
      note: normalizeInputValue(row.note)
    }
  });
}

function renderImpiantisticaTable() {
  const rowsHtml = impiantisticaRows.map((row, index) => {
    const isRowEditing = editingImpiantisticaIndex === index;
    return `
    <tr>
      <td>${escapeHtml(row.tipologia)}</td>
      <td>
        <input
          type="number"
          min="0"
          class="table-inline-input"
          data-imp-qta-presenti="${index}"
          value="${escapeHtml(row.qtaPresenti || '')}"
          ${isRowEditing ? '' : 'disabled'}
        >
      </td>
      <td>
        <input
          type="number"
          min="0"
          class="table-inline-input"
          data-imp-qta-implementare="${index}"
          value="${escapeHtml(row.qtaDaImplementare || '')}"
          ${isRowEditing ? '' : 'disabled'}
        >
      </td>
      <td>
        <input
          type="text"
          class="table-inline-input"
          data-imp-note="${index}"
          value="${escapeHtml(row.note || '')}"
          ${isRowEditing ? '' : 'disabled'}
        >
      </td>
      <td>
        <button type="button" class="row-edit-button" data-imp-edit="${index}">
          ${isRowEditing ? 'Salva' : 'Modifica'}
        </button>
      </td>
    </tr>
  `;
  }).join('');

  impiantisticaTableBody.innerHTML = rowsHtml || '<tr><td colspan="5">Nessun dato inserito.</td></tr>';

  impiantisticaTableBody.querySelectorAll('[data-imp-qta-presenti]').forEach((inputElement) => {
    inputElement.addEventListener('input', () => {
      const rowIndex = Number(inputElement.dataset.impQtaPresenti);
      const selectedRow = impiantisticaRows[rowIndex];
      if (!selectedRow) {
        return;
      }
      selectedRow.qtaPresenti = inputElement.value.trim();
    });
  });

  impiantisticaTableBody.querySelectorAll('[data-imp-qta-implementare]').forEach((inputElement) => {
    inputElement.addEventListener('input', () => {
      const rowIndex = Number(inputElement.dataset.impQtaImplementare);
      const selectedRow = impiantisticaRows[rowIndex];
      if (!selectedRow) {
        return;
      }
      selectedRow.qtaDaImplementare = inputElement.value.trim();
    });
  });

  impiantisticaTableBody.querySelectorAll('[data-imp-note]').forEach((inputElement) => {
    inputElement.addEventListener('input', () => {
      const rowIndex = Number(inputElement.dataset.impNote);
      const selectedRow = impiantisticaRows[rowIndex];
      if (!selectedRow) {
        return;
      }
      selectedRow.note = inputElement.value.trim();
    });
  });

  impiantisticaTableBody.querySelectorAll('[data-imp-edit]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', async () => {
      const rowIndex = Number(buttonElement.dataset.impEdit);
      if (editingImpiantisticaIndex === rowIndex) {
        buttonElement.disabled = true;
        try {
          await saveImpiantisticaRow(rowIndex);
        } catch (error) {
          console.error('[ImpiantisticaSave] Errore salvataggio riga', { rowIndex, error });
          showSaveError(`Errore salvataggio impiantistica: ${error.message || 'errore sconosciuto'}`);
          buttonElement.disabled = false;
          return;
        }
        editingImpiantisticaIndex = null;
      } else {
        editingImpiantisticaIndex = rowIndex;
      }
      renderImpiantisticaTable();
    });
  });
}

function renderAltreDotazioniTable() {
  const yesNoOptions = [
    { value: '', label: '' },
    { value: 'Si', label: 'Si' },
    { value: 'No', label: 'No' }
  ];

  const rowsHtml = altreDotazioniRows.map((row, index) => {
    const isRowEditing = editingAltreDotazioniIndex === index;
    const presenteOptions = yesNoOptions.map((option) => {
      const isSelected = row.presente === option.value ? 'selected' : '';
      return `<option value="${escapeHtml(option.value)}" ${isSelected}>${escapeHtml(option.label)}</option>`;
    }).join('');

    const daImplementareOptions = yesNoOptions.map((option) => {
      const isSelected = row.daImplementare === option.value ? 'selected' : '';
      return `<option value="${escapeHtml(option.value)}" ${isSelected}>${escapeHtml(option.label)}</option>`;
    }).join('');

    return `
    <tr>
      <td>${escapeHtml(row.altraDotazione || '-')}</td>
      <td>
        <select class="table-inline-input" data-alt-presente="${index}" ${isRowEditing ? '' : 'disabled'}>
          ${presenteOptions}
        </select>
      </td>
      <td>
        <select class="table-inline-input" data-alt-implementare="${index}" ${isRowEditing ? '' : 'disabled'}>
          ${daImplementareOptions}
        </select>
      </td>
      <td>
        <input
          type="text"
          class="table-inline-input"
          data-alt-note="${index}"
          value="${escapeHtml(row.note || '')}"
          ${isRowEditing ? '' : 'disabled'}
        >
      </td>
      <td>
        <button type="button" class="row-edit-button" data-alt-edit="${index}">
          ${isRowEditing ? 'Salva' : 'Modifica'}
        </button>
      </td>
    </tr>
  `;
  }).join('');

  altreDotazioniTableBody.innerHTML = rowsHtml || '<tr><td colspan="5">Nessun dato inserito.</td></tr>';

  altreDotazioniTableBody.querySelectorAll('[data-alt-presente]').forEach((selectElement) => {
    selectElement.addEventListener('change', () => {
      const rowIndex = Number(selectElement.dataset.altPresente);
      const selectedRow = altreDotazioniRows[rowIndex];
      if (!selectedRow) {
        return;
      }
      selectedRow.presente = selectElement.value;
    });
  });

  altreDotazioniTableBody.querySelectorAll('[data-alt-implementare]').forEach((selectElement) => {
    selectElement.addEventListener('change', () => {
      const rowIndex = Number(selectElement.dataset.altImplementare);
      const selectedRow = altreDotazioniRows[rowIndex];
      if (!selectedRow) {
        return;
      }
      selectedRow.daImplementare = selectElement.value;
    });
  });

  altreDotazioniTableBody.querySelectorAll('[data-alt-note]').forEach((inputElement) => {
    inputElement.addEventListener('input', () => {
      const rowIndex = Number(inputElement.dataset.altNote);
      const selectedRow = altreDotazioniRows[rowIndex];
      if (!selectedRow) {
        return;
      }
      selectedRow.note = inputElement.value.trim();
    });
  });

  altreDotazioniTableBody.querySelectorAll('[data-alt-edit]').forEach((buttonElement) => {
    buttonElement.addEventListener('click', async () => {
      const rowIndex = Number(buttonElement.dataset.altEdit);
      if (editingAltreDotazioniIndex === rowIndex) {
        buttonElement.disabled = true;
        try {
          await saveAltreDotazioniRow(rowIndex);
        } catch (error) {
          console.error('[AltreDotazioniSave] Errore salvataggio riga', { rowIndex, error });
          showSaveError(`Errore salvataggio altre dotazioni: ${error.message || 'errore sconosciuto'}`);
          buttonElement.disabled = false;
          return;
        }
        editingAltreDotazioniIndex = null;
      } else {
        editingAltreDotazioniIndex = rowIndex;
      }
      renderAltreDotazioniTable();
    });
  });
}

function applyRoomAttributesFromPayload(attributiStanza) {
  const safeAttributes = attributiStanza && typeof attributiStanza === 'object' ? attributiStanza : {};
  roomCodeNameValue.textContent = normalizeDisplayValue(safeAttributes.roomCodeName);
  roomOccupazioneValue.textContent = normalizeDisplayValue(safeAttributes.occupazione);
  roomDepartmentValue.textContent = normalizeDisplayValue(safeAttributes.reparto, '');
  roomSurfaceValue.textContent = normalizeDisplayValue(safeAttributes.superficie);
  roomHemifloorValue.textContent = normalizeDisplayValue(safeAttributes.emipiano);
  roomAccreditationValue.textContent = normalizeDisplayValue(safeAttributes.accreditamentoLocale);
  roomBedCountValue.textContent = normalizeDisplayValue(safeAttributes.postiLetto);
  roomFurnitureNotesValue.textContent = normalizeDisplayValue(safeAttributes.noteArrediSegnaletica);
}

function applyTableRowsFromPayload(payload) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const savedApparecchiature = Array.isArray(safePayload.apparecchiature) ? safePayload.apparecchiature : [];
  const savedImpiantistica = Array.isArray(safePayload.impiantistica) ? safePayload.impiantistica : [];
  const savedAltreDotazioni = Array.isArray(safePayload.altreDotazioni) ? safePayload.altreDotazioni : [];

  apparecchiaturaRows.length = 0;
  savedApparecchiature.forEach((row) => {
    apparecchiaturaRows.push(normalizeApparecchiaturaRow(row));
  });

  impiantisticaRows.forEach((row) => {
    row.qtaPresenti = '';
    row.qtaDaImplementare = '';
    row.note = '';
  });
  const impiantisticaByTipologia = new Map();
  savedImpiantistica.forEach((row) => {
    if (!row || typeof row !== 'object') {
      return;
    }
    impiantisticaByTipologia.set(String(row.tipologia || '').trim(), row);
  });
  impiantisticaRows.forEach((row) => {
    const sourceRow = impiantisticaByTipologia.get(row.tipologia);
    if (!sourceRow) {
      return;
    }
    row.qtaPresenti = normalizeInputValue(sourceRow.qtaPresenti);
    row.qtaDaImplementare = normalizeInputValue(sourceRow.qtaDaImplementare);
    row.note = normalizeInputValue(sourceRow.note);
  });

  altreDotazioniRows.forEach((row) => {
    row.presente = '';
    row.daImplementare = '';
    row.note = '';
  });
  const altreDotazioniByName = new Map();
  savedAltreDotazioni.forEach((row) => {
    if (!row || typeof row !== 'object') {
      return;
    }
    altreDotazioniByName.set(String(row.altraDotazione || '').trim(), row);
  });
  altreDotazioniRows.forEach((row) => {
    const sourceRow = altreDotazioniByName.get(row.altraDotazione);
    if (!sourceRow) {
      return;
    }
    row.presente = normalizeInputValue(sourceRow.presente);
    row.daImplementare = normalizeInputValue(sourceRow.daImplementare);
    row.note = normalizeInputValue(sourceRow.note);
  });

  editingImpiantisticaIndex = null;
  editingAltreDotazioniIndex = null;
  resetApparecchiaturaForm();
  renderApparecchiaturaTable();
  renderImpiantisticaTable();
  renderAltreDotazioniTable();
}

async function loadRoomDataFromDatabase(roomContext, roomCode, requestToken) {
  const params = new URLSearchParams({
    blocco: roomContext.blocco,
    piano: roomContext.piano,
    roomCode
  });

  const response = await fetch(`../api/get-room.php?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || 'Errore caricamento stanza');
  }

  if (requestToken !== lastModalRequestToken) {
    return;
  }

  if (payload.exists) {
    applyRoomAttributesFromPayload(payload.attributiStanza);
    applyTableRowsFromPayload(payload);
    return;
  }
}

function setActiveModalSection(sectionName) {
  const isApparecchiatura = sectionName === 'apparecchiatura';
  const isImpiantistica = sectionName === 'impiantistica';
  const isAltreDotazioni = sectionName === 'altre-dotazioni';

  sectionApparecchiaturaButton.classList.toggle('is-active', isApparecchiatura);
  sectionApparecchiaturaButton.setAttribute('aria-selected', String(isApparecchiatura));
  contentApparecchiatura.classList.toggle('is-active', isApparecchiatura);
  contentApparecchiatura.hidden = !isApparecchiatura;

  sectionImpiantisticaButton.classList.toggle('is-active', isImpiantistica);
  sectionImpiantisticaButton.setAttribute('aria-selected', String(isImpiantistica));
  contentImpiantistica.classList.toggle('is-active', isImpiantistica);
  contentImpiantistica.hidden = !isImpiantistica;

  sectionAltreDotazioniButton.classList.toggle('is-active', isAltreDotazioni);
  sectionAltreDotazioniButton.setAttribute('aria-selected', String(isAltreDotazioni));
  contentAltreDotazioni.classList.toggle('is-active', isAltreDotazioni);
  contentAltreDotazioni.hidden = !isAltreDotazioni;
}

function clearRoomValidationStatus() {
  roomValidationStatus.textContent = '';
  roomValidationStatus.hidden = true;
  roomValidationStatus.classList.remove('is-ok', 'is-error');
}

function showRoomValidationOk() {
  roomValidationStatus.textContent = 'Ok, locale riconosciuto.';
  roomValidationStatus.hidden = false;
  roomValidationStatus.classList.add('is-ok');
  roomValidationStatus.classList.remove('is-error');
}

function showRoomValidationError(message) {
  roomValidationStatus.textContent = message;
  roomValidationStatus.hidden = false;
  roomValidationStatus.classList.add('is-error');
  roomValidationStatus.classList.remove('is-ok');
}

function validateRoomOccurrence(roomCode) {
  if (!occurrencesMap) {
    showRoomValidationError('Dati occorrenze non disponibili');
    return;
  }

  const record = occurrencesMap.get(roomCode);
  if (!record) {
    showRoomValidationError('locale non trovato');
    return;
  }

  roomCodeNameValue.textContent = getSafeRecordValue(record, 'Nome');
  roomOccupazioneValue.textContent = getSafeRecordValue(record, 'Occupazione');
  roomSurfaceValue.textContent = getSafeRecordValueFromKeys(record, ['Area', 'Superficie']);
  roomHemifloorValue.textContent = getSafeRecordValue(record, 'Emipiano');
  roomAccreditationValue.textContent = getSafeRecordValue(record, 'Accreditamento Locale');
  roomBedCountValue.textContent = getSafeRecordValue(record, 'Posti letto');
  roomFurnitureNotesValue.textContent = getSafeRecordValue(record, 'Note arredi e segnaletica');
  showRoomValidationOk();
}

function openModal(textValue) {
  const roomCode = getRoomCodeWithoutAsterisks(textValue);
  const floorContext = parseFloorContext(requestedFloorName);
  activeRoomContext = floorContext;
  lastModalRequestToken += 1;
  const requestToken = lastModalRequestToken;

  roomCodeValue.textContent = roomCode;
  roomCodeNameValue.textContent = '-';
  roomOccupazioneValue.textContent = '-';
  roomDepartmentValue.textContent = '-';
  roomSurfaceValue.textContent = '-';
  roomHemifloorValue.textContent = '-';
  roomAccreditationValue.textContent = '-';
  roomBedCountValue.textContent = '-';
  roomFurnitureNotesValue.textContent = '-';
  clearRoomValidationStatus();
  validateRoomOccurrence(roomCode);
  resetEditableFieldsState();
  resetRoomTables();
  setActiveModalSection('apparecchiatura');
  modalOverlay.classList.add('is-open');
  modalOverlay.setAttribute('aria-hidden', 'false');

  if (!floorContext) {
    showSaveError('Impossibile derivare blocco e piano dalla URL');
    return;
  }

  loadRoomDataFromDatabase(floorContext, roomCode, requestToken).catch((error) => {
    console.error('[RoomLoad] Errore caricamento stanza', error);
    if (requestToken === lastModalRequestToken) {
      showSaveError(`Errore caricamento stanza: ${error.message || 'errore sconosciuto'}`);
    }
  });
}

function closeModal() {
  lastModalRequestToken += 1;
  modalOverlay.classList.remove('is-open');
  modalOverlay.setAttribute('aria-hidden', 'true');
}

function isClickableOccurrence(textNode) {
  const rawText = textNode.textContent ? textNode.textContent.trim() : '';
  return /^\*.+\*$/.test(rawText);
}

function bindOccurrencesClick(svgDocument) {
  const textNodes = svgDocument.querySelectorAll('text');

  textNodes.forEach((textNode) => {
    if (!isClickableOccurrence(textNode)) {
      return;
    }

    textNode.style.cursor = 'pointer';
    textNode.addEventListener('click', () => {
      const textValue = textNode.textContent.trim();
      openModal(textValue);
    });
  });
}

function getSvgSizeFromViewBox(svgRoot) {
  if (!svgRoot) {
    return null;
  }

  const animatedViewBox = svgRoot.viewBox;
  if (
    animatedViewBox &&
    animatedViewBox.baseVal &&
    animatedViewBox.baseVal.width > 0 &&
    animatedViewBox.baseVal.height > 0
  ) {
    return {
      width: animatedViewBox.baseVal.width,
      height: animatedViewBox.baseVal.height
    };
  }

  const viewBoxAttribute = svgRoot.getAttribute('viewBox');
  if (!viewBoxAttribute) {
    return null;
  }

  const viewBoxValues = viewBoxAttribute.trim().split(/\s+/).map(Number);
  if (viewBoxValues.length !== 4 || viewBoxValues.some((value) => Number.isNaN(value))) {
    return null;
  }

  const width = viewBoxValues[2];
  const height = viewBoxValues[3];
  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

function applyFallbackMapSize() {
  baseImageWidth = mapObject.clientWidth || 1000;
  baseImageHeight = mapObject.clientHeight || 1000;
  updateZoomDisplay();
  centerMapInViewport();
}

function initializeMapDimensions() {
  console.log('[MapLoader] initializeMapDimensions start');
  const svgDocument = mapObject.contentDocument;
  if (!svgDocument || !svgDocument.documentElement) {
    console.log('[MapLoader] initializeMapDimensions failed: missing svgDocument');
    setCenteredMapErrorMessage(`Errore nel caricamento della planimetria SVG. Planimetria non trovata: ${requestedFloorName || '-'}.`);
    setMapControlsEnabled(false);
    markMapResourceReady();
    return;
  }

  const svgRoot = svgDocument.documentElement;
  const svgSize = getSvgSizeFromViewBox(svgRoot);

  if (svgSize) {
    baseImageWidth = svgSize.width;
    baseImageHeight = svgSize.height;
  } else {
    baseImageWidth = mapObject.clientWidth || 1000;
    baseImageHeight = mapObject.clientHeight || 1000;
  }

  bindOccurrencesClick(svgDocument);
  setCenteredMapErrorMessage('');
  updateZoomDisplay();
  centerMapInViewport();
  console.log('[MapLoader] initializeMapDimensions success');
  markMapResourceReady();
}

async function handleAddApparecchiatura() {
  const rawRow = getApparecchiaturaFormData();
  const newRow = normalizeApparecchiaturaRow({
    apparecchiatura: rawRow.apparecchiatura || '-',
    tipologia: rawRow.tipologia,
    produttore: rawRow.produttore || '-',
    modello: rawRow.modello || '-',
    qta: rawRow.qta || '0',
    nuovo: rawRow.nuovo || '-',
    trasferimento: rawRow.trasferimento || '-',
    inv: rawRow.inv || '-',
    note: rawRow.note || '-'
  });

  const hasAtLeastOneTypedValue = Object.values(rawRow).some((value) => value !== '');
  if (!hasAtLeastOneTypedValue) {
    window.alert('Inserisci almeno un valore prima di aggiungere la riga.');
    return;
  }

  apparecchiaturaRows.push(newRow);
  const rowIndex = apparecchiaturaRows.length - 1;
  appAddButton.disabled = true;
  try {
    await saveApparecchiaturaRow(rowIndex);
  } catch (error) {
    console.error('[ApparecchiaturaSave] Errore salvataggio nuova riga', { rowIndex, error });
    showSaveError(`Errore salvataggio apparecchiatura: ${error.message || 'errore sconosciuto'}`);
    appAddButton.disabled = false;
    return;
  }
  appAddButton.disabled = false;
  renderApparecchiaturaTable();
  resetApparecchiaturaForm();
}

async function handleSaveApparecchiatura() {
  if (editingApparecchiaturaIndex === null) {
    return;
  }

  const updatedRow = normalizeApparecchiaturaRow(getApparecchiaturaFormData());
  if (!updatedRow.apparecchiatura || !updatedRow.qta) {
    window.alert('Compila almeno Apparecchiatura e QTA per Apparecchiatura.');
    return;
  }

  const rowIndex = editingApparecchiaturaIndex;
  apparecchiaturaRows[rowIndex] = updatedRow;
  appSaveButton.disabled = true;
  try {
    await saveApparecchiaturaRow(rowIndex);
  } catch (error) {
    console.error('[ApparecchiaturaSave] Errore salvataggio riga', { rowIndex, error });
    showSaveError(`Errore salvataggio apparecchiatura: ${error.message || 'errore sconosciuto'}`);
    appSaveButton.disabled = false;
    return;
  }
  appSaveButton.disabled = false;
  renderApparecchiaturaTable();
  resetApparecchiaturaForm();
}

zoomInButton.addEventListener('click', handleZoomIn);
zoomOutButton.addEventListener('click', handleZoomOut);
zoomResetButton.addEventListener('click', handleZoomReset);
modalCloseButton.addEventListener('click', closeModal);
setupEditableFieldEvents('roomCodeName');
setupEditableFieldEvents('roomOccupazione');
setupEditableFieldEvents('roomDepartment');
setupEditableFieldEvents('roomSurface');
setupEditableFieldEvents('roomHemifloor');
setupEditableFieldEvents('roomAccreditation');
setupEditableFieldEvents('roomBedCount');
setupEditableFieldEvents('roomFurnitureNotes');
appAddButton.addEventListener('click', async () => {
  await handleAddApparecchiatura();
});
appSaveButton.addEventListener('click', async () => {
  await handleSaveApparecchiatura();
});
appCancelButton.addEventListener('click', resetApparecchiaturaForm);
sectionApparecchiaturaButton.addEventListener('click', () => setActiveModalSection('apparecchiatura'));
sectionImpiantisticaButton.addEventListener('click', () => setActiveModalSection('impiantistica'));
sectionAltreDotazioniButton.addEventListener('click', () => setActiveModalSection('altre-dotazioni'));
modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) {
    closeModal();
  }
});

const isFloorMapReady = validateFloorFromQueryString();
console.log('[MapLoader] isFloorMapReady', { isFloorMapReady, requestedFloorName });

if (isFloorMapReady) {
  loadOccurrencesData(requestedFloorName);
  startMapLoadSequence();

  let mapInitDone = false;
  function runMapInitOnce() {
    console.log('[MapLoader] runMapInitOnce called', { mapInitDone });
    if (mapInitDone) {
      return;
    }
    mapInitDone = true;
    try {
      initializeMapDimensions();
    } catch (error) {
      console.error('Errore inizializzazione mappa:', error);
      setCenteredMapErrorMessage('Errore durante l\'inizializzazione della planimetria.');
      setMapControlsEnabled(false);
      markMapResourceReady();
    }
  }

  // Registrare `load` prima di assegnare `data`, altrimenti l'evento può essere emesso
  // e perso in corsa (il loader resterebbe all'infinito).
  mapObject.addEventListener('load', runMapInitOnce, { once: true });
  console.log('[MapLoader] load listener registered');
  mapObject.addEventListener('error', () => {
    console.log('[MapLoader] object error event');
    const errorMessage = `Errore nel caricamento della planimetria SVG. Planimetria non trovata: ${requestedFloorName || '-'}.`;
    setCenteredMapErrorMessage(errorMessage);
    setMapControlsEnabled(false);
    markMapResourceReady();
  });
  console.log('[MapLoader] error listener registered');

  mapObject.data = `../planimetrie/${requestedFloorName}.svg`;
  console.log('[MapLoader] mapObject.data assigned', { data: mapObject.data });

  // Fallback di sicurezza: se per qualsiasi motivo `load` non arriva,
  // proviamo una sola inizializzazione ritardata.
  window.setTimeout(() => {
    console.log('[MapLoader] fallback timeout tick', {
      mapInitDone,
      hasContentDocument: Boolean(mapObject.contentDocument)
    });
    if (!mapInitDone && mapObject.contentDocument) {
      runMapInitOnce();
    }
  }, 3000);
}

renderApparecchiaturaTable();
renderImpiantisticaTable();
renderAltreDotazioniTable();
initializeApparecchiaturaTomSelect();
populateApparecchiaturaSelectOptions();
