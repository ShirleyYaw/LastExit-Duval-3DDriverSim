/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { TrafficVehicleType } from '../types/game';

// Shared materials and geometries for optimal draw calls and memory
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
wheelGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.29, 16);
rimGeo.rotateZ(Math.PI / 2);

const rubberMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  roughness: 0.9,
  metalness: 0.1,
});

const rimMat = new THREE.MeshStandardMaterial({
  color: 0xd0d0d0,
  metalness: 0.85,
  roughness: 0.2,
});

const glassMat = new THREE.MeshStandardMaterial({
  color: 0x1e2835,
  metalness: 0.9,
  roughness: 0.1,
  transparent: true,
  opacity: 0.85,
});

const headlightMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xffffee,
  emissiveIntensity: 0.9,
  roughness: 0.1,
});

const taillightMat = new THREE.MeshStandardMaterial({
  color: 0x990000,
  emissive: 0xee0000,
  emissiveIntensity: 0.6,
  roughness: 0.2,
});

const taillightBrakingMat = new THREE.MeshStandardMaterial({
  color: 0xff1111,
  emissive: 0xff0000,
  emissiveIntensity: 1.8,
  roughness: 0.1,
});

export function createWheel(): THREE.Group {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(wheelGeo, rubberMat);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheel.add(tire);
  wheel.add(rim);
  return wheel;
}

/**
 * Builds a multi-part 3D vehicle satisfying the 3-12 component composite requirement.
 */
export function createTrafficVehicleMesh(type: TrafficVehicleType, bodyColorHex: number): THREE.Group {
  const group = new THREE.Group();

  const carPaintMat = new THREE.MeshStandardMaterial({
    color: bodyColorHex,
    metalness: 0.65,
    roughness: 0.25,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.8,
    metalness: 0.2,
  });

  if (type === 'police') {
    // Police cruiser: black & white interceptor with lightbar and push bumper
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.7, roughness: 0.2 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.4, roughness: 0.3 });

    // Lower Chassis
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 4.4), baseMat);
    lowerBody.position.y = 0.58;
    group.add(lowerBody);

    // White door panel section
    const doorPanels = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.62, 2.0), whiteMat);
    doorPanels.position.set(0, 0.58, 0);
    group.add(doorPanels);

    // Greenhouse / Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.65, 2.3), glassMat);
    cabin.position.set(0, 1.15, -0.15);
    group.add(cabin);

    // White Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 1.8), whiteMat);
    roof.position.set(0, 1.5, -0.15);
    group.add(roof);

    // Police Lightbar on roof
    const lightBarBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.2), trimMat);
    lightBarBase.position.set(0, 1.56, -0.15);
    group.add(lightBarBase);

    const blueLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.1, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0055ff, emissive: 0x0066ff, emissiveIntensity: 2.0 })
    );
    blueLight.position.set(-0.25, 1.62, -0.15);
    blueLight.name = 'policeBlue';
    group.add(blueLight);

    const redLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.1, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff1100, emissiveIntensity: 2.0 })
    );
    redLight.position.set(0.25, 1.62, -0.15);
    redLight.name = 'policeRed';
    group.add(redLight);

    // Front Push Bumper
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.15), trimMat);
    pushBar.position.set(0, 0.55, -2.25);
    group.add(pushBar);

  } else if (type === 'suv') {
    // Large Florida family SUV
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.85, 4.6), carPaintMat);
    body.position.y = 0.75;
    group.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.85, 2.9), glassMat);
    cabin.position.set(0, 1.5, -0.1);
    group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 2.85), carPaintMat);
    roof.position.set(0, 1.94, -0.1);
    group.add(roof);

    // Roof rails
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 2.5), trimMat);
    railL.position.set(-0.75, 2.0, -0.1);
    const railR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 2.5), trimMat);
    railR.position.set(0.75, 2.0, -0.1);
    group.add(railL, railR);

  } else if (type === 'pickup') {
    // Florida pickup truck with cab and open cargo bed
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 2.2), carPaintMat);
    cab.position.set(0, 0.8, -0.9);
    group.add(cab);

    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.6), glassMat);
    cabinGlass.position.set(0, 1.5, -0.85);
    group.add(cabinGlass);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, 1.55), carPaintMat);
    roof.position.set(0, 1.92, -0.85);
    group.add(roof);

    // Bed walls & floor
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.25, 2.2), trimMat);
    bedFloor.position.set(0, 0.55, 1.25);
    group.add(bedFloor);

    const bedSideL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 2.2), carPaintMat);
    bedSideL.position.set(-0.98, 0.85, 1.25);
    const bedSideR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 2.2), carPaintMat);
    bedSideR.position.set(0.98, 0.85, 1.25);
    const bedBack = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.65, 0.12), carPaintMat);
    bedBack.position.set(0, 0.85, 2.32);
    group.add(bedSideL, bedSideR, bedBack);

  } else if (type === 'van') {
    // Delivery van (Amazon/FedEx/commercial van)
    const vanMat = new THREE.MeshStandardMaterial({ color: 0x3b5998, metalness: 0.3, roughness: 0.4 });
    const vanBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 4.8), vanMat);
    vanBody.position.y = 1.15;
    group.add(vanBody);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 0.1), glassMat);
    windshield.position.set(0, 1.45, -2.36);
    group.add(windshield);

    const sideWindows = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.5, 0.9), glassMat);
    sideWindows.position.set(0, 1.45, -1.6);
    group.add(sideWindows);

  } else {
    // Standard Sedan (sedan)
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.6, 4.3), carPaintMat);
    lowerBody.position.y = 0.55;
    group.add(lowerBody);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 2.2), glassMat);
    cabin.position.set(0, 1.1, -0.1);
    group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 1.7), carPaintMat);
    roof.position.set(0, 1.42, -0.1);
    group.add(roof);

    // Front grille and bumper
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.1), trimMat);
    grille.position.set(0, 0.5, -2.18);
    group.add(grille);
  }

  // 4 Wheels
  const wheelHalfZ = (type === 'van' || type === 'pickup') ? 1.45 : 1.35;
  const wheelPositions = [
    [-0.92, 0.38, -wheelHalfZ],
    [0.92, 0.38, -wheelHalfZ],
    [-0.92, 0.38, wheelHalfZ],
    [0.92, 0.38, wheelHalfZ],
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const w = createWheel();
    w.position.set(wx, wy, wz);
    group.add(w);
  });

  // Headlights (Front is -Z)
  const zFront = (type === 'van' || type === 'pickup') ? -2.35 : -2.15;
  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.1), headlightMat);
  hlL.position.set(-0.7, 0.6, zFront);
  const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.1), headlightMat);
  hlR.position.set(0.7, 0.6, zFront);
  group.add(hlL, hlR);

  // Taillights (Rear is +Z)
  const zRear = (type === 'van' || type === 'pickup') ? 2.38 : 2.18;
  const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), taillightMat);
  tlL.position.set(-0.7, 0.62, zRear);
  tlL.name = 'taillightL';
  const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), taillightMat);
  tlR.position.set(0.7, 0.62, zRear);
  tlR.name = 'taillightR';
  group.add(tlL, tlR);

  return group;
}

export function setVehicleBrakingVisual(vehicleGroup: THREE.Group, isBraking: boolean) {
  const tlL = vehicleGroup.getObjectByName('taillightL') as THREE.Mesh;
  const tlR = vehicleGroup.getObjectByName('taillightR') as THREE.Mesh;
  const mat = isBraking ? taillightBrakingMat : taillightMat;
  if (tlL) tlL.material = mat;
  if (tlR) tlR.material = mat;
}

/**
 * Procedural Florida Royal Palm Tree
 */
export function createPalmTree(): THREE.Group {
  const group = new THREE.Group();

  // Curving trunk with subtle segments
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x8a7356,
    roughness: 0.9,
    metalness: 0.05,
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 8, 8), trunkMat);
  trunk.position.y = 4;
  trunk.rotation.z = (Math.random() - 0.5) * 0.12;
  trunk.rotation.x = (Math.random() - 0.5) * 0.1;
  group.add(trunk);

  // Palm fronds (leaf canopy)
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x2e6b27,
    roughness: 0.7,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const frondCount = 7;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2;
    const frondGroup = new THREE.Group();
    frondGroup.position.set(0, 8, 0);
    frondGroup.rotation.y = angle;

    const frond = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 3.2), frondMat);
    frond.position.set(0, -0.4, 1.4);
    frond.rotation.x = 0.45;
    frondGroup.add(frond);

    group.add(frondGroup);
  }

  return group;
}

/**
 * Procedural Florida Suburban Building or Shop
 */
export function createRoadsideBuilding(type: 'house' | 'shop' | 'gas_station' | 'courthouse'): THREE.Group {
  const group = new THREE.Group();

  if (type === 'courthouse') {
    // Grand Neoclassical County Courthouse with steps, pillars, and pediment
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xded8cc, roughness: 0.4, metalness: 0.15 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a554f, roughness: 0.7, metalness: 0.2 });

    // Base podium
    const base = new THREE.Mesh(new THREE.BoxGeometry(22, 1.8, 16), marbleMat);
    base.position.y = 0.9;
    group.add(base);

    // Main hall structure
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 12), marbleMat);
    mainBody.position.set(0, 6.3, 0);
    group.add(mainBody);

    // Front colonnade (6 grand pillars)
    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.45, 7.5, 12);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(pillarGeo, marbleMat);
      p.position.set(-6 + i * 2.4, 5.5, 6.8);
      group.add(p);
    }

    // Triangular Pediment / Gable
    const pediment = new THREE.Mesh(new THREE.ConeGeometry(8.5, 3.2, 4), roofMat);
    pediment.rotation.y = Math.PI / 4;
    pediment.position.set(0, 10.8, 6.2);
    group.add(pediment);

    // Courthouse sign
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 128;
    const ctx = signCanvas.getContext('2d')!;
    ctx.fillStyle = '#1c2833';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = '#f7f9f9';
    ctx.font = 'bold 36px serif';
    ctx.textAlign = 'center';
    ctx.fillText('COUNTY COURTHOUSE', 256, 74);

    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 })
    );
    signMesh.position.set(0, 7.5, 6.9);
    group.add(signMesh);

  } else if (type === 'gas_station') {
    // Gas station canopy with pumps
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x006633, roughness: 0.3, metalness: 0.2 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xbb2222, roughness: 0.4 });

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 9), canopyMat);
    canopy.position.set(0, 5.5, 0);
    group.add(canopy);

    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5.2, 12), pillarMat);
    p1.position.set(-4.5, 2.6, 0);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5.2, 12), pillarMat);
    p2.position.set(4.5, 2.6, 0);
    group.add(p1, p2);

    const pump1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.8), pumpMat);
    pump1.position.set(-4.5, 0.9, 0);
    const pump2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.8), pumpMat);
    pump2.position.set(4.5, 0.9, 0);
    group.add(pump1, pump2);

    // Convenience store behind canopy
    const store = new THREE.Mesh(
      new THREE.BoxGeometry(14, 4.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xd9c5b2, roughness: 0.7 })
    );
    store.position.set(0, 2.25, -9);
    group.add(store);

  } else if (type === 'house') {
    // Pastel Florida suburban stucco home with tiled roof
    const pastelColors = [0xe8d5b5, 0xd0e1d4, 0xf6dfd7, 0xe2ece9];
    const wallColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
    const houseBody = new THREE.Mesh(
      new THREE.BoxGeometry(11, 4.2, 9),
      new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85 })
    );
    houseBody.position.y = 2.1;
    group.add(houseBody);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(8.5, 2.4, 4),
      new THREE.MeshStandardMaterial({ color: 0xa84a28, roughness: 0.6 }) // terracotta tile
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 5.4, 0);
    group.add(roof);

    // Garage door
    const garage = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    garage.position.set(2.8, 1.2, 4.55);
    group.add(garage);

  } else {
    // Commercial strip mall / office
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(14, 5.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x88929a, roughness: 0.5, metalness: 0.1 })
    );
    building.position.y = 2.75;
    group.add(building);

    // Glass storefront window
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.2),
      glassMat
    );
    glass.position.set(0, 1.8, 5.05);
    group.add(glass);
  }

  return group;
}

/**
 * Overhead highway gantry with reflective green signage
 */
export function createHighwayGantry(text: string, subText: string): THREE.Group {
  const group = new THREE.Group();

  const metalMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.85, roughness: 0.25 });

  // Two vertical support pillars spanning across the highway
  const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8.5, 12), metalMat);
  poleL.position.set(-13, 4.25, 0);
  const poleR = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8.5, 12), metalMat);
  poleR.position.set(13, 4.25, 0);
  group.add(poleL, poleR);

  // Horizontal truss beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(26.5, 0.7, 0.7), metalMat);
  beam.position.set(0, 8.2, 0);
  group.add(beam);

  // Sign canvas
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Highway green background
  ctx.fillStyle = '#006a4e';
  ctx.fillRect(0, 0, 768, 256);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 748, 236);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 384, 95);

  ctx.font = '36px sans-serif';
  ctx.fillText(subText, 384, 165);

  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = '#ffde59';
  ctx.fillText('ONE LIFE • DRIVE DEFENSIVELY', 384, 215);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(11, 3.6, 0.2),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3 })
  );
  sign.position.set(0, 7.8, -0.3);
  group.add(sign);

  return group;
}
