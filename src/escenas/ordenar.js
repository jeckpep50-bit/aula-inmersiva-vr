import * as THREE from 'three';
import { EscenaBase } from './base.js';
import { suavizado } from '../core/efectos.js';
import { barajar } from './clasificar.js';
import { PanelLienzo, COLORES, escribir } from '../ui/lienzo.js';

/**
 * Ordenar: tocar las tarjetas en el orden correcto de una secuencia.
 * datos: { titulo, instruccion, pasos: [{ texto, emoji?, pista? }] }  (en el orden correcto)
 */
export class EscenaOrdenar extends EscenaBase {
  construir() {
    const { H } = this;
    this.pasos = (this.datos.pasos ?? []).slice(0, 6);
    this.siguiente = 0;

    this.cabecera = this.encabezado({ instruccion: this.datos.instruccion || this.t('apuntaOrdenar') });
    this.cabecera.derecha(`0 / ${this.pasos.length}`);

    const n = this.pasos.length;
    // Ranuras numeradas (abajo, inclinadas hacia el usuario)
    const pasoRanura = THREE.MathUtils.degToRad(Math.min(19, 100 / Math.max(n - 1, 1)));
    this.ranuras = this.pasos.map((_, i) => {
      const estado = { llena: false };
      const ranura = new PanelLienzo(0.26, 0.2, (ctx, w, h) => {
        const { llena } = estado;
        ctx.setLineDash(llena ? [] : [18, 12]);
        ctx.lineWidth = 8;
        ctx.strokeStyle = llena ? '#2dbe78' : 'rgba(255, 255, 255, 0.85)';
        ctx.fillStyle = llena ? 'rgba(45, 190, 120, 0.45)' : 'rgba(20, 30, 60, 0.35)';
        ctx.beginPath();
        ctx.roundRect(8, 8, w - 16, h - 16, 30);
        ctx.fill();
        ctx.stroke();
        escribir(ctx, String(i + 1), w / 2, h / 2, { tam: 110, peso: 800, color: 'rgba(255,255,255,0.9)', alinear: 'center', base: 'middle' });
      });
      this.enArco(ranura, (i - (n - 1) / 2) * pasoRanura, 1.05, H - 0.5);
      ranura.rotateX(-0.5);
      ranura.userData.estado = estado;
      this.raiz.add(ranura);
      this.presentar(ranura, 0.1 + i * 0.08);
      return ranura;
    });

    // Tarjetas desordenadas (arriba)
    const orden = barajar(this.pasos.map((p, i) => ({ ...p, indice: i })));
    const pasoTarjeta = THREE.MathUtils.degToRad(Math.min(17, 100 / Math.max(n - 1, 1)));
    orden.forEach((paso, k) => {
      const tarjeta = this.modelo('tarjeta', { texto: paso.texto, emoji: paso.emoji, tamano: 0.3 });
      const nodo = new THREE.Group();
      nodo.add(tarjeta);
      this.enArco(nodo, (k - (n - 1) / 2) * pasoTarjeta, 1.3, H - 0.02 + (k % 2) * 0.05);
      nodo.userData.paso = paso;
      this.raiz.add(nodo);
      this.flotar(tarjeta, 0.01);
      // Las tarjetas se reparten desde un mazo en el centro, como una baraja.
      const destino = nodo.position.clone();
      nodo.position.set(0, H - 0.25, -0.9);
      this.m.fx.moverA(nodo, destino, 0.55, suavizado.salida, 0.4 + k * 0.12);
      this.presentar(nodo, 0.4 + k * 0.12, true);
      this.interactivo(nodo, {
        alPasar: (v) => tarjeta.scale.setScalar(v ? 1.1 : 1),
        alSeleccionar: () => this._elegir(nodo),
      });
    });
  }

  _elegir(nodo) {
    const { paso } = nodo.userData;
    const pos = this.posMundo(nodo);
    if (paso.indice !== this.siguiente) {
      this.m.audio.error(pos);
      this.m.fx.sacudir(nodo);
      this.cabecera.mensaje(`🤔 ${paso.pista || this.t('pistaOrden')}`, COLORES.naranja);
      return;
    }

    this.m.entrada.habilitar(nodo, false);
    this.m.audio.acierto(pos);
    const ranura = this.ranuras[this.siguiente];
    const destino = ranura.position.clone().add(new THREE.Vector3(0, 0, 0.015).applyQuaternion(ranura.quaternion));
    this.m.fx.moverA(nodo, destino, 0.45);
    nodo.children[0].userData.quieto = true;
    nodo.children[0].position.y = 0;
    this.m.fx.tween({ duracion: 0.45 }).then(() => {
      if (this._destruida) return;
      ranura.userData.estado.llena = true;
      ranura.redibujar();
      this.m.fx.latido(ranura, 0.12);
      this.m.fx.confeti(this.posMundo(ranura), 16);
    });
    this.m.fx.escalarA(nodo, 0.8, 0.45);
    const qInicio = nodo.quaternion.clone();
    this.m.fx.tween({ duracion: 0.45, alActualizar: (k) => nodo.quaternion.slerpQuaternions(qInicio, ranura.quaternion, k) });
    nodo.children[0].scale.setScalar(1);

    this.siguiente++;
    this.cabecera.derecha(`${this.siguiente} / ${this.pasos.length}`);
    this.cabecera.mensaje(`✅ ${this.siguiente}. ${paso.texto}`, COLORES.verde);
    this.narrar(paso.texto);

    if (this.siguiente === this.pasos.length) {
      this.m.fx.tween({ duracion: 1.2 }).then(() => {
        if (this._destruida) return;
        this.m.audio.exito();
        this.m.fx.confeti(this.posMundo(this.cabecera).add(new THREE.Vector3(0, -0.4, 0.4)), 80);
        this.cabecera.mensaje(this.datos.mensajeFinal || this.t('todoOrdenado'), COLORES.verde);
        this.mostrarContinuar(new THREE.Vector3(0, this.H + 0.02, -1.35));
      });
    }
  }
}
