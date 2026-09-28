import * as THREE from 'three';

const VOCES_PREFERIDAS = {
  es: ['es-US', 'es-MX', 'es-419', 'es-ES', 'es'],
  en: ['en-US', 'en-GB', 'en'],
};

/**
 * Efectos de sonido sintetizados (sin archivos) con audio espacial 3D,
 * y narración por voz con la síntesis del navegador cuando está disponible.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.idioma = 'es';
    this._vector = new THREE.Vector3();
    this._adelante = new THREE.Vector3();
    this._arriba = new THREE.Vector3();
  }

  /** Debe llamarse dentro de un gesto del usuario (clic en "Entrar"). */
  desbloquear() {
    if (!this.ctx) {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (!Contexto) return;
      this.ctx = new Contexto();
      this.maestro = this.ctx.createGain();
      this.maestro.gain.value = 0.9;
      this.maestro.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }

  /** Mantiene el "oído" virtual en la cabeza del usuario. */
  actualizarOyente(camara) {
    if (!this.ctx) return;
    const oyente = this.ctx.listener;
    camara.getWorldPosition(this._vector);
    camara.getWorldDirection(this._adelante);
    this._arriba.set(0, 1, 0).applyQuaternion(camara.getWorldQuaternion(new THREE.Quaternion()));
    const t = this.ctx.currentTime;
    if (oyente.positionX) {
      oyente.positionX.setValueAtTime(this._vector.x, t);
      oyente.positionY.setValueAtTime(this._vector.y, t);
      oyente.positionZ.setValueAtTime(this._vector.z, t);
      oyente.forwardX.setValueAtTime(this._adelante.x, t);
      oyente.forwardY.setValueAtTime(this._adelante.y, t);
      oyente.forwardZ.setValueAtTime(this._adelante.z, t);
      oyente.upX.setValueAtTime(this._arriba.x, t);
      oyente.upY.setValueAtTime(this._arriba.y, t);
      oyente.upZ.setValueAtTime(this._arriba.z, t);
    }
  }

  /** Tono simple. `pos` (Vector3 en mundo) lo hace sonar desde ese punto del espacio. */
  tono(frecuencia, duracion = 0.12, { tipo = 'sine', volumen = 0.15, retardo = 0, hasta = null, pos = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + retardo;
    const osc = this.ctx.createOscillator();
    const ganancia = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, t0);
    if (hasta) osc.frequency.exponentialRampToValueAtTime(hasta, t0 + duracion);
    ganancia.gain.setValueAtTime(0.0001, t0);
    ganancia.gain.exponentialRampToValueAtTime(volumen, t0 + 0.012);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
    osc.connect(ganancia);

    if (pos) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 0.8;
      panner.positionX.value = pos.x;
      panner.positionY.value = pos.y;
      panner.positionZ.value = pos.z;
      ganancia.connect(panner);
      panner.connect(this.maestro);
    } else {
      ganancia.connect(this.maestro);
    }
    osc.start(t0);
    osc.stop(t0 + duracion + 0.05);
  }

  tic() {
    this.tono(1400, 0.03, { volumen: 0.03 });
  }

  pop(pos) {
    this.tono(520, 0.14, { hasta: 1100, volumen: 0.18, pos });
  }

  agarrar() {
    this.tono(380, 0.08, { hasta: 620, volumen: 0.08 });
  }

  acierto(pos) {
    this.tono(660, 0.12, { volumen: 0.14, pos });
    this.tono(880, 0.12, { volumen: 0.14, retardo: 0.09, pos });
    this.tono(1320, 0.22, { volumen: 0.14, retardo: 0.18, pos });
  }

  error(pos) {
    this.tono(240, 0.18, { tipo: 'triangle', volumen: 0.16, pos });
    this.tono(180, 0.28, { tipo: 'triangle', volumen: 0.16, retardo: 0.14, pos });
  }

  exito() {
    const notas = [523, 659, 784, 1047, 784, 1047];
    notas.forEach((f, i) => this.tono(f, i === notas.length - 1 ? 0.5 : 0.14, { tipo: 'triangle', volumen: 0.12, retardo: i * 0.11 }));
  }

  transicion() {
    this.tono(300, 0.4, { hasta: 900, volumen: 0.05 });
  }

  // ── Narración ────────────────────────────────────────────────────────────

  puedeNarrar(idioma = this.idioma) {
    if (!('speechSynthesis' in window)) return false;
    return Boolean(this._voz(idioma)) || window.speechSynthesis.getVoices().length === 0;
  }

  narrar(texto, idioma = this.idioma) {
    if (!('speechSynthesis' in window) || !texto) return;
    const sintesis = window.speechSynthesis;
    sintesis.cancel();
    const limpio = texto.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');
    const frase = new SpeechSynthesisUtterance(limpio);
    const voz = this._voz(idioma);
    if (voz) frase.voice = voz;
    frase.lang = voz?.lang ?? (idioma === 'en' ? 'en-US' : 'es-US');
    frase.rate = 0.95;
    frase.pitch = 1.05;
    sintesis.speak(frase);
  }

  callar() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  _voz(idioma) {
    const voces = window.speechSynthesis.getVoices();
    for (const codigo of VOCES_PREFERIDAS[idioma] ?? VOCES_PREFERIDAS.es) {
      const voz = voces.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(codigo.toLowerCase()));
      if (voz) return voz;
    }
    return null;
  }
}
