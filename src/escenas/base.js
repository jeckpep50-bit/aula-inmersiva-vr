import * as THREE from 'three';
import { crearModelo } from '../mundo/prefabs/index.js';
import { liberar } from '../mundo/materiales.js';
import { crearBoton, crearEtiqueta } from '../ui/componentes.js';
import { PanelLienzo, COLORES, escribir, tarjeta, pastilla, fuente } from '../ui/lienzo.js';

/**
 * Base de todas las escenas. `m` es el motor: { app, entrada, audio, fx, t, leccion }.
 * Sistema de coordenadas de `raiz`: el usuario está en el origen mirando a -Z,
 * `this.H` es la altura de sus ojos (se adapta a si está sentado o de pie).
 */
export class EscenaBase {
  constructor(m, datos, indice, total) {
    this.m = m;
    this.datos = datos;
    this.indice = indice;
    this.total = total;
    this.raiz = new THREE.Group();
    this.H = m.app.alturaOjos;
    this._interactivos = [];
    this._quitar = [];
    this._terminada = false;
    this.alTerminar = null;
  }

  construir() {}
  iniciar() {}

  terminar() {
    if (this._terminada) return;
    this._terminada = true;
    this.alTerminar?.();
  }

  destruir() {
    this._destruida = true;
    for (const obj of this._interactivos) this.m.entrada.desregistrar(obj);
    for (const quitar of this._quitar) quitar();
    this.m.audio.callar();
    liberar(this.raiz);
    this.raiz.removeFromParent();
  }

  // ── Utilidades para las escenas ───────────────────────────────────────────

  get t() {
    return this.m.t;
  }

  cadaCuadro(fn) {
    this._quitar.push(this.m.app.alActualizar(fn));
  }

  interactivo(obj, cfg) {
    this.m.entrada.registrar(obj, cfg);
    this._interactivos.push(obj);
    return obj;
  }

  /** Botón que se ilumina al apuntarlo y ejecuta `accion` al seleccionarlo. */
  boton(texto, accion, opciones = {}) {
    const b = crearBoton({ texto, ...opciones });
    this.interactivo(b, {
      alPasar: (v) => b.setEncima(v),
      alSeleccionar: (p) => {
        this.m.audio.pop(b.getWorldPosition(new THREE.Vector3()));
        this.m.fx.latido(b, 0.08);
        accion(p);
      },
    });
    return b;
  }

  /** Modelo del catálogo con su animación ya conectada. */
  modelo(nombre, opciones = {}) {
    const obj = crearModelo(nombre, opciones);
    const animaciones = [];
    obj.traverse((o) => o.userData.animar && animaciones.push(o.userData.animar));
    if (animaciones.length) this.cadaCuadro((_dt, t) => animaciones.forEach((a) => a(t)));
    return obj;
  }

  etiqueta(texto, opciones) {
    return crearEtiqueta(texto, opciones);
  }

  /** Coloca `obj` en un arco alrededor del usuario y lo orienta hacia él. */
  enArco(obj, angulo, radio, y) {
    obj.position.set(Math.sin(angulo) * radio, y, -Math.cos(angulo) * radio);
    obj.lookAt(0, y, 0);
    return obj;
  }

  narrar(texto) {
    if (this.m.leccion.narracion) this.m.audio.narrar(texto, this.m.leccion.idioma);
  }

  /**
   * Panel de encabezado estándar: parte X de N, título, instrucción y una zona
   * de mensajes (retroalimentación) que se actualiza con `mensaje()`.
   */
  encabezado({ instruccion = '', ancho = 1.6, alto = 0.48, y = this.H + 0.47, z = -1.85, conMensajes = true } = {}) {
    const estado = { instruccion, mensaje: '', colorMensaje: COLORES.texto, derecha: '' };
    const titulo = this.datos.titulo ?? '';
    const panel = new PanelLienzo(ancho, alto, (ctx, w, h) => {
      tarjeta(ctx, w, h, { radio: 44 });
      pastilla(ctx, this.t('escenaDe', { n: this.indice + 1, total: this.total }), 40, 30, { tam: 30 });
      if (estado.derecha) {
        ctx.font = fuente(30, 700);
        const ancho = ctx.measureText(estado.derecha).width + 36;
        pastilla(ctx, estado.derecha, w - 40 - ancho, 30, { tam: 30, fondo: '#fff4d6' });
      }
      escribir(ctx, titulo, 44, 94, { tam: 58, peso: 800, maxAncho: w - 88, maxAlto: 78 });
      const yMsg = h - 136;
      const finInstruccion = conMensajes ? yMsg - 8 : h - 30;
      escribir(ctx, estado.instruccion, 44, 174, { tam: 38, tamMin: 30, color: COLORES.suave, maxAncho: w - 88, maxAlto: finInstruccion - 174 });
      if (estado.mensaje) {
        ctx.fillStyle = estado.colorMensaje + '22';
        ctx.beginPath();
        ctx.roundRect(28, yMsg, w - 56, 104, 26);
        ctx.fill();
        escribir(ctx, estado.mensaje, 50, yMsg + 52, { tam: 38, tamMin: 28, peso: 700, color: estado.colorMensaje, maxAncho: w - 100, maxAlto: 96, base: 'middle', interlineado: 1.15 });
      }
    });
    panel.position.set(0, y, z);
    panel.lookAt(0, this.H, 0);
    panel.mensaje = (texto, color = COLORES.texto) => {
      estado.mensaje = texto;
      estado.colorMensaje = color;
      panel.redibujar();
    };
    panel.derecha = (texto) => {
      estado.derecha = texto;
      panel.redibujar();
    };
    this.raiz.add(panel);
    return panel;
  }

  /** Botón "Continuar" que aparece con una animación. */
  mostrarContinuar(posicion = new THREE.Vector3(0, this.H - 0.05, -1.45)) {
    if (this._continuar) return;
    this._continuar = this.boton(this.t('continuar'), () => this.terminar(), { ancho: 0.5, alto: 0.14, color: COLORES.verde });
    this._continuar.position.copy(posicion);
    this._continuar.lookAt(0, this.H, 0);
    this.raiz.add(this._continuar);
    this.m.fx.aparecer(this._continuar);
  }

  posMundo(obj) {
    return obj.getWorldPosition(new THREE.Vector3());
  }
}
