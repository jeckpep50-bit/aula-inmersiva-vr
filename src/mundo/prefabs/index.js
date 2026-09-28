import * as THREE from 'three';
import { microbios } from './microbios.js';
import { alimentos } from './alimentos.js';
import { objetos } from './objetos.js';
import { crearTarjetaTexto } from '../../ui/componentes.js';
import { cajaLocal } from '../../core/entrada.js';

const FABRICAS = {
  ...microbios,
  ...alimentos,
  ...objetos,
  tarjeta: (op) => crearTarjetaTexto({ texto: op.texto ?? '', emoji: op.emoji ?? '', ancho: 0.3, alto: 0.22, color: op.color }),
};

export const modelosDisponibles = Object.keys(FABRICAS);

/**
 * Crea un modelo del catálogo centrado en el origen y escalado para que su
 * lado más largo mida `tamano` metros. Devuelve un grupo con:
 *   userData.tam    → Vector3 con el tamaño final
 *   userData.animar → animación opcional (t) del modelo
 */
export function crearModelo(nombre, { tamano = 0.3, ...opciones } = {}) {
  const fabrica = FABRICAS[nombre];
  const modelo = fabrica ? fabrica(opciones) : crearTarjetaTexto({ texto: nombre, emoji: '❓' });
  if (!fabrica) console.warn(`Modelo desconocido: "${nombre}"`);

  const caja = cajaLocal(modelo);
  const tam = caja.getSize(new THREE.Vector3());
  const escala = tamano / Math.max(tam.x, tam.y, tam.z, 0.001);
  const centro = caja.getCenter(new THREE.Vector3());
  modelo.scale.multiplyScalar(escala);
  modelo.position.copy(centro).multiplyScalar(-escala);

  const envoltorio = new THREE.Group();
  envoltorio.add(modelo);
  envoltorio.userData.tam = tam.multiplyScalar(escala);
  envoltorio.userData.nombreModelo = nombre;
  return envoltorio;
}
