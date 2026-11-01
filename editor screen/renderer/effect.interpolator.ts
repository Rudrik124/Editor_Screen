import { LayerTransform } from "./webgl.renderer";

export interface EffectInstance {
  type: string;
  parameters?: Record<string, any>;
}

export function evaluateClipEffectTransforms(
  effects: EffectInstance[],
  localTime: number,
  duration: number,
  baseTransform: LayerTransform
): LayerTransform {
  const result: LayerTransform = {
    scale: baseTransform.scale ?? 1.0,
    positionX: baseTransform.positionX ?? 0,
    positionY: baseTransform.positionY ?? 0,
    rotation: baseTransform.rotation ?? 0,
    opacity: baseTransform.opacity ?? 1.0,
  };

  const progress = duration > 0 ? Math.min(1.0, Math.max(0.0, localTime / duration)) : 0;

  for (const eff of effects) {
    const etype = eff.type.toLowerCase();
    const p = eff.parameters || {};

    switch (etype) {
      case "fade_in": {
        const dur = Number(p.duration ?? 1.0);
        const t = Math.min(1.0, Math.max(0.0, localTime / dur));
        const startOp = Number(p.startOpacity ?? 0.0);
        const endOp = Number(p.endOpacity ?? 1.0);
        result.opacity! *= (startOp + (endOp - startOp) * (t * t * (3.0 - 2.0 * t)));
        break;
      }
      case "fade_out": {
        const dur = Number(p.duration ?? 1.0);
        const startT = Math.max(0.0, duration - dur);
        if (localTime >= startT) {
          const t = Math.min(1.0, (localTime - startT) / dur);
          const startOp = Number(p.startOpacity ?? 1.0);
          const endOp = Number(p.endOpacity ?? 0.0);
          result.opacity! *= (startOp + (endOp - startOp) * (t * t * (3.0 - 2.0 * t)));
        }
        break;
      }
      case "zoom_in": {
        const maxZoom = Number(p.zoomAmount ?? 1.5);
        result.scale! *= 1.0 + (maxZoom - 1.0) * progress;
        break;
      }
      case "zoom_out": {
        const maxZoom = Number(p.zoomAmount ?? 1.5);
        result.scale! *= maxZoom - (maxZoom - 1.0) * progress;
        break;
      }
      case "spin": {
        const speed = Number(p.speed ?? 1.0);
        const dir = Number(p.direction ?? 1);
        result.rotation! += dir * speed * localTime * 2.0 * Math.PI;
        break;
      }
      case "drop": {
        const dist = Number(p.distance ?? 200);
        const speed = Number(p.speed ?? 3.0);
        const decay = Number(p.bounce ?? 2.0);
        const yOffset = -dist * Math.cos(speed * localTime) * Math.exp(-decay * localTime);
        result.positionY! += yOffset;
        break;
      }
      case "move_left": {
        const dist = Number(p.distance ?? 200);
        const dur = Number(p.duration ?? 0.8);
        const t = Math.min(1.0, localTime / dur);
        result.positionX! += dist * (1.0 - t);
        break;
      }
      case "move_right": {
        const dist = Number(p.distance ?? 200);
        const dur = Number(p.duration ?? 0.8);
        const t = Math.min(1.0, localTime / dur);
        result.positionX! -= dist * (1.0 - t);
        break;
      }
      case "move_up": {
        const dist = Number(p.distance ?? 200);
        const dur = Number(p.duration ?? 0.8);
        const t = Math.min(1.0, localTime / dur);
        result.positionY! += dist * (1.0 - t);
        break;
      }
      case "move_down": {
        const dist = Number(p.distance ?? 200);
        const dur = Number(p.duration ?? 0.8);
        const t = Math.min(1.0, localTime / dur);
        result.positionY! -= dist * (1.0 - t);
        break;
      }
      case "shake_in": {
        const strength = Number(p.strength ?? 15);
        const freq = Number(p.frequency ?? 20);
        const dur = Number(p.duration ?? 0.7);
        if (localTime <= dur) {
          const decay = 1.0 - localTime / dur;
          result.positionX! += Math.sin(localTime * freq) * strength * decay;
          result.positionY! += Math.cos(localTime * freq * 1.2) * strength * decay;
        }
        break;
      }
      case "zoom_bounce": {
        const zoom = Number(p.zoom ?? 0.4);
        const speed = Number(p.speed ?? 4.0);
        const damp = Number(p.damping ?? 3.0);
        result.scale! *= 1.0 + zoom * Math.exp(-damp * localTime) * Math.cos(speed * localTime);
        break;
      }
      case "pulse": {
        const intensity = Number(p.intensity ?? 0.1);
        const speed = Number(p.speed ?? 2.0);
        result.scale! *= 1.0 + intensity * Math.sin(speed * localTime * 2.0 * Math.PI);
        break;
      }
      case "pop_in": {
        const t = Math.min(1.0, localTime * 2.5);
        const c3 = 1.70158;
        const s = (c3 + 1.0) * Math.pow(t - 1.0, 3) + c3 * Math.pow(t - 1.0, 2) + 1.0;
        result.scale! *= Math.max(0.0, s);
        break;
      }
      case "pop_out": {
        const startT = Math.max(0.0, duration - 0.4);
        if (localTime >= startT) {
          const t = Math.min(1.0, (localTime - startT) / 0.4);
          const c3 = 1.70158;
          const s = 1.0 - ((c3 + 1.0) * Math.pow(t, 3) - c3 * Math.pow(t, 2));
          result.scale! *= Math.max(0.0, s);
        }
        break;
      }
      case "expand": {
        const sx = Number(p.scaleX ?? 1.4);
        const dur = Number(p.duration ?? 0.6);
        const t = Math.min(1.0, localTime / dur);
        result.scale! *= 1.0 + (sx - 1.0) * t;
        break;
      }
      case "collapse": {
        const dur = Number(p.duration ?? 0.6);
        const startT = Math.max(0.0, duration - dur);
        if (localTime >= startT) {
          const t = Math.min(1.0, (localTime - startT) / dur);
          result.scale! *= Math.max(0.0, 1.0 - t);
        }
        break;
      }
      case "swing": {
        const angle = (Number(p.swingAngle ?? 20) * Math.PI) / 180;
        const speed = Number(p.speed ?? 3.0);
        const damp = Number(p.damping ?? 1.5);
        result.rotation! += angle * Math.cos(speed * localTime) * Math.exp(-damp * localTime);
        break;
      }
      case "bounce": {
        const height = Number(p.bounceHeight ?? 60);
        const speed = Number(p.speed ?? 3.5);
        const damp = Number(p.damping ?? 1.2);
        result.positionY! += -Math.abs(height * Math.cos(speed * localTime)) * Math.exp(-damp * localTime);
        break;
      }
      case "wiggle": {
        const str = Number(p.strength ?? 10);
        const spd = Number(p.speed ?? 2.0);
        result.positionX! += Math.sin(spd * localTime * 2.5) * str;
        result.rotation! += (Math.cos(spd * localTime * 1.8) * str * Math.PI) / 180;
        break;
      }
    }
  }

  return result;
}

