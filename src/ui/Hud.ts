import { STICK_R, type Input, type TouchButton } from '../core/Input';
import { TAU } from '../core/math';
import { FONT, STAGE_NAMES, STAGE_WAVES, stageOf, stageWave } from '../game/config';
import type { Enemy } from '../game/enemies/Enemy';
import type { Player } from '../game/Player';
import type { Renderer } from '../render/Renderer';

export interface HudData {
  player: Player;
  wave: number;
  remaining: number;
  banner: number;
  boss: Enemy | null;
  flash: number;
  time: number;
  mouseX: number;
  mouseY: number;
  showCursor: boolean;
  /** Controles por toque: o HUD desenha joystick e botões quando input.isTouch. */
  input: Input;
  /** Inimigo travado pela mira automática (só no toque). */
  aimTarget: Enemy | null;
  muted: boolean;
}

/** HUD em espaço de tela, desenhado no mesmo canvas depois do mundo. */
export class Hud {
  draw(r: Renderer, d: HudData): void {
    const ctx = r.ctx;
    const p = d.player;
    const W = r.w, H = r.h;
    const touch = d.input.isTouch;
    const hpFrac = Math.max(0, p.hp / p.stats.maxHp);

    // vinheta de dano / vida baixa
    const low = hpFrac < 0.3 && !p.dead ? 0.25 + 0.15 * Math.sin(d.time * 8) : 0;
    const va = Math.max(d.flash * 0.55, low);
    if (va > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
      g.addColorStop(0, 'rgba(255,0,60,0)');
      g.addColorStop(1, `rgba(255,0,60,${va})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // marcador sob o alvo da mira automática (desenhado no mundo, sob o resto do HUD)
    if (touch && d.aimTarget && !d.aimTarget.dead && d.showCursor) {
      const e = d.aimTarget;
      const rad = e.radius * 1.5 + 3 * Math.sin(d.time * 8);
      r.ellipse(e.rx, e.ry, 0, rad, null, '#000', 5);
      r.ellipse(e.rx, e.ry, 0, rad, null, p.def.color, 2.5);
    }

    // ---- vida ---- (no toque sobe para o topo: o canto inferior esquerdo é do joystick)
    const bx = 28, by = touch ? 40 : H - 54, bw = touch ? 250 : 300, bh = 20;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `800 13px ${FONT}`;
    ctx.fillStyle = p.def.color;
    ctx.fillText(p.def.name.toUpperCase(), bx, by - 10);
    if (p.burning) {
      // aviso de Queimadura ao lado do nome + moldura em brasa na barra de vida
      ctx.fillStyle = Math.floor(d.time * 6) % 2 ? '#ffd23a' : '#ff7a3c';
      ctx.fillText(`♨ QUEIMANDO ${p.burnT.toFixed(1)}s`, bx + bw - 118, by - 10);
      ctx.fillRect(bx - 5, by - 5, bw + 10, bh + 10);
    }
    if (p.chilled) {
      // aviso de Calafrio (fica à esquerda do de Queimadura quando os dois estão ativos)
      ctx.fillStyle = Math.floor(d.time * 5) % 2 ? '#e8fbff' : '#68e8ff';
      ctx.fillText(`❄ CONGELANDO ${p.chillT.toFixed(1)}s`, bx + bw - (p.burning ? 250 : 128), by - 10);
      if (!p.burning) ctx.fillRect(bx - 5, by - 5, bw + 10, bh + 10);
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    ctx.fillStyle = '#2b0d1a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = hpFrac < 0.3 ? '#ff3b5c' : '#3dff8f';
    ctx.fillRect(bx, by, bw * hpFrac, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(bx, by, bw * hpFrac, 5);
    ctx.font = `900 14px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    const hpText = `${Math.ceil(p.hp)} / ${p.stats.maxHp}`;
    ctx.strokeText(hpText, bx + bw / 2, by + 15);
    ctx.fillText(hpText, bx + bw / 2, by + 15);

    // ---- habilidades ---- (no toque viram os botões circulares da direita)
    const size = 58;
    const cx = W / 2;
    if (!touch) {
      this.ability(r, cx - size - 8, H - size - 26, size, p.def.dashName, 'ESPAÇO', p.dashCd, p.dashCdMax, p.def.color);
      this.ability(r, cx + 8, H - size - 26, size, p.def.secName, 'BOTÃO DIR.', p.secCd, p.secCdMax, p.def.color);
    }

    // ---- onda ----
    ctx.textAlign = 'center';
    ctx.font = `900 20px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    const stage = stageOf(d.wave), sw = stageWave(d.wave);
    const wt = `FASE ${stage} · ONDA ${sw} / ${STAGE_WAVES}`;
    ctx.strokeText(wt, cx, 36);
    ctx.fillText(wt, cx, 36);
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = '#b9a8ff';
    ctx.fillText(`${d.remaining} inimigo${d.remaining === 1 ? '' : 's'}`, cx, 56);

    // tempo
    ctx.textAlign = 'right';
    ctx.font = `700 14px ${FONT}`;
    ctx.fillStyle = '#8f84b8';
    const mm = Math.floor(d.time / 60), ss = Math.floor(d.time % 60);
    const clock = `${mm}:${ss.toString().padStart(2, '0')}`;
    if (touch) ctx.fillText(clock, W - 166, 52); // à esquerda dos botões de pausa e som
    else {
      ctx.fillText(clock, W - 28, 36);
      ctx.fillText('ESC pausa · M som', W - 28, 56);
    }

    // ---- barra de vida do Boss ----
    if (d.boss) {
      const b = d.boss;
      const bwid = Math.min(640, W * 0.58);
      const bxx = cx - bwid / 2, byy = 96, bhh = 18;
      const frac = Math.max(0, b.hp / b.maxHp);
      const pulse = b.enraged ? 0.75 + 0.25 * Math.sin(d.time * 10) : 1;
      ctx.textAlign = 'center';
      ctx.font = `900 18px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = b.enraged ? '#ffd0a0' : '#ff8a96';
      const title = (b.bossName ?? '').toUpperCase() + (b.enraged ? '  ·  ENFURECIDO' : '');
      ctx.strokeText(title, cx, byy - 9);
      ctx.fillText(title, cx, byy - 9);
      ctx.fillStyle = '#000';
      ctx.fillRect(bxx - 4, byy - 4, bwid + 8, bhh + 8);
      ctx.fillStyle = '#2b0812';
      ctx.fillRect(bxx, byy, bwid, bhh);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = b.enraged ? '#ff6a2e' : '#ff3b4e';
      ctx.fillRect(bxx, byy, bwid * frac, bhh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(bxx, byy, bwid * frac, 5);
      ctx.fillStyle = '#000'; // marca da fase 2 (50%)
      ctx.fillRect(cx - 1.5, byy, 3, bhh);
      ctx.strokeStyle = b.enraged ? '#ffd0a0' : '#ff8a96';
      ctx.lineWidth = 2;
      ctx.strokeRect(bxx - 4, byy - 4, bwid + 8, bhh + 8);
    }

    // ---- letreiro da onda ----
    if (d.banner > 0) {
      const a = Math.min(1, d.banner / 0.5) * Math.min(1, (2.4 - d.banner) / 0.2);
      ctx.globalAlpha = Math.max(0, a);
      ctx.textAlign = 'center';
      ctx.font = `900 76px ${FONT}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#000';
      const bossWave = sw === STAGE_WAVES;
      ctx.fillStyle = bossWave ? '#ff3b5c' : '#ffffff';
      const t = bossWave ? 'CHEFE' : `ONDA ${sw}`;
      ctx.strokeText(t, cx, H * 0.3);
      ctx.fillText(t, cx, H * 0.3);
      if (sw === 1 && stage > 1) {
        // primeira onda de uma fase nova: anuncia o cenário
        ctx.font = `800 22px ${FONT}`;
        ctx.lineWidth = 5;
        const sub = `FASE ${stage} · ${STAGE_NAMES[stage - 1].toUpperCase()}`;
        ctx.strokeText(sub, cx, H * 0.3 + 44);
        ctx.fillStyle = '#ff8a2a';
        ctx.fillText(sub, cx, H * 0.3 + 44);
      }
      if (d.wave === 1) {
        ctx.font = `700 16px ${FONT}`;
        ctx.lineWidth = 4;
        const help = touch
          ? 'Lado esquerdo: mover  ·  Lado direito: atacar (segure = mira automática, arraste = mirar)'
          : 'WASD mover  ·  Mouse mirar  ·  Botão esq. atacar  ·  Espaço dash  ·  Botão dir. habilidade';
        ctx.strokeText(help, cx, H * 0.3 + 40);
        ctx.fillStyle = '#d7ccff';
        ctx.fillText(help, cx, H * 0.3 + 40);
      }
      ctx.globalAlpha = 1;
    }

    if (touch) this.touchControls(r, d);

    // ---- mira ----
    if (d.showCursor && !touch) {
      const mx = d.mouseX, my = d.mouseY;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      this.crosshair(ctx, mx, my);
      ctx.strokeStyle = p.def.color;
      ctx.lineWidth = 2;
      this.crosshair(ctx, mx, my);
    }
  }

  // ---------- controles virtuais (apenas no toque) ----------
  private touchControls(r: Renderer, d: HudData): void {
    const ctx = r.ctx;
    const p = d.player;
    const inp = d.input;
    const L = inp.layout();
    const color = p.def.color;

    // joystick: base onde o polegar ancorou (ou uma dica discreta de onde tocar)
    const s = inp.stick;
    const held = s.id !== -1;
    const jx = held ? s.ox / r.scale : 132, jy = held ? s.oy / r.scale : r.h - 132;
    ctx.globalAlpha = held ? 0.5 : 0.2;
    this.disc(ctx, jx, jy, STICK_R + 14, 'rgba(10,6,24,0.7)', '#ffffff', 2);
    ctx.globalAlpha = held ? 0.95 : 0.3;
    this.disc(ctx, jx + s.x * STICK_R, jy + s.y * STICK_R, 26, color, '#000', 3);
    ctx.globalAlpha = 1;

    // ataque: mostra a direção quando o arraste vira mira manual
    const a = inp.attack;
    const pressed = a.id !== -1;
    this.button(ctx, L.attack, color, pressed, 0, 1, a.aiming ? 'MIRA' : 'ATAQUE', pressed && !a.aiming ? 'AUTO' : '');
    if (a.aiming) {
      const len = Math.hypot(a.dx, a.dy) || 1;
      const kx = a.dx / len, ky = a.dy / len;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      for (const [stroke, lw] of [['#000', 9], ['#ffffff', 4]] as const) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(L.attack.x + kx * 18, L.attack.y + ky * 18);
        ctx.lineTo(L.attack.x + kx * (L.attack.r - 8), L.attack.y + ky * (L.attack.r - 8));
        ctx.stroke();
      }
    }
    this.button(ctx, L.dash, color, inp.down.dash, p.dashCd, p.dashCdMax, p.def.dashName, '');
    this.button(ctx, L.secondary, color, inp.down.secondary, p.secCd, p.secCdMax, p.def.secName, '');

    // pausa e som no canto superior direito
    for (const [b, kind] of [[L.pause, 'pause'], [L.mute, 'mute']] as const) {
      ctx.globalAlpha = 0.75;
      this.disc(ctx, b.x, b.y, b.r, 'rgba(10,6,24,0.75)', '#b9a8ff', 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      if (kind === 'pause') {
        ctx.fillRect(b.x - 9, b.y - 11, 6, 22);
        ctx.fillRect(b.x + 3, b.y - 11, 6, 22);
      } else {
        // alto-falante: caixa + cone; ondas quando ligado, X quando mudo
        ctx.beginPath();
        ctx.moveTo(b.x - 13, b.y - 5); ctx.lineTo(b.x - 7, b.y - 5); ctx.lineTo(b.x, b.y - 12);
        ctx.lineTo(b.x, b.y + 12); ctx.lineTo(b.x - 7, b.y + 5); ctx.lineTo(b.x - 13, b.y + 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = d.muted ? '#ff3b5c' : '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (d.muted) {
          ctx.moveTo(b.x + 5, b.y - 6); ctx.lineTo(b.x + 14, b.y + 6);
          ctx.moveTo(b.x + 14, b.y - 6); ctx.lineTo(b.x + 5, b.y + 6);
        } else {
          ctx.arc(b.x + 2, b.y, 7, -0.9, 0.9);
          ctx.moveTo(b.x + 2 + 12 * Math.cos(-0.9), b.y + 12 * Math.sin(-0.9));
          ctx.arc(b.x + 2, b.y, 12, -0.9, 0.9);
        }
        ctx.stroke();
      }
    }
  }

  private disc(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number, fill: string, stroke: string, lw: number): void {
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  /** Botão circular com recarga em "pizza" (a fatia escura some conforme a recarga termina). */
  private button(
    ctx: CanvasRenderingContext2D, b: TouchButton, color: string, pressed: boolean,
    cd: number, max: number, label: string, sub: string,
  ): void {
    const ready = cd <= 0;
    ctx.globalAlpha = pressed ? 0.95 : 0.6;
    this.disc(ctx, b.x, b.y, b.r, ready ? color : '#221a3d', '#000', 4);
    ctx.globalAlpha = 1;
    if (!ready) {
      const f = Math.min(1, cd / max);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, b.r - 2, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - f));
      ctx.closePath();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.strokeStyle = pressed ? '#ffffff' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = ready ? '#05030a' : '#ffffff';
    ctx.font = `900 ${label.length > 6 ? 11 : 13}px ${FONT}`;
    ctx.fillText(label, b.x, b.y + (ready && !sub ? 5 : -3));
    if (!ready) {
      ctx.font = `900 17px ${FONT}`;
      ctx.fillText(cd.toFixed(1), b.x, b.y + 17);
    } else if (sub) {
      ctx.font = `800 11px ${FONT}`;
      ctx.fillText(sub, b.x, b.y + 14);
    }
  }

  private crosshair(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, TAU);
    ctx.moveTo(x - 16, y); ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y); ctx.lineTo(x + 16, y);
    ctx.moveTo(x, y - 16); ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 16);
    ctx.stroke();
  }

  private ability(
    r: Renderer, x: number, y: number, s: number,
    name: string, key: string, cd: number, max: number, color: string,
  ): void {
    const ctx = r.ctx;
    const ready = cd <= 0;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 3, y - 3, s + 6, s + 6);
    ctx.fillStyle = ready ? color : '#221a3d';
    ctx.fillRect(x, y, s, s);
    if (!ready) {
      const f = Math.min(1, cd / max);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(x, y + s * f, s, s * (1 - f));
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center';
    ctx.font = `900 ${name.length > 6 ? 10 : 12}px ${FONT}`;
    ctx.fillStyle = ready ? '#05030a' : '#fff';
    ctx.fillText(name, x + s / 2, y + s / 2 + (ready ? 4 : -4));
    if (!ready) {
      ctx.font = `900 15px ${FONT}`;
      ctx.fillText(cd.toFixed(1), x + s / 2, y + s / 2 + 14);
    }
    ctx.font = `700 10px ${FONT}`;
    ctx.fillStyle = '#b9a8ff';
    ctx.fillText(key, x + s / 2, y + s + 16);
  }
}
